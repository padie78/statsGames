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

/** Fila del ranking comunitario con KPIs semanales. */
export interface CommunityRankRow {
  rank: number;
  gamerTag: string;
  platform: 'fortnite' | 'roblox';
  isYou: boolean;
  kd: number;
  winRate: number;
  kills: number;
  matches: number;
  score: number;
  delta: string;
  trend: 'up' | 'down' | 'flat';
}

export interface CommunityRankTableView {
  rows: CommunityRankRow[];
  yourRank: number;
  totalPlayers: number;
  platform: SelectedGame;
}

interface PeerSeed {
  gamerTag: string;
  kd: number;
  winRate: number;
  kills: number;
  matches: number;
  delta: string;
  trend: 'up' | 'down' | 'flat';
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

const PEERS_FORTNITE: PeerSeed[] = [
  { gamerTag: 'NeoFragger', kd: 2.41, winRate: 48, kills: 186, matches: 34, delta: '+12%', trend: 'up' },
  { gamerTag: 'ShadowAim', kd: 2.18, winRate: 44, kills: 172, matches: 31, delta: '+8%', trend: 'up' },
  { gamerTag: 'StormClutch', kd: 1.96, winRate: 41, kills: 158, matches: 29, delta: '+4%', trend: 'up' },
  { gamerTag: 'ZoneKing', kd: 1.84, winRate: 39, kills: 149, matches: 28, delta: '-1%', trend: 'down' },
  { gamerTag: 'BuildGod_77', kd: 1.72, winRate: 37, kills: 141, matches: 27, delta: '+2%', trend: 'up' },
  { gamerTag: 'RotatePro', kd: 1.61, winRate: 35, kills: 128, matches: 26, delta: '+1%', trend: 'up' },
  { gamerTag: 'PeekMaster', kd: 1.48, winRate: 33, kills: 118, matches: 25, delta: '0%', trend: 'flat' },
  { gamerTag: 'EndgameFox', kd: 1.39, winRate: 32, kills: 110, matches: 24, delta: '-3%', trend: 'down' },
  { gamerTag: 'DropCoast', kd: 1.28, winRate: 30, kills: 98, matches: 23, delta: '+5%', trend: 'up' },
  { gamerTag: 'MatsOnly', kd: 1.19, winRate: 28, kills: 90, matches: 22, delta: '-2%', trend: 'down' },
  { gamerTag: 'ThirdParty', kd: 1.08, winRate: 26, kills: 82, matches: 21, delta: '+3%', trend: 'up' },
  { gamerTag: 'BushCamper', kd: 0.96, winRate: 24, kills: 71, matches: 20, delta: '-4%', trend: 'down' },
  { gamerTag: 'NoobSlayer', kd: 0.88, winRate: 22, kills: 64, matches: 19, delta: '+1%', trend: 'up' },
  { gamerTag: 'LobbyBot', kd: 0.74, winRate: 18, kills: 52, matches: 17, delta: '0%', trend: 'flat' },
];

const PEERS_ROBLOX: PeerSeed[] = [
  { gamerTag: 'UpStatsPro', kd: 2.12, winRate: 46, kills: 154, matches: 30, delta: '+5%', trend: 'up' },
  { gamerTag: 'PixelQueen', kd: 1.98, winRate: 43, kills: 142, matches: 28, delta: '-2%', trend: 'down' },
  { gamerTag: 'BloxRush', kd: 1.85, winRate: 40, kills: 131, matches: 27, delta: '+6%', trend: 'up' },
  { gamerTag: 'SessionKing', kd: 1.71, winRate: 37, kills: 120, matches: 26, delta: '+1%', trend: 'up' },
  { gamerTag: 'GrindLord', kd: 1.58, winRate: 35, kills: 108, matches: 24, delta: '0%', trend: 'flat' },
  { gamerTag: 'ArenaAce', kd: 1.46, winRate: 33, kills: 99, matches: 23, delta: '+4%', trend: 'up' },
  { gamerTag: 'ObbyClutch', kd: 1.34, winRate: 31, kills: 88, matches: 22, delta: '-1%', trend: 'down' },
  { gamerTag: 'TycoonTitan', kd: 1.22, winRate: 29, kills: 79, matches: 21, delta: '+2%', trend: 'up' },
  { gamerTag: 'PVPNova', kd: 1.11, winRate: 27, kills: 70, matches: 20, delta: '-3%', trend: 'down' },
  { gamerTag: 'StudioStar', kd: 1.02, winRate: 25, kills: 63, matches: 19, delta: '+1%', trend: 'up' },
  { gamerTag: 'RbxRookie', kd: 0.91, winRate: 22, kills: 54, matches: 18, delta: '0%', trend: 'flat' },
  { gamerTag: 'LagWarrior', kd: 0.8, winRate: 19, kills: 46, matches: 16, delta: '-2%', trend: 'down' },
];

export const MOCK_LEADERBOARD_FORTNITE: LeaderboardEntry[] = PEERS_FORTNITE.slice(0, 5).map(
  (peer, index) => ({
    rank: index + 1,
    gamerTag: peer.gamerTag,
    platform: 'fortnite' as const,
    score: communityScore(peer),
    delta: peer.delta,
    trend: peer.trend,
  }),
);

export const MOCK_LEADERBOARD_ROBLOX: LeaderboardEntry[] = PEERS_ROBLOX.slice(0, 5).map(
  (peer, index) => ({
    rank: index + 1,
    gamerTag: peer.gamerTag,
    platform: 'roblox' as const,
    score: communityScore(peer),
    delta: peer.delta,
    trend: peer.trend,
  }),
);

export function mockLeaderboardForPlatform(platform: SelectedGame): LeaderboardEntry[] {
  return platform === 'roblox' ? MOCK_LEADERBOARD_ROBLOX : MOCK_LEADERBOARD_FORTNITE;
}

export function communityScore(input: {
  kd: number;
  winRate: number;
  kills: number;
  matches: number;
}): number {
  return Math.round(input.kd * 420 + input.winRate * 16 + input.kills * 2.4 + input.matches * 6);
}

/**
 * Arma un ranking semanal con el usuario insertado y una ventana de vecinos
 * (±radius) mostrando KPIs principales.
 */
export function buildCommunityRankNeighborhood(input: {
  platform: SelectedGame;
  gamerTag: string;
  kd: number;
  winRate: number;
  kills: number;
  matches: number;
  radius?: number;
}): CommunityRankTableView {
  const radius = input.radius ?? 3;
  const platform = input.platform;
  const peers = platform === 'roblox' ? PEERS_ROBLOX : PEERS_FORTNITE;
  const tag = (input.gamerTag || 'Vos').trim() || 'Vos';

  const board: CommunityRankRow[] = peers
    .filter((peer) => peer.gamerTag.toLowerCase() !== tag.toLowerCase())
    .map((peer) => ({
      rank: 0,
      gamerTag: peer.gamerTag,
      platform,
      isYou: false,
      kd: peer.kd,
      winRate: peer.winRate,
      kills: peer.kills,
      matches: peer.matches,
      score: communityScore(peer),
      delta: peer.delta,
      trend: peer.trend,
    }));

  const you: CommunityRankRow = {
    rank: 0,
    gamerTag: tag,
    platform,
    isYou: true,
    kd: round1(Math.max(0, input.kd)),
    winRate: Math.round(Math.max(0, Math.min(100, input.winRate))),
    kills: Math.max(0, Math.round(input.kills)),
    matches: Math.max(0, Math.round(input.matches)),
    score: communityScore({
      kd: Math.max(0, input.kd),
      winRate: Math.max(0, input.winRate),
      kills: Math.max(0, input.kills),
      matches: Math.max(0, input.matches),
    }),
    delta: '+0%',
    trend: 'flat',
  };

  board.push(you);
  board.sort((a, b) => b.score - a.score || a.gamerTag.localeCompare(b.gamerTag));
  board.forEach((row, index) => {
    row.rank = index + 1;
  });

  const yourIndex = board.findIndex((row) => row.isYou);
  const yourRank = yourIndex >= 0 ? board[yourIndex].rank : board.length;
  const start = Math.max(0, yourIndex - radius);
  const end = Math.min(board.length, yourIndex + radius + 1);

  return {
    rows: board.slice(start, end),
    yourRank,
    totalPlayers: board.length,
    platform,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
