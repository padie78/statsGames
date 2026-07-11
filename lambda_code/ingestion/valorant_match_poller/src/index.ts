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
 * Vinculá Riot ID como `Nombre#TAG` en Integraciones.
 * Poller: account-v1 → matchlist → match-v1 → enqueue por match nuevo.
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
  gameStartMillis?: number;
  kills: number;
  deaths: number;
  assists: number;
  headshotPct?: number;
  roundsWon?: number;
  agent?: string;
  won?: boolean;
}

const PLATFORM: GamePlatform = 'valorant';
const logger = new ConsoleLogger({ source: 'valorant_match_poller' });
const MAX_SEEN = 40;

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
            headshotPct: detail.headshotPct ?? null,
            roundsWon: detail.roundsWon ?? null,
            map: detail.mapId ?? null,
            agent: detail.agent ?? null,
            mode: 'Competitive',
            summary,
            source: 'valorant_match_poller',
            ...(detail.won ? { placement: 1 } : {}),
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
  if (detail.mapId) bits.push(shortMap(detail.mapId));
  if (detail.agent) bits.push(detail.agent);
  if (detail.won) bits.push('Victoria');
  bits.push(`${detail.kills}/${detail.deaths}/${detail.assists}`);
  if (detail.headshotPct != null) bits.push(`${detail.headshotPct}% HS`);
  return bits.join(' · ').slice(0, 200);
}

function shortMap(mapId: string): string {
  const parts = mapId.split('/');
  return parts[parts.length - 1] ?? mapId;
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
    matchInfo?: { matchId?: string; mapId?: string; gameStartMillis?: number };
    players?: Array<{
      puuid?: string;
      characterId?: string;
      stats?: {
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
    teams?: Array<{ teamId?: string; won?: boolean }>;
  };

  const player = body.players?.find((p) => p.puuid === puuid);
  if (!player?.stats) return null;

  const shots =
    Number(player.stats.headshots ?? 0) +
    Number(player.stats.bodyshots ?? 0) +
    Number(player.stats.legshots ?? 0);
  const headshotPct =
    shots > 0 ? Math.round((Number(player.stats.headshots ?? 0) / shots) * 1000) / 10 : undefined;
  const won = body.teams?.find((t) => t.teamId === player.teamId)?.won;

  return {
    matchId: body.matchInfo?.matchId ?? matchId,
    mapId: body.matchInfo?.mapId,
    gameStartMillis: body.matchInfo?.gameStartMillis,
    kills: Number(player.stats.kills ?? 0),
    deaths: Number(player.stats.deaths ?? 0),
    assists: Number(player.stats.assists ?? 0),
    headshotPct,
    roundsWon: player.stats.roundsWon,
    agent: player.characterId,
    won: !!won,
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
