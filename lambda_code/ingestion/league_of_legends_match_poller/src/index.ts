import type { Handler } from 'aws-lambda';
import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoKeys, type GamePlatform } from '@stats-games/common';
import {
  ConsoleLogger,
  SqsGameIngestionQueuePublisherAdapter,
  getDocumentClient,
} from '@stats-games/infrastructure';

/**
 * League of Legends — Riot match-v5.
 *
 * Vinculá Riot ID `Nombre#TAG` en Integraciones.
 * Poller: account-v1 → matchlist-v5 → match-v5 → SQS.
 *
 * Env:
 *   RIOT_API_KEY
 *   LOL_REGION   (routing: americas|europe|asia|sea) default europe
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

interface LolMatchSummary {
  matchId: string;
  champion?: string;
  role?: string;
  kills: number;
  deaths: number;
  assists: number;
  cs?: number;
  visionScore?: number;
  won?: boolean;
  queueId?: number;
  gameStartMillis?: number;
  durationSec?: number;
  goldEarned?: number;
  champLevel?: number;
  items?: number[];
  teamObjectives?: {
    barons: number;
    dragons: number;
    towers: number;
  };
  mode?: string;
}

const PLATFORM: GamePlatform = 'league_of_legends';
const logger = new ConsoleLogger({ source: 'league_of_legends_match_poller' });
const MAX_SEEN = 40;

const QUEUE_MODE: Record<number, string> = {
  420: 'Ranked Solo',
  440: 'Ranked Flex',
  450: 'ARAM',
  400: 'Normal Draft',
  430: 'Normal Blind',
  700: 'Clash',
  1700: 'Arena',
};

export const handler: Handler = async () => {
  const apiKey = process.env['RIOT_API_KEY']?.trim();
  if (!apiKey) {
    logger.warn('RIOT_API_KEY vacío — poller LoL no-op');
    return { ok: false, reason: 'missing_api_key', enqueued: 0 };
  }

  const region = (process.env['LOL_REGION'] ?? 'europe').trim();
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

      const matchIds = await fetchRecentMatchIds(puuid, region, apiKey);
      const newIds = matchIds.filter((id) => !cursor.seenMatchIds.includes(id));

      for (const matchId of newIds.slice(0, 5)) {
        const detail = await fetchMatchForPlayer(matchId, puuid, region, apiKey);
        if (!detail) continue;

        const summary = buildSummary(detail);
        await publisher.enqueue({
          userId: account.userId,
          matchId: `lol-${detail.matchId}`,
          platform: PLATFORM,
          stats: {
            kills: detail.kills,
            deaths: detail.deaths,
            assists: detail.assists,
            cs: detail.cs ?? null,
            visionScore: detail.visionScore ?? null,
            champion: detail.champion ?? null,
            role: detail.role ?? null,
            mode: detail.mode ?? null,
            queueId: detail.queueId ?? null,
            durationSec: detail.durationSec ?? null,
            goldEarned: detail.goldEarned ?? null,
            champLevel: detail.champLevel ?? null,
            items: detail.items ?? [],
            teamObjectives: detail.teamObjectives ?? null,
            won: detail.won ?? null,
            summary,
            source: 'league_of_legends_match_poller',
            ...(detail.won ? { placement: 1 } : { placement: 2 }),
          },
          occurredAtIso: detail.gameStartMillis
            ? new Date(detail.gameStartMillis).toISOString()
            : new Date().toISOString(),
          correlationId: `lol-poll-${detail.matchId}`,
        });
        enqueued += 1;
      }

      const seenMatchIds = [...newIds, ...cursor.seenMatchIds].slice(0, MAX_SEEN);
      await saveCursor(account.platformUserId, { puuid, seenMatchIds });
    } catch (error) {
      logger.error('Error polleando LoL', {
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

function buildSummary(detail: LolMatchSummary): string {
  const bits = ['LoL'];
  if (detail.mode) bits.push(detail.mode);
  if (detail.champion) bits.push(detail.champion);
  if (detail.role) bits.push(detail.role);
  if (detail.won === true) bits.push('Victoria');
  else if (detail.won === false) bits.push('Derrota');
  bits.push(`${detail.kills}/${detail.deaths}/${detail.assists}`);
  if (detail.cs != null) bits.push(`${detail.cs} CS`);
  return bits.join(' · ').slice(0, 200);
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

async function fetchRecentMatchIds(puuid: string, region: string, apiKey: string): Promise<string[]> {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=10`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
  if (!response.ok) {
    throw new Error(`LoL matchlist ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as string[];
  return Array.isArray(body) ? body.filter(Boolean) : [];
}

async function fetchMatchForPlayer(
  matchId: string,
  puuid: string,
  region: string,
  apiKey: string,
): Promise<LolMatchSummary | null> {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
  if (!response.ok) {
    logger.warn('No se pudo leer match LoL', { matchId, status: response.status });
    return null;
  }

  const body = (await response.json()) as {
    info?: {
      queueId?: number;
      gameStartTimestamp?: number;
      gameDuration?: number;
      participants?: Array<{
        puuid?: string;
        teamId?: number;
        championName?: string;
        teamPosition?: string;
        individualPosition?: string;
        kills?: number;
        deaths?: number;
        assists?: number;
        totalMinionsKilled?: number;
        neutralMinionsKilled?: number;
        visionScore?: number;
        win?: boolean;
        goldEarned?: number;
        champLevel?: number;
        item0?: number;
        item1?: number;
        item2?: number;
        item3?: number;
        item4?: number;
        item5?: number;
        item6?: number;
      }>;
      teams?: Array<{
        teamId?: number;
        objectives?: {
          baron?: { kills?: number };
          dragon?: { kills?: number };
          tower?: { kills?: number };
        };
      }>;
    };
    metadata?: { matchId?: string };
  };

  const player = body.info?.participants?.find((p) => p.puuid === puuid);
  if (!player) return null;

  const queueId = body.info?.queueId;
  const cs =
    Number(player.totalMinionsKilled ?? 0) + Number(player.neutralMinionsKilled ?? 0);
  const team = body.info?.teams?.find((t) => t.teamId === player.teamId);
  const items = [
    player.item0,
    player.item1,
    player.item2,
    player.item3,
    player.item4,
    player.item5,
    player.item6,
  ]
    .map((item) => Number(item ?? 0))
    .filter((item) => item > 0);

  return {
    matchId: body.metadata?.matchId ?? matchId,
    champion: player.championName,
    role: player.teamPosition || player.individualPosition,
    kills: Number(player.kills ?? 0),
    deaths: Number(player.deaths ?? 0),
    assists: Number(player.assists ?? 0),
    cs,
    visionScore: player.visionScore != null ? Number(player.visionScore) : undefined,
    won: player.win,
    queueId,
    mode: queueId != null ? QUEUE_MODE[queueId] ?? `Queue ${queueId}` : undefined,
    gameStartMillis: body.info?.gameStartTimestamp,
    durationSec: body.info?.gameDuration != null ? Number(body.info.gameDuration) : undefined,
    goldEarned: player.goldEarned != null ? Number(player.goldEarned) : undefined,
    champLevel: player.champLevel != null ? Number(player.champLevel) : undefined,
    items,
    teamObjectives: team
      ? {
          barons: Number(team.objectives?.baron?.kills ?? 0),
          dragons: Number(team.objectives?.dragon?.kills ?? 0),
          towers: Number(team.objectives?.tower?.kills ?? 0),
        }
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
