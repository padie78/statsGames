import type { StatsGranularity } from '@stats-games/common';
import type {
  AggregateMatchStatsResultDto,
  MatchStatsRollupDto,
  ProcessedMatchEventDto,
} from '../../dto/event-network/player-stats.dto';

export interface IStatsSummaryRepository {
  aggregateMatchEvent(event: ProcessedMatchEventDto): Promise<AggregateMatchStatsResultDto>;
}

type StatsPlatformFilter = MatchStatsRollupDto['platform'];

export interface IStatsRollupReader {
  listByPlayerGranularity(
    userId: string,
    granularity: StatsGranularity,
    periodId: string,
    options?: { platform?: StatsPlatformFilter; limit?: number },
  ): Promise<MatchStatsRollupDto[]>;

  listRecentDailyRollups(
    userId: string,
    options?: { platform?: StatsPlatformFilter; days?: number },
  ): Promise<MatchStatsRollupDto[]>;
}
