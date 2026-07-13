import type { Match } from '@stats-games/domain';
import type { MatchStatsDto, MatchUpdateDto } from '../dto/event-network/match-update.dto';

function toOptionalInt(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : undefined;
}

function toOptionalFloat(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function toOptionalBool(value: unknown): boolean | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

function extractStats(record: Record<string, unknown>): MatchStatsDto | undefined {
  const kills = toOptionalInt(record['kills'] ?? record['eliminations']);
  const deaths = toOptionalInt(record['deaths']);
  const placement = toOptionalInt(record['placement'] ?? record['rank']);
  const assists = toOptionalInt(record['assists']);
  const headshotPct = toOptionalFloat(record['headshotPct']);
  const roundsWon = toOptionalInt(record['roundsWon']);
  const roundsLost = toOptionalInt(record['roundsLost']);
  const map = toOptionalString(record['map']);
  const agent = toOptionalString(record['agent']);
  const mode = toOptionalString(record['mode']);
  const won = toOptionalBool(record['won']);

  if (
    kills == null &&
    deaths == null &&
    placement == null &&
    assists == null &&
    headshotPct == null &&
    roundsWon == null &&
    roundsLost == null &&
    map == null &&
    agent == null &&
    mode == null &&
    won == null
  ) {
    return undefined;
  }

  return {
    kills,
    deaths,
    placement,
    assists,
    headshotPct,
    roundsWon,
    roundsLost,
    map,
    agent,
    mode,
    won,
  };
}

export const MatchMapper = {
  toUpdateDto(match: Match): MatchUpdateDto {
    const stats = extractStats(match.stats.toRecord());
    return {
      userId: match.userId,
      matchId: match.matchId,
      platform: match.platform,
      summary: match.summary(),
      updatedAt: match.occurredAtIso,
      stats,
    };
  },

  toProcessedEvent(match: Match): {
    userId: string;
    matchId: string;
    platform: Match['platform'];
    occurredAtIso: string;
    correlationId: string;
    stats: Record<string, unknown>;
  } {
    return {
      userId: match.userId,
      matchId: match.matchId,
      platform: match.platform,
      occurredAtIso: match.occurredAtIso,
      correlationId: match.correlationId,
      stats: match.stats.toRecord(),
    };
  },
};
