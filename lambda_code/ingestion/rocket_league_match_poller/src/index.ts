import type { Handler } from 'aws-lambda';
import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoKeys, type GamePlatform } from '@stats-games/common';
import {
  ConsoleLogger,
  SqsGameIngestionQueuePublisherAdapter,
  getDocumentClient,
} from '@stats-games/infrastructure';

/**
 * Rocket League — Fase 1.
 *
 * Psyonix cerró la API pública de match history. Integración práctica:
 *   1) Preferida MVP: companion / webhook (`send:match --platform rocket_league`)
 *   2) Poller opcional vía ballchasing.com (replays subidos / API key)
 *
 * Env:
 *   BALLCHASING_API_KEY — si vacío, poller no-op (el pipeline igual acepta webhooks)
 */

interface LinkedAccount {
  platformUserId: string;
  userId: string;
}

interface PollCursor {
  seenReplayIds: string[];
}

interface BallchasingReplay {
  id?: string;
  created?: string;
  map_name?: string;
  playlist_id?: string;
  blue?: { players?: BallchasingPlayer[] };
  orange?: { players?: BallchasingPlayer[] };
}

interface BallchasingPlayer {
  name?: string;
  id?: { id?: string; platform?: string };
  score?: number;
  goals?: number;
  assists?: number;
  saves?: number;
  shots?: number;
  shooting_percentage?: number;
}

const PLATFORM: GamePlatform = 'rocket_league';
const logger = new ConsoleLogger({ source: 'rocket_league_match_poller' });
const MAX_SEEN = 40;

export const handler: Handler = async () => {
  const apiKey = process.env['BALLCHASING_API_KEY']?.trim();
  if (!apiKey) {
    logger.warn('BALLCHASING_API_KEY vacío — poller RL no-op (usá webhook/companion)');
    return { ok: false, reason: 'missing_api_key', enqueued: 0 };
  }

  const accounts = await listLinkedAccounts();
  if (accounts.length === 0) {
    return { ok: true, enqueued: 0, accounts: 0 };
  }

  const publisher = new SqsGameIngestionQueuePublisherAdapter();
  let enqueued = 0;

  for (const account of accounts) {
    try {
      const cursor = (await loadCursor(account.platformUserId)) ?? { seenReplayIds: [] };
      const replays = await fetchRecentReplays(account.platformUserId, apiKey);
      const fresh = replays.filter((r) => r.id && !cursor.seenReplayIds.includes(r.id));

      for (const replay of fresh.slice(0, 5)) {
        if (!replay.id) continue;
        const player = findPlayer(replay, account.platformUserId);
        const goals = Number(player?.goals ?? 0);
        const assists = Number(player?.assists ?? 0);
        const saves = Number(player?.saves ?? 0);
        const shots = Number(player?.shots ?? 0);
        const score = Number(player?.score ?? 0);
        const playlist = replay.playlist_id ?? 'competitive';
        const summary = [
          'Rocket League',
          playlist,
          replay.map_name,
          `${goals}G ${assists}A ${saves}S`,
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 200);

        await publisher.enqueue({
          userId: account.userId,
          matchId: `rl-${replay.id}`,
          platform: PLATFORM,
          stats: {
            goals,
            assists,
            saves,
            shots,
            score,
            kills: goals,
            deaths: 0,
            placement: null,
            map: replay.map_name ?? null,
            mode: playlist,
            shotPct: player?.shooting_percentage ?? null,
            summary,
            source: 'rocket_league_match_poller',
          },
          occurredAtIso: replay.created
            ? new Date(replay.created).toISOString()
            : new Date().toISOString(),
          correlationId: `rl-poll-${replay.id}`,
        });
        enqueued += 1;
      }

      const seenReplayIds = [
        ...fresh.map((r) => r.id).filter((id): id is string => !!id),
        ...cursor.seenReplayIds,
      ].slice(0, MAX_SEEN);
      await saveCursor(account.platformUserId, { seenReplayIds });
    } catch (error) {
      logger.error('Error polleando Rocket League', {
        platformUserId: account.platformUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, accounts: accounts.length, enqueued };
};

function findPlayer(replay: BallchasingReplay, platformUserId: string): BallchasingPlayer | undefined {
  const needle = platformUserId.toLowerCase();
  const all = [...(replay.blue?.players ?? []), ...(replay.orange?.players ?? [])];
  return all.find(
    (p) =>
      p.name?.toLowerCase() === needle ||
      p.id?.id?.toLowerCase() === needle ||
      p.name?.toLowerCase().includes(needle),
  );
}

async function fetchRecentReplays(
  playerName: string,
  apiKey: string,
): Promise<BallchasingReplay[]> {
  const url = `https://ballchasing.com/api/replays?player-name=${encodeURIComponent(playerName)}&count=10`;
  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) {
    throw new Error(`ballchasing ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as { list?: BallchasingReplay[] };
  return body.list ?? [];
}

async function listLinkedAccounts(): Promise<LinkedAccount[]> {
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
          ':pk': `PLATFORM_ACCOUNT#${PLATFORM}#`,
          ':sk': DynamoKeys.platformAccountSk(),
        },
        ExclusiveStartKey: exclusiveStartKey,
        ProjectionExpression: 'PK, userId',
      }),
    );

    for (const item of page.Items ?? []) {
      const pk = String(item['PK'] ?? '');
      const userId = item['userId'] ? String(item['userId']) : '';
      const platformUserId = pk.replace(`PLATFORM_ACCOUNT#${PLATFORM}#`, '');
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
  const seen = Array.isArray(result.Item['seenReplayIds'])
    ? result.Item['seenReplayIds'].map(String)
    : [];
  return { seenReplayIds: seen };
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
        seenReplayIds: cursor.seenReplayIds,
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
