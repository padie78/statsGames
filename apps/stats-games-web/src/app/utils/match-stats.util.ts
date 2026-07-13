import type { MatchCardStats } from '../ui/molecules/match-stat-card/match-stat-card.component';
import type { MatchUpdateView } from '../services/match.service';
import type { NeonBadgeTone } from '../ui/atoms/neon-badge/neon-badge.component';
import type { MatchDailyTrendSeries, TrendChartPoint } from '../core/charts/chart.types';

export interface MatchStatsView {
  kills?: number | null;
  deaths?: number | null;
  placement?: number | null;
  assists?: number | null;
  headshotPct?: number | null;
  roundsWon?: number | null;
  roundsLost?: number | null;
  map?: string | null;
  agent?: string | null;
  mode?: string | null;
  won?: boolean | null;
}

export interface MatchOutcome {
  label: string;
  tone: NeonBadgeTone;
}

export interface MatchAggregateSummary {
  matchCount: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  avgPlacement: string;
  bestPlacement: number | null;
  kd: string;
  winCount: number;
  winRate: string;
}

export interface MatchDayGroup {
  id: string;
  label: string;
  matches: MatchUpdateView[];
}

export type MatchSortKey = 'newest' | 'oldest' | 'placement' | 'kills';

export function toMatchCardStats(stats?: MatchStatsView | null): MatchCardStats {
  if (!stats) return {};
  return {
    kills: stats.kills ?? undefined,
    deaths: stats.deaths ?? undefined,
    placement: stats.placement ?? undefined,
    assists: stats.assists ?? undefined,
    headshotPct: stats.headshotPct ?? undefined,
    roundsWon: stats.roundsWon ?? undefined,
    roundsLost: stats.roundsLost ?? undefined,
    map: stats.map ?? undefined,
    agent: stats.agent ?? undefined,
    mode: stats.mode ?? undefined,
    won: stats.won ?? undefined,
  };
}

export function computeKdRatio(kills: number, deaths: number): string {
  if (deaths === 0) return kills > 0 ? kills.toFixed(1) : '0.0';
  return (kills / deaths).toFixed(2);
}

export function computeWinRate(winCount: number, matchCount: number): string {
  if (matchCount === 0) return '—';
  return `${Math.round((winCount / matchCount) * 100)}%`;
}

export function filterMatchesWithinDays(
  matches: MatchUpdateView[],
  days: number,
): MatchUpdateView[] {
  const cutoff = Date.now() - days * 86_400_000;
  return matches.filter((m) => new Date(m.updatedAt).getTime() >= cutoff);
}

export function filterMatchesInDayRange(
  matches: MatchUpdateView[],
  fromDaysAgo: number,
  toDaysAgo: number,
): MatchUpdateView[] {
  const now = Date.now();
  const startMs = now - toDaysAgo * 86_400_000;
  const endMs = now - fromDaysAgo * 86_400_000;
  return matches.filter((m) => {
    const t = new Date(m.updatedAt).getTime();
    return t >= startMs && t < endMs;
  });
}

export interface WeekComparisonItem {
  label: string;
  value: string | number;
  note: string;
  trend: 'up' | 'down' | 'flat';
}

export function buildWeekComparison(params: {
  currentWeekly: { matchCount: number; totalKills: number; totalDeaths: number } | null;
  previousWeekly: { matchCount: number; totalKills: number; totalDeaths: number } | null;
  currentWins: number;
  previousWins: number;
}): WeekComparisonItem[] {
  const { currentWeekly, previousWeekly, currentWins, previousWins } = params;
  if (!currentWeekly?.matchCount && !previousWeekly?.matchCount && currentWins === 0) {
    return [];
  }

  const items: WeekComparisonItem[] = [
    {
      label: 'Victorias',
      value: currentWins,
      ...formatCountDelta(currentWins, previousWins),
    },
  ];

  if (currentWeekly) {
    items.push(
      {
        label: 'Kills',
        value: currentWeekly.totalKills,
        ...formatCountDelta(currentWeekly.totalKills, previousWeekly?.totalKills ?? 0),
      },
      {
        label: 'Partidas',
        value: currentWeekly.matchCount,
        ...formatCountDelta(currentWeekly.matchCount, previousWeekly?.matchCount ?? 0),
      },
      {
        label: 'K/D',
        value: computeKdRatio(currentWeekly.totalKills, currentWeekly.totalDeaths),
        ...formatKdDelta(currentWeekly, previousWeekly),
      },
    );
  }

  return items;
}

function formatCountDelta(
  current: number,
  previous: number,
): { note: string; trend: 'up' | 'down' | 'flat' } {
  const diff = current - previous;
  if (diff === 0) return { note: 'igual que la semana pasada', trend: 'flat' };
  return {
    note: `${diff > 0 ? '+' : ''}${diff} vs semana pasada`,
    trend: diff > 0 ? 'up' : 'down',
  };
}

function formatKdDelta(
  current: { totalKills: number; totalDeaths: number },
  previous: { totalKills: number; totalDeaths: number } | null,
): { note: string; trend: 'up' | 'down' | 'flat' } {
  const curKd = parseFloat(computeKdRatio(current.totalKills, current.totalDeaths));
  const prevKd = previous
    ? parseFloat(computeKdRatio(previous.totalKills, previous.totalDeaths))
    : 0;
  const diff = Number((curKd - prevKd).toFixed(2));
  if (diff === 0) return { note: 'igual que la semana pasada', trend: 'flat' };
  return {
    note: `${diff > 0 ? '+' : ''}${diff.toFixed(2)} vs semana pasada`,
    trend: diff > 0 ? 'up' : 'down',
  };
}

export function computeBestKills(matches: MatchUpdateView[]): number {
  if (!matches.length) return 0;
  return Math.max(...matches.map((m) => m.stats?.kills ?? 0));
}

export function computePlayStreakFromDailyTrend(
  dailyTrend: { periodId: string; matchCount: number }[],
): number {
  const sorted = [...dailyTrend].sort((a, b) => b.periodId.localeCompare(a.periodId));
  let streak = 0;
  for (const day of sorted) {
    if (day.matchCount > 0) streak += 1;
    else break;
  }
  return streak;
}

export function computeWinStreak(matches: MatchUpdateView[]): number {
  let streak = 0;
  for (const match of sortMatches(matches, 'newest')) {
    if (match.stats?.placement === 1) streak += 1;
    else break;
  }
  return streak;
}

export function formatMatchRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getMatchOutcome(placement?: number | null): MatchOutcome {
  if (placement == null || placement <= 0) {
    return { label: 'En curso', tone: 'cyan' };
  }
  if (placement === 1) return { label: 'Victoria', tone: 'lime' };
  if (placement <= 3) return { label: 'Podio', tone: 'cyan' };
  if (placement <= 10) return { label: 'Top 10', tone: 'cyan' };
  if (placement <= 25) return { label: 'Top 25', tone: 'muted' };
  return { label: `#${placement}`, tone: 'muted' };
}

export function aggregateMatchStats(matches: MatchUpdateView[]): MatchAggregateSummary {
  if (!matches.length) {
    return {
      matchCount: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      avgPlacement: '—',
      bestPlacement: null,
      kd: '—',
      winCount: 0,
      winRate: '—',
    };
  }

  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let placementSum = 0;
  let placementCount = 0;
  let bestPlacement: number | null = null;
  let winCount = 0;

  for (const match of matches) {
    const stats = match.stats;
    totalKills += stats?.kills ?? 0;
    totalDeaths += stats?.deaths ?? 0;
    totalAssists += stats?.assists ?? 0;

    const placement = stats?.placement;
    if (placement != null && placement > 0) {
      placementSum += placement;
      placementCount += 1;
      bestPlacement = bestPlacement == null ? placement : Math.min(bestPlacement, placement);
      if (placement === 1) winCount += 1;
    }
  }

  return {
    matchCount: matches.length,
    totalKills,
    totalDeaths,
    totalAssists,
    avgPlacement: placementCount ? (placementSum / placementCount).toFixed(1) : '—',
    bestPlacement,
    kd: computeKdRatio(totalKills, totalDeaths),
    winCount,
    winRate: computeWinRate(winCount, matches.length),
  };
}

export function sortMatches(matches: MatchUpdateView[], sort: MatchSortKey): MatchUpdateView[] {
  const rows = [...matches];

  switch (sort) {
    case 'oldest':
      return rows.sort(
        (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      );
    case 'placement':
      return rows.sort((a, b) => {
        const pa = a.stats?.placement ?? 999;
        const pb = b.stats?.placement ?? 999;
        if (pa !== pb) return pa - pb;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    case 'kills':
      return rows.sort((a, b) => {
        const ka = a.stats?.kills ?? 0;
        const kb = b.stats?.kills ?? 0;
        if (ka !== kb) return kb - ka;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    case 'newest':
    default:
      return rows.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }
}

export function groupMatchesByDay(matches: MatchUpdateView[]): MatchDayGroup[] {
  const groups = new Map<string, MatchDayGroup>();

  for (const match of matches) {
    const date = new Date(match.updatedAt);
    const key = Number.isNaN(date.getTime())
      ? 'unknown'
      : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    const label = dayGroupLabel(date);
    const existing = groups.get(key);

    if (existing) {
      existing.matches.push(match);
    } else {
      groups.set(key, { id: key, label, matches: [match] });
    }
  }

  return [...groups.values()];
}

export function buildMatchDailyTrends(matches: MatchUpdateView[]): MatchDailyTrendSeries {
  const buckets = new Map<
    string,
    { label: string; kills: number; matches: number; placementSum: number; placementCount: number }
  >();

  for (const match of matches) {
    const date = new Date(match.updatedAt);
    if (Number.isNaN(date.getTime())) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const label = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    const bucket = buckets.get(key) ?? {
      label,
      kills: 0,
      matches: 0,
      placementSum: 0,
      placementCount: 0,
    };

    bucket.kills += match.stats?.kills ?? 0;
    bucket.matches += 1;

    const placement = match.stats?.placement;
    if (placement != null && placement > 0) {
      bucket.placementSum += placement;
      bucket.placementCount += 1;
    }

    buckets.set(key, bucket);
  }

  const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));

  const kills: TrendChartPoint[] = [];
  const matchCounts: TrendChartPoint[] = [];
  const placement: TrendChartPoint[] = [];

  for (const [, bucket] of sorted) {
    kills.push({ label: bucket.label, value: bucket.kills });
    matchCounts.push({ label: bucket.label, value: bucket.matches });
    placement.push({
      label: bucket.label,
      value:
        bucket.placementCount > 0
          ? Number((bucket.placementSum / bucket.placementCount).toFixed(1))
          : 0,
    });
  }

  return { kills, matches: matchCounts, placement };
}

function dayGroupLabel(date: Date): string {
  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfMatch = new Date(date);
  startOfMatch.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (startOfToday.getTime() - startOfMatch.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) {
    return date.toLocaleDateString('es-AR', { weekday: 'long' });
  }

  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== startOfToday.getFullYear() ? 'numeric' : undefined,
  });
}

export function buildPlayerShareUrl(gamerTag: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/player/${encodeURIComponent(gamerTag)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
