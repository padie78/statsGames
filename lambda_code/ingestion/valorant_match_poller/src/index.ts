import type { Handler } from 'aws-lambda';
import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoKeys, type GamePlatform } from '@stats-games/common';
import {
  ConsoleLogger,
  SqsGameIngestionQueuePublisherAdapter,
  getDocumentClient,
} from '@stats-games/infrastructure';

/**
 * Valorant Route A — Riot Games API (official).
 *
 * Privacidad: a diferencia de LoL, los perfiles Valorant nacen privados. Con API key
 * sola, matchlist/match-v1 fallan (403) si el jugador no puso historial Público o no
 * autorizó vía Riot Sign-On (RSO). El flujo de producto en Integraciones exige una de
 * esas dos vías antes de confiar en el vínculo.
 *
 * Vinculá Riot ID como `Nombre#TAG` (perfil público) o token RSO cuando esté cableado.
 * Poller: account-v1 → matchlist → match-v1 → enqueue por match nuevo (≤3 min al cerrar).
 *
 * Env:
 *   RIOT_API_KEY
 *   VALORANT_REGION   (account routing: americas|europe|asia) default americas
 *   VALORANT_SHARD    (val match shard: na|eu|ap|kr|latam|br) default na
 */

interface LinkedAccount {
  platformUserId: string;
  userId: string;
}

interface PollCursor {
  puuid?: string;
  seenMatchIds: string[];
}

interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

interface ValorantMatchSummary {
  matchId: string;
  mapId?: string;
  map?: string;
  mode?: string;
  queueId?: string;
  gameStartMillis?: number;
  kills: number;
  deaths: number;
  assists: number;
  score?: number;
  headshotPct?: number;
  roundsWon?: number;
  roundsLost?: number;
  agent?: string;
  agentId?: string;
  won?: boolean;
  /** Average Combat Score (score / rounds). */
  acs?: number;
}

const PLATFORM: GamePlatform = 'valorant';
const logger = new ConsoleLogger({ source: 'valorant_match_poller' });
const MAX_SEEN = 40;

/** Character UUID → display name (Riot match-v1). */
const AGENT_BY_UUID: Record<string, string> = {
  '5f8d3a7f-467b-97f3-062c-13acf203c006': 'Breach',
  'f94c3b30-42be-e959-889c-5aa313dba261': 'Raze',
  '22697a3d-45bf-8dd7-4fec-84a9e28c69d7': 'Chamber',
  '601dbbe7-43ce-be57-2a40-9abd79cbaa7d': 'KAY/O',
  '6f2a04ca-43e0-be17-7f36-b3908627744d': 'Skye',
  '117ed4a4-4b8b-8b8a-d5f0-a9b0e3b0c0f1': 'Fade',
  '320b2a48-4d9b-a075-30f1-1d18a2cebf38': 'Sova',
  '1e58de9c-4950-5125-93e9-a0aee9f98746': 'Killjoy',
  '707eab51-4836-f488-046a-cda6bf494859': 'Viper',
  'eb93336a-449b-9c1b-0a54-a891f7921d69': 'Phoenix',
  '41fb69c1-4189-7b37-f117-bcaf1e96f1bf': 'Astra',
  '9f0d8ba9-4140-b941-57d3-a7ad57c6b417': 'Brimstone',
  '7f94d92c-4234-0a36-9646-3a87eb8b5c89': 'Yoru',
  '569fdd95-4d10-43ab-ca70-79becc718b46': 'Sage',
  'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc': 'Reyna',
  '8e253930-4c05-31dd-1b6c-968525494517': 'Omen',
  'add6443a-41bd-e414-f6ad-e58d267f4e95': 'Jett',
  'bb2a4828-46eb-8cd1-e765-43df32512e72': 'Neon',
  '7a65195f-4764-a8e2-5e4b-3b0e0b0a0a0a': 'Harbor',
  'e370fa57-4757-3604-3648-499e1f642d3f': 'Gekko',
  '95b78ed7-4637-86d9-7e41-71ba8c293152': 'Harbor',
  'dade69b4-4f5a-8528-247b-219e5a1facd6': 'Fade',
  'cc8b64c8-4b25-4ff9-6e7f-37b4ba43db72': 'Iso',
  '0e38b510-41a8-5780-5e8f-568b2a4f2d6c': 'Clove',
  '1dbf2edd-4729-0984-3115-daa5eed44993': 'Clove',
  'efba5359-4016-a1e5-7626-b1ae76895940': 'Vyse',
};

const MAP_BY_PATH: Record<string, string> = {
  Ascent: 'Ascent',
  Bind: 'Bind',
  Breeze: 'Breeze',
  Fracture: 'Fracture',
  Haven: 'Haven',
  Icebox: 'Icebox',
  Lotus: 'Lotus',
  Pearl: 'Pearl',
  Split: 'Split',
  Sunset: 'Sunset',
  Abyss: 'Abyss',
  District: 'District',
  Kasbah: 'Kasbah',
  Piazza: 'Piazza',
};

const QUEUE_MODE: Record<string, string> = {
  competitive: 'Competitive',
  unrated: 'Unrated',
  spikerush: 'Spike Rush',
  deathmatch: 'Deathmatch',
  ggteam: 'Escalation',
  onefa: 'Replication',
  snowball: 'Snowball Fight',
  swiftplay: 'Swiftplay',
  hurm: 'Team Deathmatch',
  newmap: 'New Map',
  premier: 'Premier',
  premierp: 'Premier',
  'customgame': 'Custom',
};

export const handler: Handler = async () => {
  const apiKey = process.env['RIOT_API_KEY']?.trim();
  if (!apiKey) {
    logger.warn('RIOT_API_KEY vacío — poller no-op');
    return { ok: false, reason: 'missing_api_key', enqueued: 0 };
  }

  const region = (process.env['VALORANT_REGION'] ?? 'americas').trim();
  const shard = (process.env['VALORANT_SHARD'] ?? 'na').trim();
  const accounts = await listLinkedAccounts();
  if (accounts.length === 0) {
    return { ok: true, enqueued: 0, accounts: 0 };
  }

  const publisher = new SqsGameIngestionQueuePublisherAdapter();
  let enqueued = 0;

  for (const account of accounts) {
    try {
      const riotId = parseRiotId(account.platformUserId);
      if (!riotId) {
        logger.warn('Riot ID inválido (esperado Nombre#TAG)', {
          platformUserId: account.platformUserId,
        });
        continue;
      }

      const cursor = (await loadCursor(account.platformUserId)) ?? { seenMatchIds: [] };
      let puuid = cursor.puuid;
      if (!puuid) {
        const resolved = await fetchRiotAccount(riotId.gameName, riotId.tagLine, region, apiKey);
        if (!resolved) continue;
        puuid = resolved.puuid;
      }

      const matchIds = await fetchRecentMatchIds(puuid, shard, apiKey);
      const newIds = matchIds.filter((id) => !cursor.seenMatchIds.includes(id));

      for (const matchId of newIds.slice(0, 5)) {
        const detail = await fetchMatchForPlayer(matchId, puuid, shard, apiKey);
        if (!detail) continue;

        const summary = buildSummary(detail);
        await publisher.enqueue({
          userId: account.userId,
          matchId: `val-${detail.matchId}`,
          platform: PLATFORM,
          stats: {
            kills: detail.kills,
            deaths: detail.deaths,
            assists: detail.assists,
            score: detail.score ?? null,
            acs: detail.acs ?? null,
            headshotPct: detail.headshotPct ?? null,
            roundsWon: detail.roundsWon ?? null,
            roundsLost: detail.roundsLost ?? null,
            map: detail.map ?? detail.mapId ?? null,
            agent: detail.agent ?? null,
            agentId: detail.agentId ?? null,
            mode: detail.mode ?? null,
            queueId: detail.queueId ?? null,
            won: detail.won ?? null,
            summary,
            source: 'valorant_match_poller',
            ...(detail.won ? { placement: 1 } : { placement: 2 }),
          },
          occurredAtIso: detail.gameStartMillis
            ? new Date(detail.gameStartMillis).toISOString()
            : new Date().toISOString(),
          correlationId: `val-poll-${detail.matchId}`,
        });
        enqueued += 1;
      }

      const seenMatchIds = [...newIds, ...cursor.seenMatchIds].slice(0, MAX_SEEN);
      await saveCursor(account.platformUserId, { puuid, seenMatchIds });
    } catch (error) {
      logger.error('Error polleando Valorant', {
        platformUserId: account.platformUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, accounts: accounts.length, enqueued };
};

function parseRiotId(raw: string): { gameName: string; tagLine: string } | null {
  const trimmed = raw.trim();
  const hash = trimmed.lastIndexOf('#');
  if (hash <= 0 || hash === trimmed.length - 1) return null;
  return {
    gameName: trimmed.slice(0, hash).trim(),
    tagLine: trimmed.slice(hash + 1).trim(),
  };
}

function buildSummary(detail: ValorantMatchSummary): string {
  const bits = ['Valorant'];
  if (detail.mode) bits.push(detail.mode);
  if (detail.map) bits.push(detail.map);
  if (detail.agent) bits.push(detail.agent);
  if (detail.won === true) bits.push('Victoria');
  else if (detail.won === false) bits.push('Derrota');
  bits.push(`${detail.kills}/${detail.deaths}/${detail.assists}`);
  if (detail.headshotPct != null) bits.push(`${detail.headshotPct}% HS`);
  if (detail.roundsWon != null && detail.roundsLost != null) {
    bits.push(`${detail.roundsWon}-${detail.roundsLost}`);
  }
  return bits.join(' · ').slice(0, 200);
}

function shortMap(mapId: string): string {
  const parts = mapId.split('/');
  const raw = parts[parts.length - 1] ?? mapId;
  return MAP_BY_PATH[raw] ?? raw;
}

function resolveAgent(characterId?: string): { agent?: string; agentId?: string } {
  if (!characterId) return {};
  const known = AGENT_BY_UUID[characterId.toLowerCase()] ?? AGENT_BY_UUID[characterId];
  return { agent: known ?? characterId.slice(0, 8), agentId: characterId };
}

function resolveMode(queueId?: string): string | undefined {
  if (!queueId) return undefined;
  const key = queueId.trim().toLowerCase();
  return QUEUE_MODE[key] ?? queueId;
}

async function fetchRiotAccount(
  gameName: string,
  tagLine: string,
  region: string,
  apiKey: string,
): Promise<RiotAccount | null> {
  const url = `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
  if (response.status === 404) {
    logger.warn('Riot account no encontrada', { gameName, tagLine });
    return null;
  }
  if (!response.ok) {
    throw new Error(`Riot account ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as RiotAccount;
}

async function fetchRecentMatchIds(puuid: string, shard: string, apiKey: string): Promise<string[]> {
  const url = `https://${shard}.api.riotgames.com/val/match/v1/matchlists/by-puuid/${encodeURIComponent(puuid)}?size=10`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
  if (!response.ok) {
    throw new Error(`Valorant matchlist ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as { history?: Array<{ matchId?: string }> };
  return (body.history ?? []).map((h) => h.matchId).filter((id): id is string => !!id);
}

async function fetchMatchForPlayer(
  matchId: string,
  puuid: string,
  shard: string,
  apiKey: string,
): Promise<ValorantMatchSummary | null> {
  const url = `https://${shard}.api.riotgames.com/val/match/v1/matches/${encodeURIComponent(matchId)}`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
  if (!response.ok) {
    logger.warn('No se pudo leer match Valorant', { matchId, status: response.status });
    return null;
  }

  const body = (await response.json()) as {
    matchInfo?: {
      matchId?: string;
      mapId?: string;
      gameStartMillis?: number;
      queueId?: string;
      gameMode?: string;
    };
    players?: Array<{
      puuid?: string;
      characterId?: string;
      stats?: {
        score?: number;
        kills?: number;
        deaths?: number;
        assists?: number;
        headshots?: number;
        bodyshots?: number;
        legshots?: number;
        roundsWon?: number;
      };
      teamId?: string;
    }>;
    teams?: Array<{ teamId?: string; won?: boolean; roundsPlayed?: number; roundsWon?: number }>;
  };

  const player = body.players?.find((p) => p.puuid === puuid);
  if (!player?.stats) return null;

  const shots =
    Number(player.stats.headshots ?? 0) +
    Number(player.stats.bodyshots ?? 0) +
    Number(player.stats.legshots ?? 0);
  const headshotPct =
    shots > 0 ? Math.round((Number(player.stats.headshots ?? 0) / shots) * 1000) / 10 : undefined;

  const myTeam = body.teams?.find((t) => t.teamId === player.teamId);
  const oppTeam = body.teams?.find((t) => t.teamId && t.teamId !== player.teamId);
  const roundsWon =
    myTeam?.roundsWon != null
      ? Number(myTeam.roundsWon)
      : player.stats.roundsWon != null
        ? Number(player.stats.roundsWon)
        : undefined;
  const roundsLost =
    oppTeam?.roundsWon != null
      ? Number(oppTeam.roundsWon)
      : myTeam?.roundsPlayed != null && roundsWon != null
        ? Math.max(0, Number(myTeam.roundsPlayed) - roundsWon)
        : undefined;

  const won = myTeam?.won;
  const mapId = body.matchInfo?.mapId;
  const queueId = body.matchInfo?.queueId;
  const { agent, agentId } = resolveAgent(player.characterId);

  return {
    matchId: body.matchInfo?.matchId ?? matchId,
    mapId,
    map: mapId ? shortMap(mapId) : undefined,
    mode: resolveMode(queueId) ?? body.matchInfo?.gameMode,
    queueId,
    gameStartMillis: body.matchInfo?.gameStartMillis,
    kills: Number(player.stats.kills ?? 0),
    deaths: Number(player.stats.deaths ?? 0),
    assists: Number(player.stats.assists ?? 0),
    score: player.stats.score != null ? Number(player.stats.score) : undefined,
    headshotPct,
    roundsWon,
    roundsLost,
    agent,
    agentId,
    won: won == null ? undefined : !!won,
    acs:
      player.stats.score != null
        ? Math.round(
            Number(player.stats.score) /
              Math.max(1, (roundsWon ?? 0) + (roundsLost ?? 0)),
          )
        : undefined,
  };
}

async function listLinkedAccounts(): Promise<LinkedAccount[]> {
  return scanPlatformAccounts(PLATFORM);
}

async function scanPlatformAccounts(platform: GamePlatform): Promise<LinkedAccount[]> {
  const tableName = requireEnv('TABLE_NAME');
  const client = getDocumentClient();
  const accounts: LinkedAccount[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const page = await client.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `PLATFORM_ACCOUNT#${platform}#`,
          ':sk': DynamoKeys.platformAccountSk(),
        },
        ExclusiveStartKey: exclusiveStartKey,
        ProjectionExpression: 'PK, userId',
      }),
    );

    for (const item of page.Items ?? []) {
      const pk = String(item['PK'] ?? '');
      const userId = item['userId'] ? String(item['userId']) : '';
      const platformUserId = pk.replace(`PLATFORM_ACCOUNT#${platform}#`, '');
      if (platformUserId && userId) accounts.push({ platformUserId, userId });
    }

    exclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return accounts;
}

async function loadCursor(platformUserId: string): Promise<PollCursor | null> {
  const tableName = requireEnv('TABLE_NAME');
  const client = getDocumentClient();
  const result = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: DynamoKeys.statsSnapshotPk(PLATFORM, platformUserId),
        SK: DynamoKeys.statsSnapshotSk(),
      },
    }),
  );
  if (!result.Item) return null;
  const seen = Array.isArray(result.Item['seenMatchIds'])
    ? result.Item['seenMatchIds'].map(String)
    : [];
  return {
    puuid: result.Item['puuid'] ? String(result.Item['puuid']) : undefined,
    seenMatchIds: seen,
  };
}

async function saveCursor(platformUserId: string, cursor: PollCursor): Promise<void> {
  const tableName = requireEnv('TABLE_NAME');
  const client = getDocumentClient();
  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: DynamoKeys.statsSnapshotPk(PLATFORM, platformUserId),
        SK: DynamoKeys.statsSnapshotSk(),
        entityType: 'STATS_SNAPSHOT',
        platform: PLATFORM,
        platformUserId,
        puuid: cursor.puuid ?? null,
        seenMatchIds: cursor.seenMatchIds,
        updatedAtIso: new Date().toISOString(),
      },
    }),
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no configurado`);
  return value;
}
