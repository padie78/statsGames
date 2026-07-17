import type {
  CommunityBenchmarksDto,
  LeaderboardEntryDto,
  SyncWeeklyCommunityInput,
} from '../../dto/event-network/community-stats.dto';

type CommunityPlatform = SyncWeeklyCommunityInput['platform'];

export interface ICommunityStatsRepository {
  syncWeeklyPlayerStats(input: SyncWeeklyCommunityInput): Promise<void>;
  getCommunityBenchmarks(
    platform: CommunityPlatform,
    periodId: string,
  ): Promise<CommunityBenchmarksDto | null>;
  listWeeklyLeaderboard(
    platform: CommunityPlatform,
    periodId: string,
    limit: number,
  ): Promise<LeaderboardEntryDto[]>;
}
