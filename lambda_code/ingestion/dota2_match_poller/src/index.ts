import type { Handler } from 'aws-lambda';
import type { GamePlatform } from '@stats-games/common';
import {
  ConsoleLogger,
  DynamoDbPlatformPollerStateAdapter,
  SqsGameIngestionQueuePublisherAdapter,
} from '@stats-games/infrastructure';

interface DotaCursor extends Record<string, unknown> {
  seenMatchIds?: string[];
}

interface DotaHistoryMatch {
  match_id?: number;
  start_time?: number;
}

interface DotaMatchDetail {
  match_id?: number;
  start_time?: number;
  game_mode?: number;
  radiant_win?: boolean;
  players?: Array<{
    account_id?: number;
    player_slot?: number;
    hero_id?: number;
    kills?: number;
    deaths?: number;
    assists?: number;
    gold_per_min?: number;
    xp_per_min?: number;
  }>;
}

const PLATFORM: GamePlatform = 'dota2';
const logger = new ConsoleLogger({ source: 'dota2_match_poller' });
const MAX_SEEN = 40;
const STEAM_ID_OFFSET = 76561197960265728n;

export const handler: Handler = async () => {
  const apiKey = process.env['STEAM_WEB_API_KEY']?.trim() || process.env['DOTA2_API_KEY']?.trim();
  if (!apiKey) {
    logger.warn('STEAM_WEB_API_KEY/DOTA2_API_KEY vacío — poller Dota 2 no-op');
    return { ok: false, reason: 'missing_api_key', enqueued: 0 };
  }

  const state = new DynamoDbPlatformPollerStateAdapter();
  const accounts = await state.listLinkedAccounts(PLATFORM);
  if (accounts.length === 0) return { ok: true, accounts: 0, enqueued: 0 };

  const publisher = new SqsGameIngestionQueuePublisherAdapter();
  let enqueued = 0;

  for (const account of accounts) {
    try {
      const accountId = steamId64ToAccountId(account.platformUserId);
      if (accountId == null) {
        logger.warn('SteamID64 inválido para Dota 2', { platformUserId: account.platformUserId });
        continue;
      }

      const cursor = (await state.loadCursor<DotaCursor>(PLATFORM, account.platformUserId)) ?? {};
      const seenMatchIds = (cursor.seenMatchIds ?? []).map(String);
      const history = await fetchRecentMatches(accountId, apiKey);
      const fresh = history.filter((m) => m.match_id && !seenMatchIds.includes(String(m.match_id)));

      for (const item of fresh.slice(0, 5)) {
        if (!item.match_id) continue;
        const detail = await fetchMatchDetail(item.match_id, apiKey);
        const player = detail.players?.find((p) => p.account_id === accountId);
        if (!player) continue;

        const radiant = Number(player.player_slot ?? 128) < 128;
        const won = radiant ? detail.radiant_win === true : detail.radiant_win === false;
        const kills = Number(player.kills ?? 0);
        const deaths = Number(player.deaths ?? 0);
        const assists = Number(player.assists ?? 0);
        const hero = `Hero ${player.hero_id ?? 'unknown'}`;
        const summary = ['Dota 2', won ? 'Victoria' : 'Derrota', hero, `${kills}/${deaths}/${assists}`]
          .join(' · ')
          .slice(0, 200);

        await publisher.enqueue({
          userId: account.userId,
          matchId: `dota2-${item.match_id}`,
          platform: PLATFORM,
          stats: {
            kills,
            deaths,
            assists,
            hero,
            heroId: player.hero_id ?? null,
            gpm: player.gold_per_min ?? null,
            xpm: player.xp_per_min ?? null,
            mode: modeName(detail.game_mode),
            won,
            placement: won ? 1 : 2,
            summary,
            source: 'dota2_match_poller',
          },
          occurredAtIso: unixSecondsToIso(detail.start_time ?? item.start_time),
          correlationId: `dota2-poll-${item.match_id}`,
        });
        enqueued += 1;
      }

      const merged = [
        ...fresh.map((m) => String(m.match_id)).filter(Boolean),
        ...seenMatchIds,
      ].slice(0, MAX_SEEN);
      await state.saveCursor(PLATFORM, account.platformUserId, { seenMatchIds: merged });
    } catch (error) {
      logger.error('Error polleando Dota 2', {
        platformUserId: account.platformUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, accounts: accounts.length, enqueued };
};

async function fetchRecentMatches(accountId: number, apiKey: string): Promise<DotaHistoryMatch[]> {
  const url = new URL('https://api.steampowered.com/IDOTA2Match_570/GetMatchHistory/v1/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('account_id', String(accountId));
  url.searchParams.set('matches_requested', '10');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Dota 2 match history ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as { result?: { matches?: DotaHistoryMatch[] } };
  return body.result?.matches ?? [];
}

async function fetchMatchDetail(matchId: number, apiKey: string): Promise<DotaMatchDetail> {
  const url = new URL('https://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/v1/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('match_id', String(matchId));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Dota 2 match detail ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as { result?: DotaMatchDetail };
  return body.result ?? {};
}

function steamId64ToAccountId(raw: string): number | null {
  if (!/^\d{17}$/.test(raw)) return null;
  const accountId = BigInt(raw) - STEAM_ID_OFFSET;
  if (accountId <= 0n || accountId > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(accountId);
}

function unixSecondsToIso(value: number | undefined): string {
  return value ? new Date(value * 1000).toISOString() : new Date().toISOString();
}

function modeName(mode: number | undefined): string {
  const names: Record<number, string> = {
    1: 'All Pick',
    2: "Captain's Mode",
    22: 'Ranked All Pick',
  };
  return mode ? names[mode] ?? `Mode ${mode}` : 'Dota 2';
}
