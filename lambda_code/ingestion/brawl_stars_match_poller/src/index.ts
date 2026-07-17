import type { Handler } from 'aws-lambda';
import type { GamePlatform } from '@stats-games/common';
import {
  ConsoleLogger,
  DynamoDbPlatformPollerStateAdapter,
  SqsGameIngestionQueuePublisherAdapter,
} from '@stats-games/infrastructure';

interface BattleCursor extends Record<string, unknown> {
  seenBattleIds?: string[];
}

interface BrawlBattlePlayer {
  tag?: string;
  name?: string;
  brawler?: { name?: string; trophies?: number };
}

interface BrawlBattleItem {
  battleTime?: string;
  event?: { mode?: string; map?: string };
  battle?: {
    mode?: string;
    type?: string;
    result?: string;
    duration?: number;
    trophyChange?: number;
    starPlayer?: BrawlBattlePlayer;
    teams?: BrawlBattlePlayer[][];
    players?: BrawlBattlePlayer[];
  };
}

const PLATFORM: GamePlatform = 'brawl_stars';
const logger = new ConsoleLogger({ source: 'brawl_stars_match_poller' });
const MAX_SEEN = 40;

export const handler: Handler = async () => {
  const apiKey = process.env['SUPERCELL_API_KEY']?.trim() || process.env['BRAWL_STARS_API_KEY']?.trim();
  if (!apiKey) {
    logger.warn('SUPERCELL_API_KEY/BRAWL_STARS_API_KEY vacío — poller Brawl Stars no-op');
    return { ok: false, reason: 'missing_api_key', enqueued: 0 };
  }

  const state = new DynamoDbPlatformPollerStateAdapter();
  const accounts = await state.listLinkedAccounts(PLATFORM);
  if (accounts.length === 0) return { ok: true, accounts: 0, enqueued: 0 };

  const publisher = new SqsGameIngestionQueuePublisherAdapter();
  let enqueued = 0;

  for (const account of accounts) {
    try {
      const cursor = (await state.loadCursor<BattleCursor>(PLATFORM, account.platformUserId)) ?? {};
      const seenBattleIds = (cursor.seenBattleIds ?? []).map(String);
      const battles = await fetchBattleLog(account.platformUserId, apiKey);
      const fresh = battles.filter((item) => {
        const id = battleId(account.platformUserId, item);
        return id && !seenBattleIds.includes(id);
      });

      for (const item of fresh.slice(0, 8)) {
        const id = battleId(account.platformUserId, item);
        if (!id) continue;

        const player = findPlayer(item, account.platformUserId);
        const won = item.battle?.result?.toLowerCase() === 'victory';
        const mode = item.event?.mode ?? item.battle?.mode ?? item.battle?.type ?? 'Brawl Stars';
        const map = item.event?.map;
        const brawler = player?.brawler?.name ?? item.battle?.starPlayer?.brawler?.name;
        const trophies = player?.brawler?.trophies;
        const summary = ['Brawl Stars', mode, map, won ? 'Victoria' : 'Derrota', brawler]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 200);

        await publisher.enqueue({
          userId: account.userId,
          matchId: `bs-${id}`,
          platform: PLATFORM,
          stats: {
            kills: won ? 1 : 0,
            deaths: won ? 0 : 1,
            assists: 0,
            brawler: brawler ?? null,
            trophies: trophies ?? null,
            trophyChange: item.battle?.trophyChange ?? null,
            mode,
            map: map ?? null,
            durationSec: item.battle?.duration ?? null,
            won,
            placement: won ? 1 : 2,
            summary,
            source: 'brawl_stars_match_poller',
          },
          occurredAtIso: supercellTimeToIso(item.battleTime),
          correlationId: `bs-poll-${id}`,
        });
        enqueued += 1;
      }

      const merged = [
        ...fresh.map((item) => battleId(account.platformUserId, item)).filter((id): id is string => !!id),
        ...seenBattleIds,
      ].slice(0, MAX_SEEN);
      await state.saveCursor(PLATFORM, account.platformUserId, { seenBattleIds: merged });
    } catch (error) {
      logger.error('Error polleando Brawl Stars', {
        platformUserId: account.platformUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, accounts: accounts.length, enqueued };
};

async function fetchBattleLog(playerTag: string, apiKey: string): Promise<BrawlBattleItem[]> {
  const url = `https://api.brawlstars.com/v1/players/${encodeURIComponent(playerTag)}/battlelog`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Brawl Stars battlelog ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as { items?: BrawlBattleItem[] };
  return body.items ?? [];
}

function findPlayer(item: BrawlBattleItem, tag: string): BrawlBattlePlayer | undefined {
  const normalized = normalizeTag(tag);
  const players = item.battle?.players ?? item.battle?.teams?.flat() ?? [];
  return players.find((player) => normalizeTag(player.tag) === normalized);
}

function battleId(playerTag: string, item: BrawlBattleItem): string | null {
  return item.battleTime ? `${normalizeTag(playerTag)}-${item.battleTime}` : null;
}

function normalizeTag(tag: string | undefined): string {
  return (tag ?? '').replace(/^#/, '').toUpperCase();
}

function supercellTimeToIso(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const iso = value
    .replace(/^(\d{4})(\d{2})(\d{2})T/, '$1-$2-$3T')
    .replace(/(\d{2})(\d{2})(\d{2})\.\d+Z$/, '$1:$2:$3Z');
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}
