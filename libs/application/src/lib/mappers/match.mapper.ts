import type { Match } from '@stats-games/domain';
import type { MatchStatsDto, MatchUpdateDto } from '../dto/event-network/match-update.dto';

function toOptionalInt(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : undefined;
}

function extractStats(record: Record<string, unknown>): MatchStatsDto | undefined {
  const kills = toOptionalInt(record['kills'] ?? record['eliminations']);
  const deaths = toOptionalInt(record['deaths']);
  const placement = toOptionalInt(record['placement'] ?? record['rank']);
  const assists = toOptionalInt(record['assists']);

  if (kills == null && deaths == null && placement == null && assists == null) {
    return undefined;
  }

  return { kills, deaths, placement, assists };
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
