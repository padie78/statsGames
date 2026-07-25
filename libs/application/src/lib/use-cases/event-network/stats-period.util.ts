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

/** ISO week id for a Date (UTC): `2026-W30`. */
export function isoWeekPeriodIdFromDate(date: Date = new Date()): string {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  return `${tmp.getUTCFullYear()}-W${isoWeek(tmp)}`;
}

/** Semana ISO anterior (`2026-W30` → `2026-W29`). */
export function previousWeeklyPeriodId(periodId: string): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(periodId.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  // Lunes de esa semana ISO → restar 7 días.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (day - 1) + (week - 1) * 7);
  monday.setUTCDate(monday.getUTCDate() - 7);
  return isoWeekPeriodIdFromDate(monday);
}
