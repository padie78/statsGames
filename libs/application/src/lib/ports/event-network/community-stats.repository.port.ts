import type {
  CommunityBenchmarksDto,
  LeaderboardEntryDto,
  SyncWeeklyCommunityInput,
} from '../../dto/event-network/community-stats.dto';

export interface ICommunityStatsRepository {
  syncWeeklyPlayerStats(input: SyncWeeklyCommunityInput): Promise<void>;
  getCommunityBenchmarks(
    platform: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league',
    periodId: string,
  ): Promise<CommunityBenchmarksDto | null>;
  listWeeklyLeaderboard(
    platform: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league',
    periodId: string,
    limit: number,
  ): Promise<LeaderboardEntryDto[]>;
}
