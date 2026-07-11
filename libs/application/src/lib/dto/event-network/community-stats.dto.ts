export interface CommunityBenchmarksDto {
  platform: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league';
  periodId: string;
  sampleSize: number;
  avgWinRate: number;
  avgKd: number;
  avgKillsPerWeek: number;
  avgMatchesPerWeek: number;
  winRateStd: number;
  kdStd: number;
  killsStd: number;
  lastUpdatedIso: string;
}

export interface LeaderboardEntryDto {
  rank: number;
  userId: string;
  gamerTag: string;
  platform: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league';
  score: number;
  totalKills: number;
  matchCount: number;
  delta: string;
  trend: 'up' | 'down' | 'flat';
}

export interface SyncWeeklyCommunityInput {
  userId: string;
  platform: 'fortnite' | 'roblox' | 'valorant' | 'rocket_league';
  periodId: string;
  matchCount: number;
  totalKills: number;
  totalDeaths: number;
  winCount: number;
}
