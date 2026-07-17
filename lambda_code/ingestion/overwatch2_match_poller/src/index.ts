import type { Handler } from 'aws-lambda';
import type { GamePlatform } from '@stats-games/common';
import {
  ConsoleLogger,
  DynamoDbPlatformPollerStateAdapter,
  SqsGameIngestionQueuePublisherAdapter,
} from '@stats-games/infrastructure';

interface OverwatchCursor extends Record<string, unknown> {
  seenMatchIds?: string[];
}

interface OverwatchMatch {
  matchId?: string;
  id?: string;
  occurredAt?: string;
  map?: string;
  mode?: string;
  hero?: string;
  role?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  damage?: number;
  healing?: number;
  won?: boolean;
}

const PLATFORM: GamePlatform = 'overwatch2';
const logger = new ConsoleLogger({ source: 'overwatch2_match_poller' });
const MAX_SEEN = 40;

/**
 * Overwatch 2 no tiene un match history público oficial estable.
 * Este adapter consume una API partner/bridge configurable que debe devolver:
 * { matches: OverwatchMatch[] } para /players/{battleTag}/matches?limit=10
 */
export const handler: Handler = async () => {
  const apiUrl = process.env['OVERWATCH2_API_URL']?.trim();
  if (!apiUrl) {
    logger.warn('OVERWATCH2_API_URL vacío — poller Overwatch 2 no-op (webhook OK)');
    return { ok: false, reason: 'missing_api_url', enqueued: 0 };
  }

  const apiKey = process.env['OVERWATCH2_API_KEY']?.trim();
  const state = new DynamoDbPlatformPollerStateAdapter();
  const accounts = await state.listLinkedAccounts(PLATFORM);
  if (accounts.length === 0) return { ok: true, accounts: 0, enqueued: 0 };

  const publisher = new SqsGameIngestionQueuePublisherAdapter();
  let enqueued = 0;

  for (const account of accounts) {
    try {
      const cursor = (await state.loadCursor<OverwatchCursor>(PLATFORM, account.platformUserId)) ?? {};
      const seenMatchIds = (cursor.seenMatchIds ?? []).map(String);
      const matches = await fetchRecentMatches(apiUrl, account.platformUserId, apiKey);
      const fresh = matches.filter((match) => {
        const id = match.matchId ?? match.id;
        return id && !seenMatchIds.includes(id);
      });

      for (const match of fresh.slice(0, 5)) {
        const id = match.matchId ?? match.id;
        if (!id) continue;
        const kills = Number(match.kills ?? 0);
        const deaths = Number(match.deaths ?? 0);
        const assists = Number(match.assists ?? 0);
        const summary = [
          'Overwatch 2',
          match.mode,
          match.map,
          match.hero,
          match.won === true ? 'Victoria' : match.won === false ? 'Derrota' : null,
          `${kills}/${deaths}/${assists}`,
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 200);

        await publisher.enqueue({
          userId: account.userId,
          matchId: `ow2-${id}`,
          platform: PLATFORM,
          stats: {
            kills,
            deaths,
            assists,
            damage: match.damage ?? null,
            healing: match.healing ?? null,
            hero: match.hero ?? null,
            role: match.role ?? null,
            map: match.map ?? null,
            mode: match.mode ?? null,
            won: match.won ?? null,
            placement: match.won === true ? 1 : match.won === false ? 2 : null,
            summary,
            source: 'overwatch2_match_poller',
          },
          occurredAtIso: match.occurredAt ?? new Date().toISOString(),
          correlationId: `ow2-poll-${id}`,
        });
        enqueued += 1;
      }

      const merged = [
        ...fresh.map((match) => match.matchId ?? match.id).filter((id): id is string => !!id),
        ...seenMatchIds,
      ].slice(0, MAX_SEEN);
      await state.saveCursor(PLATFORM, account.platformUserId, { seenMatchIds: merged });
    } catch (error) {
      logger.error('Error polleando Overwatch 2', {
        platformUserId: account.platformUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, accounts: accounts.length, enqueued };
};

async function fetchRecentMatches(
  baseUrl: string,
  battleTag: string,
  apiKey?: string,
): Promise<OverwatchMatch[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/players/${encodeURIComponent(battleTag)}/matches?limit=10`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`Overwatch 2 API ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as { matches?: OverwatchMatch[] };
  return body.matches ?? [];
}
