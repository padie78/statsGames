import type { StatsGranularity } from '@stats-games/common';

const GRANULARITIES: StatsGranularity[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

export function resolveStatsPeriodIds(
  occurredAtIso: string,
): Array<{ granularity: StatsGranularity; periodId: string }> {
  const date = new Date(occurredAtIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`occurredAtIso inválido: ${occurredAtIso}`);
  }

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');

  const daily = `${y}-${m}-${d}`;
  const weekly = `${y}-W${isoWeek(date)}`;
  const monthly = `${y}-${m}`;

  return [
    { granularity: 'DAILY', periodId: daily },
    { granularity: 'WEEKLY', periodId: weekly },
    { granularity: 'MONTHLY', periodId: monthly },
  ];
}

export function allStatsGranularities(): StatsGranularity[] {
  return [...GRANULARITIES];
}

function isoWeek(date: Date): string {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return String(week).padStart(2, '0');
}
