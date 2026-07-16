export interface CommunityBenchmarksDto {
  platform: 'fortnite' | 'roblox' | 'valorant' | 'league_of_legends' | 'cs2' | 'dota2' | 'overwatch2' | 'rocket_league' | 'clash_royale' | 'brawl_stars';
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
  platform: 'fortnite' | 'roblox' | 'valorant' | 'league_of_legends' | 'cs2' | 'dota2' | 'overwatch2' | 'rocket_league' | 'clash_royale' | 'brawl_stars';
  score: number;
  totalKills: number;
  matchCount: number;
  delta: string;
  trend: 'up' | 'down' | 'flat';
}

export interface SyncWeeklyCommunityInput {
  userId: string;
  platform: 'fortnite' | 'roblox' | 'valorant' | 'league_of_legends' | 'cs2' | 'dota2' | 'overwatch2' | 'rocket_league' | 'clash_royale' | 'brawl_stars';
  periodId: string;
  matchCount: number;
  totalKills: number;
  totalDeaths: number;
  winCount: number;
}
