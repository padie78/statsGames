import type { SelectedGame } from '../core/services/auth.service';
import type { LeaderboardEntry } from './dashboard-mock.data';

export interface CommunityBenchmarks {
  platform: SelectedGame;
  sampleSize: number;
  avgWinRate: number;
  avgKd: number;
  avgKillsPerWeek: number;
  avgMatchesPerWeek: number;
  winRateStd: number;
  kdStd: number;
  killsStd: number;
}

export const MOCK_COMMUNITY_BENCHMARKS: Record<SelectedGame, CommunityBenchmarks> = {
  fortnite: {
    platform: 'fortnite',
    sampleSize: 18_400,
    avgWinRate: 31,
    avgKd: 1.12,
    avgKillsPerWeek: 84,
    avgMatchesPerWeek: 22,
    winRateStd: 14,
    kdStd: 0.45,
    killsStd: 38,
  },
  roblox: {
    platform: 'roblox',
    sampleSize: 12_600,
    avgWinRate: 28,
    avgKd: 0.98,
    avgKillsPerWeek: 62,
    avgMatchesPerWeek: 18,
    winRateStd: 13,
    kdStd: 0.4,
    killsStd: 30,
  },
};

export const MOCK_LEADERBOARD_FORTNITE: LeaderboardEntry[] = [
  { rank: 1, gamerTag: 'NeoFragger', platform: 'fortnite', score: 2840, delta: '+12%', trend: 'up' },
  { rank: 2, gamerTag: 'ShadowAim', platform: 'fortnite', score: 2712, delta: '+8%', trend: 'up' },
  { rank: 3, gamerTag: 'StormClutch', platform: 'fortnite', score: 2590, delta: '+4%', trend: 'up' },
  { rank: 4, gamerTag: 'TRN_Demo', platform: 'fortnite', score: 2388, delta: '+3%', trend: 'up' },
  { rank: 5, gamerTag: 'ZoneKing', platform: 'fortnite', score: 2210, delta: '-1%', trend: 'down' },
];

export const MOCK_LEADERBOARD_ROBLOX: LeaderboardEntry[] = [
  { rank: 1, gamerTag: 'UpStatsPro', platform: 'roblox', score: 2655, delta: '+5%', trend: 'up' },
  { rank: 2, gamerTag: 'PixelQueen', platform: 'roblox', score: 2490, delta: '-2%', trend: 'down' },
  { rank: 3, gamerTag: 'BloxRush', platform: 'roblox', score: 2412, delta: '+6%', trend: 'up' },
  { rank: 4, gamerTag: 'SessionKing', platform: 'roblox', score: 2288, delta: '+1%', trend: 'up' },
  { rank: 5, gamerTag: 'GrindLord', platform: 'roblox', score: 2105, delta: '0%', trend: 'flat' },
];

export function mockLeaderboardForPlatform(platform: SelectedGame): LeaderboardEntry[] {
  return platform === 'roblox' ? MOCK_LEADERBOARD_ROBLOX : MOCK_LEADERBOARD_FORTNITE;
}
