import type { StatsGranularity } from '@stats-games/common';
import type {
  AggregateMatchStatsResultDto,
  MatchStatsRollupDto,
  ProcessedMatchEventDto,
} from '../../dto/event-network/player-stats.dto';

export interface IStatsSummaryRepository {
  aggregateMatchEvent(event: ProcessedMatchEventDto): Promise<AggregateMatchStatsResultDto>;
}

export interface IStatsRollupReader {
  listByPlayerGranularity(
    userId: string,
    granularity: StatsGranularity,
    periodId: string,
    options?: { platform?: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league'; limit?: number },
  ): Promise<MatchStatsRollupDto[]>;

  listRecentDailyRollups(
    userId: string,
    options?: { platform?: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league'; days?: number },
  ): Promise<MatchStatsRollupDto[]>;
}
