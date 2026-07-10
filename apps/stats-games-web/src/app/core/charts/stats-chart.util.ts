import type { PlayerStatsRollupView } from '../../services/stats.service';
import type { TrendChartPoint } from './chart.types';

export interface StatsRadarAxis {
  name: string;
  value: number;
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
