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

interface ClashBattlePlayer {
  tag?: string;
  name?: string;
  crowns?: number;
  startingTrophies?: number;
  trophyChange?: number;
}

interface ClashBattle {
  battleTime?: string;
  type?: string;
  gameMode?: { name?: string };
  team?: ClashBattlePlayer[];
  opponent?: ClashBattlePlayer[];
}

const PLATFORM: GamePlatform = 'clash_royale';
const logger = new ConsoleLogger({ source: 'clash_royale_match_poller' });
const MAX_SEEN = 40;

export const handler: Handler = async () => {
  const apiKey = process.env['SUPERCELL_API_KEY']?.trim() || process.env['CLASH_ROYALE_API_KEY']?.trim();
  if (!apiKey) {
    logger.warn('SUPERCELL_API_KEY/CLASH_ROYALE_API_KEY vacío — poller Clash Royale no-op');
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
      const fresh = battles.filter((battle) => {
        const id = battleId(account.platformUserId, battle);
        return id && !seenBattleIds.includes(id);
      });

      for (const battle of fresh.slice(0, 8)) {
        const id = battleId(account.platformUserId, battle);
        if (!id) continue;

        const player = findPlayer(battle.team, account.platformUserId);
        const opponentCrowns = maxCrowns(battle.opponent);
        const crowns = Number(player?.crowns ?? 0);
        const won = crowns > opponentCrowns;
        const mode = battle.gameMode?.name ?? battle.type ?? 'Clash Royale';
        const summary = ['Clash Royale', mode, won ? 'Victoria' : 'Derrota', `${crowns}-${opponentCrowns}`]
          .join(' · ')
          .slice(0, 200);

        await publisher.enqueue({
          userId: account.userId,
          matchId: `cr-${id}`,
          platform: PLATFORM,
          stats: {
            crowns,
            trophies: player?.startingTrophies ?? null,
            trophyChange: player?.trophyChange ?? null,
            opponentCrowns,
            kills: crowns,
            deaths: 0,
            score: crowns,
            mode,
            won,
            placement: won ? 1 : 2,
            summary,
            source: 'clash_royale_match_poller',
          },
          occurredAtIso: supercellTimeToIso(battle.battleTime),
          correlationId: `cr-poll-${id}`,
        });
        enqueued += 1;
      }

      const merged = [
        ...fresh.map((battle) => battleId(account.platformUserId, battle)).filter((id): id is string => !!id),
        ...seenBattleIds,
      ].slice(0, MAX_SEEN);
      await state.saveCursor(PLATFORM, account.platformUserId, { seenBattleIds: merged });
    } catch (error) {
      logger.error('Error polleando Clash Royale', {
        platformUserId: account.platformUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, accounts: accounts.length, enqueued };
};

async function fetchBattleLog(playerTag: string, apiKey: string): Promise<ClashBattle[]> {
  const url = `https://api.clashroyale.com/v1/players/${encodeURIComponent(playerTag)}/battlelog`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Clash Royale battlelog ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as ClashBattle[];
  return Array.isArray(body) ? body : [];
}

function findPlayer(players: ClashBattlePlayer[] | undefined, tag: string): ClashBattlePlayer | undefined {
  const normalized = normalizeTag(tag);
  return players?.find((player) => normalizeTag(player.tag) === normalized);
}

function maxCrowns(players: ClashBattlePlayer[] | undefined): number {
  return Math.max(0, ...(players ?? []).map((player) => Number(player.crowns ?? 0)));
}

function battleId(playerTag: string, battle: ClashBattle): string | null {
  return battle.battleTime ? `${normalizeTag(playerTag)}-${battle.battleTime}` : null;
}

function normalizeTag(tag: string | undefined): string {
  return (tag ?? '').replace(/^#/, '').toUpperCase();
}

function supercellTimeToIso(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const iso = value.replace(/^(\d{4})(\d{2})(\d{2})T/, '$1-$2-$3T').replace(/(\d{2})(\d{2})(\d{2})\.\d+Z$/, '$1:$2:$3Z');
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}
