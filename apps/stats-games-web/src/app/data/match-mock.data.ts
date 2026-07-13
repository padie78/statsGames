import type { MatchUpdateView } from '../services/match.service';

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function hoursAgo(hours: number): string {
  return minutesAgo(hours * 60);
}

function daysAgo(days: number, hour = 14): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, Math.floor(Math.random() * 50) + 5, 0, 0);
  return date.toISOString();
}

type MockMatchSeed = Omit<MatchUpdateView, 'userId'>;

const HISTORY_SEEDS: MockMatchSeed[] = [
  // ── Fortnite ──
  {
    matchId: 'fn-ranked-0842',
    platform: 'fortnite',
    summary: 'Ranked Zero Build · Top 8 · 11 eliminaciones',
    updatedAt: hoursAgo(2),
    stats: { kills: 11, deaths: 3, placement: 8, assists: 2, mode: 'Ranked Zero Build', won: false },
  },
  {
    matchId: 'fn-squads-1190',
    platform: 'fortnite',
    summary: 'Squads · Victoria · 14 eliminaciones',
    updatedAt: hoursAgo(6),
    stats: { kills: 14, deaths: 1, placement: 1, assists: 4, mode: 'Squads', won: true },
  },
  {
    matchId: 'fn-trios-2201',
    platform: 'fortnite',
    summary: 'Trios · Eliminado #22 · Mid-game rotate',
    updatedAt: daysAgo(1, 19),
    stats: { kills: 6, deaths: 4, placement: 22, assists: 3, mode: 'Trios', won: false },
  },
  {
    matchId: 'fn-solo-5520',
    platform: 'fortnite',
    summary: 'Solo · Top 15 · Storm surge damage',
    updatedAt: daysAgo(3, 16),
    stats: { kills: 4, deaths: 2, placement: 15, assists: 0, mode: 'Solo', won: false },
  },
  {
    matchId: 'fn-ranked-0911',
    platform: 'fortnite',
    summary: 'Ranked · Top 34 · Early drop hot',
    updatedAt: daysAgo(5, 20),
    stats: { kills: 3, deaths: 5, placement: 34, assists: 1, mode: 'Ranked', won: false },
  },
  {
    matchId: 'fn-duos-7703',
    platform: 'fortnite',
    summary: 'Duos · Top 6 · Late zone heal fight',
    updatedAt: daysAgo(7, 22),
    stats: { kills: 8, deaths: 2, placement: 6, assists: 2, mode: 'Duos', won: false },
  },

  // ── Valorant ──
  {
    matchId: 'val-comp-4412',
    platform: 'valorant',
    summary: 'Competitive · Ascent · Jett · 13-9',
    updatedAt: hoursAgo(3),
    stats: {
      kills: 22,
      deaths: 14,
      assists: 6,
      headshotPct: 28.4,
      roundsWon: 13,
      roundsLost: 9,
      map: 'Ascent',
      agent: 'Jett',
      mode: 'Competitive',
      won: true,
      score: 4820,
      placement: 1,
    },
  },
  {
    matchId: 'val-comp-4413',
    platform: 'valorant',
    summary: 'Competitive · Bind · Sage · 11-13',
    updatedAt: hoursAgo(8),
    stats: {
      kills: 15,
      deaths: 17,
      assists: 9,
      headshotPct: 22.1,
      roundsWon: 11,
      roundsLost: 13,
      map: 'Bind',
      agent: 'Sage',
      mode: 'Competitive',
      won: false,
      score: 3910,
      placement: 2,
    },
  },
  {
    matchId: 'val-comp-4414',
    platform: 'valorant',
    summary: 'Competitive · Haven · Sova · 13-7',
    updatedAt: daysAgo(1, 21),
    stats: {
      kills: 18,
      deaths: 11,
      assists: 11,
      headshotPct: 31.2,
      roundsWon: 13,
      roundsLost: 7,
      map: 'Haven',
      agent: 'Sova',
      mode: 'Competitive',
      won: true,
      score: 4480,
      placement: 1,
    },
  },
  {
    matchId: 'val-unrated-220',
    platform: 'valorant',
    summary: 'Unrated · Lotus · Reyna · 13-11',
    updatedAt: daysAgo(2, 18),
    stats: {
      kills: 24,
      deaths: 16,
      assists: 4,
      headshotPct: 35.0,
      roundsWon: 13,
      roundsLost: 11,
      map: 'Lotus',
      agent: 'Reyna',
      mode: 'Unrated',
      won: true,
      score: 5280,
      placement: 1,
    },
  },
  {
    matchId: 'val-comp-4415',
    platform: 'valorant',
    summary: 'Competitive · Split · Omen · 8-13',
    updatedAt: daysAgo(4, 20),
    stats: {
      kills: 12,
      deaths: 18,
      assists: 7,
      headshotPct: 19.5,
      roundsWon: 8,
      roundsLost: 13,
      map: 'Split',
      agent: 'Omen',
      mode: 'Competitive',
      won: false,
      score: 3120,
      placement: 2,
    },
  },

  // ── League of Legends ──
  {
    matchId: 'lol-ranked-8801',
    platform: 'league_of_legends',
    summary: 'Ranked Solo · Jinx · ADC · Victoria',
    updatedAt: hoursAgo(4),
    stats: {
      kills: 11,
      deaths: 3,
      assists: 14,
      champion: 'Jinx',
      agent: 'Jinx',
      role: 'BOTTOM',
      cs: 248,
      visionScore: 28,
      mode: 'Ranked Solo',
      won: true,
      placement: 1,
      durationSec: 1920,
    },
  },
  {
    matchId: 'lol-ranked-8802',
    platform: 'league_of_legends',
    summary: 'Ranked Solo · Ahri · Mid · Derrota',
    updatedAt: hoursAgo(10),
    stats: {
      kills: 6,
      deaths: 7,
      assists: 9,
      champion: 'Ahri',
      agent: 'Ahri',
      role: 'MIDDLE',
      cs: 201,
      visionScore: 22,
      mode: 'Ranked Solo',
      won: false,
      placement: 2,
      durationSec: 1740,
    },
  },
  {
    matchId: 'lol-ranked-8803',
    platform: 'league_of_legends',
    summary: 'Ranked Solo · Lee Sin · Jungle · Victoria',
    updatedAt: daysAgo(1, 22),
    stats: {
      kills: 9,
      deaths: 4,
      assists: 12,
      champion: 'Lee Sin',
      agent: 'Lee Sin',
      role: 'JUNGLE',
      cs: 168,
      visionScore: 41,
      mode: 'Ranked Solo',
      won: true,
      placement: 1,
      durationSec: 2100,
    },
  },
  {
    matchId: 'lol-flex-441',
    platform: 'league_of_legends',
    summary: 'Flex · Thresh · Support · Victoria',
    updatedAt: daysAgo(3, 19),
    stats: {
      kills: 2,
      deaths: 5,
      assists: 22,
      champion: 'Thresh',
      agent: 'Thresh',
      role: 'UTILITY',
      cs: 38,
      visionScore: 72,
      mode: 'Flex',
      won: true,
      placement: 1,
      durationSec: 1860,
    },
  },
  {
    matchId: 'lol-ranked-8804',
    platform: 'league_of_legends',
    summary: 'Ranked Solo · Darius · Top · Derrota',
    updatedAt: daysAgo(5, 17),
    stats: {
      kills: 4,
      deaths: 8,
      assists: 3,
      champion: 'Darius',
      agent: 'Darius',
      role: 'TOP',
      cs: 189,
      visionScore: 14,
      mode: 'Ranked Solo',
      won: false,
      placement: 2,
      durationSec: 1680,
    },
  },

  // ── CS2 ──
  {
    matchId: 'cs2-comp-3101',
    platform: 'cs2',
    summary: 'Competitive · Mirage · 16-12',
    updatedAt: hoursAgo(5),
    stats: {
      kills: 24,
      deaths: 16,
      assists: 5,
      adr: 92.4,
      headshotPct: 41.2,
      map: 'de_mirage',
      mode: 'Competitive',
      won: true,
      roundsWon: 16,
      roundsLost: 12,
      placement: 1,
    },
  },
  {
    matchId: 'cs2-comp-3102',
    platform: 'cs2',
    summary: 'Competitive · Inferno · 11-16',
    updatedAt: daysAgo(1, 16),
    stats: {
      kills: 18,
      deaths: 20,
      assists: 4,
      adr: 74.1,
      headshotPct: 33.8,
      map: 'de_inferno',
      mode: 'Competitive',
      won: false,
      roundsWon: 11,
      roundsLost: 16,
      placement: 2,
    },
  },
  {
    matchId: 'cs2-premier-88',
    platform: 'cs2',
    summary: 'Premier · Ancient · 13-9',
    updatedAt: daysAgo(2, 20),
    stats: {
      kills: 21,
      deaths: 14,
      assists: 6,
      adr: 88.0,
      headshotPct: 38.5,
      map: 'de_ancient',
      mode: 'Premier',
      won: true,
      roundsWon: 13,
      roundsLost: 9,
      placement: 1,
    },
  },
  {
    matchId: 'cs2-comp-3103',
    platform: 'cs2',
    summary: 'Competitive · Nuke · 16-14',
    updatedAt: daysAgo(4, 21),
    stats: {
      kills: 19,
      deaths: 17,
      assists: 7,
      adr: 81.6,
      headshotPct: 29.4,
      map: 'de_nuke',
      mode: 'Competitive',
      won: true,
      roundsWon: 16,
      roundsLost: 14,
      placement: 1,
    },
  },

  // ── Rocket League ──
  {
    matchId: 'rl-2v2-5501',
    platform: 'rocket_league',
    summary: '2v2 · DFH Stadium · Victoria',
    updatedAt: hoursAgo(1),
    stats: {
      kills: 5,
      goals: 5,
      assists: 3,
      saves: 4,
      shots: 11,
      shotPct: 45,
      score: 620,
      deaths: 2,
      mode: '2v2',
      map: 'DFH Stadium',
      won: true,
      placement: 1,
    },
  },
  {
    matchId: 'rl-3v3-5502',
    platform: 'rocket_league',
    summary: '3v3 · Mannfield · Derrota',
    updatedAt: hoursAgo(7),
    stats: {
      kills: 2,
      goals: 2,
      assists: 1,
      saves: 6,
      shots: 7,
      shotPct: 29,
      score: 410,
      deaths: 4,
      mode: '3v3',
      map: 'Mannfield',
      won: false,
      placement: 2,
    },
  },
  {
    matchId: 'rl-2v2-5503',
    platform: 'rocket_league',
    summary: '2v2 · Urban Central · Victoria',
    updatedAt: daysAgo(1, 15),
    stats: {
      kills: 4,
      goals: 4,
      assists: 2,
      saves: 3,
      shots: 9,
      shotPct: 44,
      score: 540,
      deaths: 1,
      mode: '2v2',
      map: 'Urban Central',
      won: true,
      placement: 1,
    },
  },
  {
    matchId: 'rl-solo-99',
    platform: 'rocket_league',
    summary: '1v1 · Utopia Coliseum · Victoria',
    updatedAt: daysAgo(3, 20),
    stats: {
      kills: 7,
      goals: 7,
      assists: 0,
      saves: 5,
      shots: 14,
      shotPct: 50,
      score: 710,
      deaths: 3,
      mode: '1v1',
      map: 'Utopia Coliseum',
      won: true,
      placement: 1,
    },
  },
  {
    matchId: 'rl-2v2-5504',
    platform: 'rocket_league',
    summary: '2v2 · Champions Field · Derrota',
    updatedAt: daysAgo(6, 18),
    stats: {
      kills: 1,
      goals: 1,
      assists: 2,
      saves: 2,
      shots: 5,
      shotPct: 20,
      score: 280,
      deaths: 5,
      mode: '2v2',
      map: 'Champions Field',
      won: false,
      placement: 2,
    },
  },

  // ── Roblox ──
  {
    matchId: 'rbx-blox-3312',
    platform: 'roblox',
    summary: 'Blox Fruits PvP · Racha de 5 victorias',
    updatedAt: hoursAgo(9),
    stats: { kills: 9, deaths: 2, placement: 2, assists: 1, mode: 'Blox Fruits', won: false },
  },
  {
    matchId: 'rbx-bedwars-884',
    platform: 'roblox',
    summary: 'BedWars · Defensa final clutch',
    updatedAt: daysAgo(2, 21),
    stats: { kills: 12, deaths: 5, placement: 3, assists: 6, mode: 'BedWars', won: false },
  },
  {
    matchId: 'rbx-arsenal-441',
    platform: 'roblox',
    summary: 'Arsenal · 18 eliminaciones · MVP',
    updatedAt: daysAgo(4, 18),
    stats: { kills: 18, deaths: 7, placement: 1, assists: 2, mode: 'Arsenal', won: true },
  },
  {
    matchId: 'rbx-rivals-229',
    platform: 'roblox',
    summary: 'Rivals · Duelo ranked · Win streak',
    updatedAt: daysAgo(6, 15),
    stats: { kills: 7, deaths: 3, placement: 4, assists: 0, mode: 'Rivals', won: false },
  },
];

const LIVE_STREAM_SEEDS: MockMatchSeed[] = [
  {
    matchId: 'live-val-001',
    platform: 'valorant',
    summary: 'En curso · Competitive · Ascent · 8-6',
    updatedAt: minutesAgo(1),
    stats: {
      kills: 12,
      deaths: 8,
      assists: 3,
      headshotPct: 26,
      roundsWon: 8,
      roundsLost: 6,
      map: 'Ascent',
      agent: 'Jett',
      mode: 'Competitive',
      score: 2100,
    },
  },
  {
    matchId: 'live-lol-002',
    platform: 'league_of_legends',
    summary: 'En curso · Ranked · Ahri Mid · 22 min',
    updatedAt: minutesAgo(4),
    stats: {
      kills: 5,
      deaths: 2,
      assists: 7,
      champion: 'Ahri',
      role: 'MIDDLE',
      cs: 168,
      visionScore: 18,
      mode: 'Ranked Solo',
    },
  },
  {
    matchId: 'live-cs2-003',
    platform: 'cs2',
    summary: 'En curso · Premier · Mirage · 9-7',
    updatedAt: minutesAgo(7),
    stats: {
      kills: 14,
      deaths: 10,
      assists: 3,
      adr: 86,
      headshotPct: 37,
      map: 'de_mirage',
      mode: 'Premier',
      roundsWon: 9,
      roundsLost: 7,
    },
  },
  {
    matchId: 'live-rl-004',
    platform: 'rocket_league',
    summary: 'En curso · 2v2 · 2-1',
    updatedAt: minutesAgo(9),
    stats: { kills: 2, goals: 2, assists: 1, saves: 2, shots: 5, shotPct: 40, score: 280, mode: '2v2' },
  },
  {
    matchId: 'live-fn-005',
    platform: 'fortnite',
    summary: 'En curso · Ranked · 4 eliminaciones',
    updatedAt: minutesAgo(12),
    stats: { kills: 4, deaths: 0, placement: null, assists: 1, mode: 'Ranked' },
  },
  {
    matchId: 'live-rbx-006',
    platform: 'roblox',
    summary: 'Blox Fruits · PvP activo · +2 kills',
    updatedAt: minutesAgo(16),
    stats: { kills: 6, deaths: 1, placement: null, assists: 0, mode: 'Blox Fruits' },
  },
];

function stampUserId(seeds: MockMatchSeed[], userId: string): MatchUpdateView[] {
  return seeds.map((seed) => ({ ...seed, userId }));
}

export function filterMockMatchesByPlatform(
  matches: MatchUpdateView[],
  platform?: string | null,
): MatchUpdateView[] {
  if (!platform) return matches;
  const key =
    platform === 'blox_fruits' || platform === 'adopt_me' || platform === 'brookhaven'
      ? 'roblox'
      : platform;
  return matches.filter((m) => m.platform === key);
}

export function buildMockMatchHistory(userId: string): MatchUpdateView[] {
  return stampUserId(HISTORY_SEEDS, userId);
}

export function buildMockLiveStream(userId: string): MatchUpdateView[] {
  return stampUserId(LIVE_STREAM_SEEDS, userId);
}

export function resolveMatchHistory(
  apiMatches: MatchUpdateView[],
  userId: string,
  platform?: string | null,
): MatchUpdateView[] {
  const source = apiMatches.length > 0 ? apiMatches : buildMockMatchHistory(userId);
  return filterMockMatchesByPlatform(source, platform);
}
