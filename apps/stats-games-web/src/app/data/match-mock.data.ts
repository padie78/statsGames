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
  {
    matchId: 'fn-ranked-0842',
    platform: 'fortnite',
    summary: 'Ranked Zero Build · Top 8 · 11 eliminaciones',
    updatedAt: hoursAgo(2),
    stats: { kills: 11, deaths: 3, placement: 8, assists: 2 },
  },
  {
    matchId: 'fn-squads-1190',
    platform: 'fortnite',
    summary: 'Squads · Victoria · 14 eliminaciones',
    updatedAt: hoursAgo(6),
    stats: { kills: 14, deaths: 1, placement: 1, assists: 4 },
  },
  {
    matchId: 'rbx-blox-3312',
    platform: 'roblox',
    summary: 'Blox Fruits PvP · Racha de 5 victorias',
    updatedAt: hoursAgo(9),
    stats: { kills: 9, deaths: 2, placement: 2, assists: 1 },
  },
  {
    matchId: 'fn-trios-2201',
    platform: 'fortnite',
    summary: 'Trios · Eliminado #22 · Mid-game rotate',
    updatedAt: daysAgo(1, 19),
    stats: { kills: 6, deaths: 4, placement: 22, assists: 3 },
  },
  {
    matchId: 'rbx-bedwars-884',
    platform: 'roblox',
    summary: 'BedWars · Defensa final clutch',
    updatedAt: daysAgo(2, 21),
    stats: { kills: 12, deaths: 5, placement: 3, assists: 6 },
  },
  {
    matchId: 'fn-solo-5520',
    platform: 'fortnite',
    summary: 'Solo · Top 15 · Storm surge damage',
    updatedAt: daysAgo(3, 16),
    stats: { kills: 4, deaths: 2, placement: 15, assists: 0 },
  },
  {
    matchId: 'rbx-arsenal-441',
    platform: 'roblox',
    summary: 'Arsenal · 18 eliminaciones · MVP',
    updatedAt: daysAgo(4, 18),
    stats: { kills: 18, deaths: 7, placement: 1, assists: 2 },
  },
  {
    matchId: 'fn-ranked-0911',
    platform: 'fortnite',
    summary: 'Ranked · Top 34 · Early drop hot',
    updatedAt: daysAgo(5, 20),
    stats: { kills: 3, deaths: 5, placement: 34, assists: 1 },
  },
  {
    matchId: 'rbx-rivals-229',
    platform: 'roblox',
    summary: 'Rivals · Duelo ranked · Win streak',
    updatedAt: daysAgo(6, 15),
    stats: { kills: 7, deaths: 3, placement: 4, assists: 0 },
  },
  {
    matchId: 'fn-duos-7703',
    platform: 'fortnite',
    summary: 'Duos · Top 6 · Late zone heal fight',
    updatedAt: daysAgo(7, 22),
    stats: { kills: 8, deaths: 2, placement: 6, assists: 2 },
  },
];

const LIVE_STREAM_SEEDS: MockMatchSeed[] = [
  {
    matchId: 'live-fn-001',
    platform: 'fortnite',
    summary: 'En curso · Ranked · 4 eliminaciones',
    updatedAt: minutesAgo(1),
    stats: { kills: 4, deaths: 0, placement: null, assists: 1 },
  },
  {
    matchId: 'live-rbx-002',
    platform: 'roblox',
    summary: 'Blox Fruits · PvP activo · +2 kills',
    updatedAt: minutesAgo(3),
    stats: { kills: 6, deaths: 1, placement: null, assists: 0 },
  },
  {
    matchId: 'live-fn-003',
    platform: 'fortnite',
    summary: 'Squads · Storm closing · 7 alive',
    updatedAt: minutesAgo(6),
    stats: { kills: 7, deaths: 2, placement: null, assists: 3 },
  },
  {
    matchId: 'live-rbx-004',
    platform: 'roblox',
    summary: 'BedWars · Mid-game push',
    updatedAt: minutesAgo(11),
    stats: { kills: 5, deaths: 2, placement: null, assists: 4 },
  },
  {
    matchId: 'live-fn-005',
    platform: 'fortnite',
    summary: 'Zero Build · Top 12 · Rotación final',
    updatedAt: minutesAgo(16),
    stats: { kills: 9, deaths: 3, placement: 12, assists: 2 },
  },
  {
    matchId: 'live-rbx-006',
    platform: 'roblox',
    summary: 'Arsenal · Ronda 8 · Kill streak x3',
    updatedAt: minutesAgo(22),
    stats: { kills: 11, deaths: 4, placement: null, assists: 1 },
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
  const key = platform === 'blox_fruits' || platform === 'adopt_me' || platform === 'brookhaven'
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
