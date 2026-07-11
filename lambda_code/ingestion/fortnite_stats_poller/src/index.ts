import type { Handler } from 'aws-lambda';
import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoKeys, type GamePlatform } from '@stats-games/common';
import {
  ConsoleLogger,
  SqsGameIngestionQueuePublisherAdapter,
  getDocumentClient,
} from '@stats-games/infrastructure';

interface LinkedFortniteAccount {
  platformUserId: string;
  userId: string;
}

interface PlaylistSnapshot {
  matches: number;
  kills: number;
  deaths: number;
  wins: number;
}

interface CareerSnapshot {
  accountId?: string;
  displayName?: string;
  matches: number;
  kills: number;
  deaths: number;
  wins: number;
  score: number;
  lastModifiedIso?: string;
  solo: PlaylistSnapshot;
  duo: PlaylistSnapshot;
  squad: PlaylistSnapshot;
}

interface FortniteStatBlock {
  matches?: number;
  kills?: number;
  deaths?: number;
  wins?: number;
  score?: number;
  lastModified?: number;
}

interface FortniteApiStatsResponse {
  status?: number;
  data?: {
    account?: { id?: string; name?: string };
    stats?: {
      all?: {
        overall?: FortniteStatBlock;
        solo?: FortniteStatBlock;
        duo?: FortniteStatBlock;
        squad?: FortniteStatBlock;
      };
    };
  };
}

const PLATFORM: GamePlatform = 'fortnite';
const logger = new ConsoleLogger({ source: 'fortnite_stats_poller' });

/**
 * Route B: detecta partidas nuevas por diff de stats de carrera (fortnite-api.com)
 * y encola el mismo mensaje que game_ingestion → game_processor.
 *
 * Epic no expone webhooks de match-end; este patrón (igual que trackers públicos)
 * es la integración práctica sin partnership.
 */
export const handler: Handler = async () => {
  const apiKey = process.env['FORTNITE_API_KEY']?.trim();
  if (!apiKey) {
    logger.warn('FORTNITE_API_KEY vacío — poller no-op');
    return { ok: false, reason: 'missing_api_key', enqueued: 0 };
  }

  const accounts = await listLinkedFortniteAccounts();
  if (accounts.length === 0) {
    logger.info('Sin cuentas Fortnite vinculadas para poll');
    return { ok: true, enqueued: 0, accounts: 0 };
  }

  const publisher = new SqsGameIngestionQueuePublisherAdapter();
  let enqueued = 0;

  for (const account of accounts) {
    try {
      const current = await fetchCareerSnapshot(account.platformUserId, apiKey);
      if (!current) continue;

      const previous = await loadSnapshot(account.platformUserId);
      await saveSnapshot(account.platformUserId, current);

      if (!previous) {
        logger.info('Snapshot inicial guardado', {
          platformUserId: account.platformUserId,
          accountId: current.accountId,
          displayName: current.displayName,
          matches: current.matches,
        });
        continue;
      }

      const deltaMatches = current.matches - previous.matches;
      if (deltaMatches <= 0) continue;

      const kills = Math.max(0, current.kills - previous.kills);
      const deaths = Math.max(0, current.deaths - previous.deaths);
      const wins = Math.max(0, current.wins - previous.wins);
      const mode = inferPlaylistMode(previous, current);
      const occurredAtIso = current.lastModifiedIso ?? new Date().toISOString();
      const matchId = `fn-poll-${account.platformUserId}-${Date.parse(occurredAtIso) || Date.now()}-${current.matches}`;
      const avgKills = Math.round(kills / deltaMatches);
      const avgDeaths = Math.round(deaths / deltaMatches);
      const summary = buildSummary({
        mode,
        deltaMatches,
        wins,
        avgKills,
        displayName: current.displayName,
      });

      await publisher.enqueue({
        userId: account.userId,
        matchId,
        platform: PLATFORM,
        stats: {
          kills: avgKills,
          deaths: avgDeaths,
          ...(wins > 0 ? { placement: 1 } : {}),
          matchesInferred: deltaMatches,
          source: 'fortnite_stats_poller',
          mode,
          summary,
          epicAccountId: current.accountId ?? null,
          displayName: current.displayName ?? null,
        },
        occurredAtIso,
        correlationId: `poller-${matchId}`,
      });

      enqueued += 1;
      logger.info('Partida inferida encolada', {
        userId: account.userId,
        matchId,
        deltaMatches,
        mode,
        wins,
      });
    } catch (error) {
      logger.error('Error polleando cuenta Fortnite', {
        platformUserId: account.platformUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, accounts: accounts.length, enqueued };
};

async function listLinkedFortniteAccounts(): Promise<LinkedFortniteAccount[]> {
  const tableName = requireEnv('TABLE_NAME');
  const client = getDocumentClient();
  const accounts: LinkedFortniteAccount[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const page = await client.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'PLATFORM_ACCOUNT#fortnite#',
          ':sk': DynamoKeys.platformAccountSk(),
        },
        ExclusiveStartKey: exclusiveStartKey,
        ProjectionExpression: 'PK, userId',
      }),
    );

    for (const item of page.Items ?? []) {
      const pk = String(item['PK'] ?? '');
      const userId = item['userId'] ? String(item['userId']) : '';
      const platformUserId = pk.replace('PLATFORM_ACCOUNT#fortnite#', '');
      if (platformUserId && userId) {
        accounts.push({ platformUserId, userId });
      }
    }

    exclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return accounts;
}

async function fetchCareerSnapshot(
  epicAccountIdOrName: string,
  apiKey: string,
): Promise<CareerSnapshot | null> {
  const looksLikeId = /^[0-9a-f]{32}$/i.test(epicAccountIdOrName);
  const url = looksLikeId
    ? `https://fortnite-api.com/v2/stats/br/v2/${encodeURIComponent(epicAccountIdOrName)}`
    : `https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(epicAccountIdOrName)}`;

  const response = await fetch(url, {
    headers: { Authorization: apiKey },
  });

  if (response.status === 404) {
    logger.warn('Cuenta Fortnite no encontrada o stats privadas', { epicAccountIdOrName });
    return null;
  }

  if (!response.ok) {
    throw new Error(`fortnite-api ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as FortniteApiStatsResponse;
  const all = body.data?.stats?.all;
  const overall = all?.overall;
  if (!overall) return null;

  return {
    accountId: body.data?.account?.id,
    displayName: body.data?.account?.name,
    matches: Number(overall.matches ?? 0),
    kills: Number(overall.kills ?? 0),
    deaths: Number(overall.deaths ?? 0),
    wins: Number(overall.wins ?? 0),
    score: Number(overall.score ?? 0),
    lastModifiedIso: overall.lastModified
      ? new Date(overall.lastModified * 1000).toISOString()
      : undefined,
    solo: readPlaylist(all?.solo),
    duo: readPlaylist(all?.duo),
    squad: readPlaylist(all?.squad),
  };
}

function readPlaylist(block?: FortniteStatBlock): PlaylistSnapshot {
  return {
    matches: Number(block?.matches ?? 0),
    kills: Number(block?.kills ?? 0),
    deaths: Number(block?.deaths ?? 0),
    wins: Number(block?.wins ?? 0),
  };
}

function emptyPlaylist(): PlaylistSnapshot {
  return { matches: 0, kills: 0, deaths: 0, wins: 0 };
}

function inferPlaylistMode(previous: CareerSnapshot, current: CareerSnapshot): string {
  const deltas: Array<{ label: string; delta: number }> = [
    { label: 'Solo', delta: current.solo.matches - previous.solo.matches },
    { label: 'Duo', delta: current.duo.matches - previous.duo.matches },
    { label: 'Squad', delta: current.squad.matches - previous.squad.matches },
  ];
  deltas.sort((a, b) => b.delta - a.delta);
  const top = deltas[0];
  if (top && top.delta > 0) return top.label;
  return 'Battle Royale';
}

function buildSummary(input: {
  mode: string;
  deltaMatches: number;
  wins: number;
  avgKills: number;
  displayName?: string;
}): string {
  const bits = ['Fortnite', input.mode];
  if (input.wins > 0) bits.push('Victoria');
  if (input.deltaMatches > 1) {
    bits.push(`+${input.deltaMatches} partidas`);
  } else if (input.avgKills >= 0) {
    bits.push(`${input.avgKills} kills`);
  }
  const summary = bits.join(' · ');
  return summary.length > 200 ? summary.slice(0, 200) : summary;
}

async function loadSnapshot(platformUserId: string): Promise<CareerSnapshot | null> {
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
  return {
    accountId: result.Item['accountId'] ? String(result.Item['accountId']) : undefined,
    displayName: result.Item['displayName'] ? String(result.Item['displayName']) : undefined,
    matches: Number(result.Item['matches'] ?? 0),
    kills: Number(result.Item['kills'] ?? 0),
    deaths: Number(result.Item['deaths'] ?? 0),
    wins: Number(result.Item['wins'] ?? 0),
    score: Number(result.Item['score'] ?? 0),
    lastModifiedIso: result.Item['lastModifiedIso']
      ? String(result.Item['lastModifiedIso'])
      : undefined,
    solo: readStoredPlaylist(result.Item['solo']),
    duo: readStoredPlaylist(result.Item['duo']),
    squad: readStoredPlaylist(result.Item['squad']),
  };
}

function readStoredPlaylist(value: unknown): PlaylistSnapshot {
  if (!value || typeof value !== 'object') return emptyPlaylist();
  const record = value as Record<string, unknown>;
  return {
    matches: Number(record['matches'] ?? 0),
    kills: Number(record['kills'] ?? 0),
    deaths: Number(record['deaths'] ?? 0),
    wins: Number(record['wins'] ?? 0),
  };
}

async function saveSnapshot(platformUserId: string, snapshot: CareerSnapshot): Promise<void> {
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
        accountId: snapshot.accountId ?? null,
        displayName: snapshot.displayName ?? null,
        matches: snapshot.matches,
        kills: snapshot.kills,
        deaths: snapshot.deaths,
        wins: snapshot.wins,
        score: snapshot.score,
        lastModifiedIso: snapshot.lastModifiedIso ?? null,
        solo: snapshot.solo,
        duo: snapshot.duo,
        squad: snapshot.squad,
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
