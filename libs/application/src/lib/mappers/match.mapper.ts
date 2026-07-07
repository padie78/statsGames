import type { Match } from '@stats-games/domain';
import type { MatchUpdateDto } from '../dto/event-network/match-update.dto';

export const MatchMapper = {
  toUpdateDto(match: Match): MatchUpdateDto {
    return {
      userId: match.userId,
      matchId: match.matchId,
      platform: match.platform,
      summary: match.summary(),
      updatedAt: match.occurredAtIso,
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
