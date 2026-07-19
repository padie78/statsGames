import type { MatchUpdateView } from '../../services/match.service';
import {
  listRecentWeeklyPeriodIds,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import { isMatchWin } from '../../utils/match-stats.util';
import { computeFairCommunityScore } from '../../utils/weekly-community-rank.util';
import type { TrendChartPoint } from './chart.types';

export interface WeeklyFormPoint {
  periodId: string;
  label: string;
  /** null = semana sin partidas (gap en el chart, no WR/KDA en 0). */
  winRate: number | null;
  kd: number | null;
  fairScore: number | null;
  matchCount: number;
  winCount: number;
  hasData: boolean;
  /** Última semana del rango (semana actual). */
  isCurrent: boolean;
}

export interface StatsRadarAxis {
  name: string;
  value: number;
}

/** Builds a 7-day rollup from match history when the stats API trend is empty. */
export function buildDailyTrendFromMatches(
  matches: MatchUpdateView[],
  userId: string,
  platform: string,
  days = 7,
): PlayerStatsRollupView[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = new Map<string, PlayerStatsRollupView>();
  const placementSums = new Map<string, { sum: number; count: number }>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const periodId = toPeriodId(day);
    buckets.set(periodId, emptyDailyRollup(userId, platform, periodId));
    placementSums.set(periodId, { sum: 0, count: 0 });
  }

  for (const match of matches) {
    const stamp = new Date(match.updatedAt);
    if (Number.isNaN(stamp.getTime())) continue;
    stamp.setHours(0, 0, 0, 0);
    const periodId = toPeriodId(stamp);
    const bucket = buckets.get(periodId);
    if (!bucket) continue;

    bucket.matchCount += 1;
    bucket.totalKills += match.stats?.kills ?? 0;
    bucket.totalDeaths += match.stats?.deaths ?? 0;
    const placement = match.stats?.placement;
    if (placement != null && placement > 0) {
      const place = placementSums.get(periodId)!;
      place.sum += placement;
      place.count += 1;
    }
    if (!bucket.lastUpdatedIso || match.updatedAt > bucket.lastUpdatedIso) {
      bucket.lastUpdatedIso = match.updatedAt;
    }
  }

  for (const [periodId, bucket] of buckets) {
    const place = placementSums.get(periodId);
    bucket.avgPlacement = place && place.count > 0 ? place.sum / place.count : 0;
  }

  return [...buckets.values()];
}

function toPeriodId(day: Date): string {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function emptyDailyRollup(
  userId: string,
  platform: string,
  periodId: string,
): PlayerStatsRollupView {
  return {
    userId,
    platform,
    granularity: 'DAILY',
    periodId,
    matchCount: 0,
    totalKills: 0,
    totalDeaths: 0,
    avgPlacement: 0,
    lastUpdatedIso: '',
  };
}

export function buildKdCumulativeTrend(
  dailyTrend: PlayerStatsRollupView[],
): TrendChartPoint[] {
  const sorted = [...dailyTrend].sort((a, b) => a.periodId.localeCompare(b.periodId));

  let kills = 0;
  let deaths = 0;

  return sorted.map((day) => {
    kills += day.totalKills;
    deaths += day.totalDeaths;

    const kd = deaths === 0 ? kills : kills / deaths;

    return {
      label: day.periodId.slice(5),
      value: Number(kd.toFixed(2)),
    };
  });
}

export function buildStatsRadarAxes(
  weekly: PlayerStatsRollupView | null,
  dailyTrend: PlayerStatsRollupView[],
): StatsRadarAxis[] {
  if (!weekly && dailyTrend.length === 0) return [];

  const w = weekly ?? aggregateDailyAsWeekly(dailyTrend);
  const kd = w.totalDeaths === 0 ? w.totalKills : w.totalKills / w.totalDeaths;
  const activeDays = dailyTrend.filter((day) => day.matchCount > 0).length;
  const avgDailyKills =
    dailyTrend.length > 0
      ? dailyTrend.reduce((sum, day) => sum + day.totalKills, 0) / dailyTrend.length
      : w.totalKills;

  return [
    {
      name: 'Actividad',
      value: clampScore((w.matchCount / 15) * 100),
    },
    {
      name: 'Eliminaciones',
      value: clampScore((w.totalKills / 45) * 100),
    },
    {
      name: 'K/D',
      value: clampScore((kd / 2.5) * 100),
    },
    {
      name: 'Placement',
      value: clampScore(w.avgPlacement > 0 ? Math.max(0, 100 - w.avgPlacement) : 0),
    },
    {
      name: 'Consistencia',
      value: clampScore((activeDays / 7) * 100),
    },
    {
      name: 'Racha diaria',
      value: clampScore((avgDailyKills / 12) * 100),
    },
  ];
}

function aggregateDailyAsWeekly(dailyTrend: PlayerStatsRollupView[]): PlayerStatsRollupView {
  const matchCount = dailyTrend.reduce((sum, day) => sum + day.matchCount, 0);
  const totalKills = dailyTrend.reduce((sum, day) => sum + day.totalKills, 0);
  const totalDeaths = dailyTrend.reduce((sum, day) => sum + day.totalDeaths, 0);
  const placementDays = dailyTrend.filter((day) => day.avgPlacement > 0);
  const avgPlacement =
    placementDays.length > 0
      ? placementDays.reduce((sum, day) => sum + day.avgPlacement, 0) / placementDays.length
      : 0;

  return {
    userId: dailyTrend[0]?.userId ?? '',
    platform: dailyTrend[0]?.platform ?? '',
    granularity: 'WEEKLY',
    periodId: 'derived',
    matchCount,
    totalKills,
    totalDeaths,
    avgPlacement,
    lastUpdatedIso: dailyTrend.at(-1)?.lastUpdatedIso ?? '',
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildPlacementTrend(dailyTrend: PlayerStatsRollupView[]): TrendChartPoint[] {
  return [...dailyTrend]
    .sort((a, b) => a.periodId.localeCompare(b.periodId))
    .map((day) => ({
      label: day.periodId.slice(5),
      value: day.avgPlacement > 0 ? Number(day.avgPlacement.toFixed(1)) : 0,
    }));
}

/** Forma multi-semana (WR + K/D|KDA) a partir del historial de partidas. */
export function buildWeeklyFormFromMatches(
  matches: MatchUpdateView[],
  options?: { weeks?: number; useKda?: boolean },
): WeeklyFormPoint[] {
  const weeks = options?.weeks ?? 6;
  const useKda = Boolean(options?.useKda);
  const periodIds = listRecentWeeklyPeriodIds(weeks);
  const buckets = new Map(
    periodIds.map((periodId) => [
      periodId,
      { matchCount: 0, winCount: 0, kills: 0, deaths: 0, assists: 0 },
    ]),
  );

  for (const match of matches) {
    const stamp = new Date(match.updatedAt);
    if (Number.isNaN(stamp.getTime())) continue;
    const periodId = isoWeekPeriodIdFromDate(stamp);
    const bucket = buckets.get(periodId);
    if (!bucket) continue;
    bucket.matchCount += 1;
    bucket.kills += match.stats?.kills ?? 0;
    bucket.deaths += match.stats?.deaths ?? 0;
    bucket.assists += match.stats?.assists ?? 0;
    if (isMatchWin(match.stats)) bucket.winCount += 1;
  }

  const currentId = periodIds[periodIds.length - 1];
  return periodIds.map((periodId) => {
    const b = buckets.get(periodId)!;
    const hasData = b.matchCount > 0;
    const ratioNumerator = useKda ? b.kills + b.assists : b.kills;
    const kd = hasData
      ? Number((ratioNumerator / Math.max(b.deaths, 1)).toFixed(2))
      : null;
    const winRate = hasData
      ? Math.round((b.winCount / b.matchCount) * 1000) / 10
      : null;
    const fairScore = hasData
      ? computeFairCommunityScore({
          totalKills: b.kills,
          totalDeaths: b.deaths,
          totalAssists: b.assists,
          winCount: b.winCount,
          matchCount: b.matchCount,
        })
      : null;
    return {
      periodId,
      label: periodId.replace(/^\d{4}-/, ''),
      winRate,
      kd,
      fairScore,
      matchCount: b.matchCount,
      winCount: b.winCount,
      hasData,
      isCurrent: periodId === currentId,
    };
  });
}

function isoWeekPeriodIdFromDate(date: Date): string {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
