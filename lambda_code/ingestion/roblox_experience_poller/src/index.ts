import type { Handler } from 'aws-lambda';
import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  DynamoKeys,
  ROBLOX_EXPERIENCE_LIST,
  allTrackedRobloxBadges,
  isCompetitiveBadge,
  type GamePlatform,
  type RobloxExperienceConfig,
} from '@stats-games/common';
import {
  ConsoleLogger,
  SqsGameIngestionQueuePublisherAdapter,
  getDocumentClient,
} from '@stats-games/infrastructure';

/**
 * Roblox especializado: BedWars + Arsenal.
 *
 * La lista de badges del usuario exige auth; usamos inventory ownership
 * contra un set curado (+ refresh desde universe badges API).
 */

interface LinkedAccount {
  platformUserId: string;
  userId: string;
}

interface OwnedBadge {
  badgeId: string;
  name: string;
  experience: RobloxExperienceConfig;
  competitive: boolean;
}

interface PollCursor {
  ownedBadgeIds: string[];
}

const PLATFORM: GamePlatform = 'roblox';
const logger = new ConsoleLogger({ source: 'roblox_experience_poller' });
const MAX_SEEN = 200;

export const handler: Handler = async () => {
  const accounts = await listLinkedRobloxAccounts();
  if (accounts.length === 0) {
    return { ok: true, enqueued: 0, accounts: 0 };
  }

  const catalog = await loadBadgeCatalog();
  const publisher = new SqsGameIngestionQueuePublisherAdapter();
  let enqueued = 0;

  for (const account of accounts) {
    try {
      const owned = await fetchOwnedTrackedBadges(account.platformUserId, catalog);
      const cursor = (await loadCursor(account.platformUserId)) ?? { ownedBadgeIds: [] };
      const previous = new Set(cursor.ownedBadgeIds);
      const fresh = owned.filter((b) => !previous.has(b.badgeId));

      if (cursor.ownedBadgeIds.length === 0) {
        await saveCursor(account.platformUserId, {
          ownedBadgeIds: owned.map((b) => b.badgeId).slice(0, MAX_SEEN),
        });
        logger.info('Baseline BedWars/Arsenal guardado', {
          platformUserId: account.platformUserId,
          owned: owned.length,
        });
        continue;
      }

      for (const badge of fresh.slice(0, 8)) {
        const summary = [
          'Roblox',
          badge.experience.label,
          badge.competitive ? 'Hito competitivo' : 'Badge',
          badge.name,
        ]
          .join(' · ')
          .slice(0, 200);

        await publisher.enqueue({
          userId: account.userId,
          matchId: `rbx-${badge.experience.id}-${badge.badgeId}`,
          platform: PLATFORM,
          stats: {
            source: 'roblox_experience_poller',
            experienceId: badge.experience.id,
            experienceName: badge.experience.label,
            placeId: String(badge.experience.placeId),
            universeId: String(badge.experience.universeId),
            mode: badge.experience.label,
            map: badge.experience.label,
            badgeId: badge.badgeId,
            badgeName: badge.name,
            competitive: badge.competitive,
            summary,
            kills: badge.competitive ? 1 : 0,
            deaths: 0,
            placement: badge.competitive ? 1 : null,
          },
          occurredAtIso: new Date().toISOString(),
          correlationId: `rbx-badge-${badge.badgeId}`,
        });
        enqueued += 1;
      }

      const merged = [...new Set([...owned.map((b) => b.badgeId), ...cursor.ownedBadgeIds])].slice(
        0,
        MAX_SEEN,
      );
      await saveCursor(account.platformUserId, { ownedBadgeIds: merged });
    } catch (error) {
      logger.error('Error polleando BedWars/Arsenal', {
        platformUserId: account.platformUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, accounts: accounts.length, enqueued, catalogSize: catalog.length };
};

type CatalogEntry = ReturnType<typeof allTrackedRobloxBadges>[number];

async function loadBadgeCatalog(): Promise<CatalogEntry[]> {
  const base = allTrackedRobloxBadges();
  const byId = new Map(base.map((b) => [b.id, b]));

  for (const experience of ROBLOX_EXPERIENCE_LIST) {
    try {
      const remote = await fetchUniverseBadges(experience.universeId);
      for (const badge of remote) {
        const id = Number(badge.id);
        const name = String(badge.name ?? '');
        if (!id || !name) continue;
        const competitive = isCompetitiveBadge(experience, name);
        // BedWars: pocos badges → trackear todos. Arsenal: solo competitivos + curados.
        if (experience.id === 'bedwars' || competitive || byId.has(id)) {
          byId.set(id, { id, name, competitive, experience });
        }
      }
    } catch (error) {
      logger.warn('No se pudo refrescar badges del universe', {
        experience: experience.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return [...byId.values()];
}

async function fetchUniverseBadges(
  universeId: number,
): Promise<Array<{ id?: number; name?: string }>> {
  const out: Array<{ id?: number; name?: string }> = [];
  let cursor: string | null = null;
  for (let page = 0; page < 8; page += 1) {
    const qs = new URLSearchParams({ limit: '100', sortOrder: 'Asc' });
    if (cursor) qs.set('cursor', cursor);
    const url = `https://badges.roblox.com/v1/universes/${universeId}/badges?${qs}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'StatsGames/1.0' },
    });
    if (!response.ok) {
      throw new Error(`universe badges ${response.status}`);
    }
    const body = (await response.json()) as {
      data?: Array<{ id?: number; name?: string }>;
      nextPageCursor?: string | null;
    };
    out.push(...(body.data ?? []));
    cursor = body.nextPageCursor ?? null;
    if (!cursor) break;
  }
  return out;
}

async function fetchOwnedTrackedBadges(
  robloxUserId: string,
  catalog: CatalogEntry[],
): Promise<OwnedBadge[]> {
  const owned: OwnedBadge[] = [];
  for (const badge of catalog) {
    const has = await userOwnsBadge(robloxUserId, badge.id);
    if (!has) continue;
    owned.push({
      badgeId: String(badge.id),
      name: badge.name,
      experience: badge.experience,
      competitive: badge.competitive,
    });
  }
  return owned;
}

async function userOwnsBadge(robloxUserId: string, badgeId: number): Promise<boolean> {
  const url = `https://inventory.roblox.com/v1/users/${encodeURIComponent(robloxUserId)}/items/Badge/${badgeId}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'StatsGames/1.0' },
  });
  if (response.status === 400 || response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`inventory badge ${badgeId}: ${response.status}`);
  }
  const body = (await response.json()) as { data?: unknown[] };
  return Array.isArray(body.data) && body.data.length > 0;
}

async function listLinkedRobloxAccounts(): Promise<LinkedAccount[]> {
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
          ':pk': 'PLATFORM_ACCOUNT#roblox#',
          ':sk': DynamoKeys.platformAccountSk(),
        },
        ExclusiveStartKey: exclusiveStartKey,
        ProjectionExpression: 'PK, userId',
      }),
    );

    for (const item of page.Items ?? []) {
      const pk = String(item['PK'] ?? '');
      const userId = item['userId'] ? String(item['userId']) : '';
      const platformUserId = pk.replace('PLATFORM_ACCOUNT#roblox#', '');
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
        PK: DynamoKeys.statsSnapshotPk(PLATFORM, `${platformUserId}#experiences`),
        SK: DynamoKeys.statsSnapshotSk(),
      },
    }),
  );
  if (!result.Item) return null;
  const owned = Array.isArray(result.Item['ownedBadgeIds'])
    ? result.Item['ownedBadgeIds'].map(String)
    : Array.isArray(result.Item['seenBadgeIds'])
      ? result.Item['seenBadgeIds'].map(String)
      : [];
  return { ownedBadgeIds: owned };
}

async function saveCursor(platformUserId: string, cursor: PollCursor): Promise<void> {
  const tableName = requireEnv('TABLE_NAME');
  const client = getDocumentClient();
  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: DynamoKeys.statsSnapshotPk(PLATFORM, `${platformUserId}#experiences`),
        SK: DynamoKeys.statsSnapshotSk(),
        entityType: 'STATS_SNAPSHOT',
        platform: PLATFORM,
        platformUserId,
        tracked: ['bedwars', 'arsenal'],
        ownedBadgeIds: cursor.ownedBadgeIds,
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
