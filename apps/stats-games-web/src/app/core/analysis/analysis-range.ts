/** Ventanas de análisis para Inicio / Evolución. */
export type AnalysisRangeId = 'day' | 'week' | '30d' | '90d';

export interface AnalysisRangeMeta {
  id: AnalysisRangeId;
  label: string;
  shortLabel: string;
  /** Días rolling (solo 30d / 90d). Día y semana usan filtros de calendario. */
  days: number;
  /** Semanas ISO en el chart de forma. */
  formWeeks: number;
  /** Días a pedir al API de rollups diarios (tope backend = 30). */
  dailyApiDays: number;
  description: string;
  /** Preferir rollup WEEKLY de la semana ISO actual para KPIs. */
  preferWeeklyRollup: boolean;
  /** Filtrar por un día calendario concreto (`selectedDayIso`). */
  isSingleDay: boolean;
}

export const ANALYSIS_RANGE_OPTIONS: readonly AnalysisRangeMeta[] = [
  {
    id: 'day',
    label: 'Día',
    shortLabel: 'Día',
    days: 1,
    formWeeks: 4,
    dailyApiDays: 14,
    description: 'Un día calendario concreto',
    preferWeeklyRollup: false,
    isSingleDay: true,
  },
  {
    id: 'week',
    label: 'Esta semana',
    shortLabel: 'Sem',
    days: 7,
    formWeeks: 4,
    dailyApiDays: 7,
    description: 'Semana ISO en curso (lun–dom)',
    preferWeeklyRollup: true,
    isSingleDay: false,
  },
  {
    id: '30d',
    label: '30 días',
    shortLabel: '30d',
    days: 30,
    formWeeks: 8,
    dailyApiDays: 30,
    description: 'Últimos 30 días corridos',
    preferWeeklyRollup: false,
    isSingleDay: false,
  },
  {
    id: '90d',
    label: '90 días',
    shortLabel: '90d',
    days: 90,
    formWeeks: 12,
    dailyApiDays: 30,
    description: 'Últimos 90 días corridos',
    preferWeeklyRollup: false,
    isSingleDay: false,
  },
] as const;

const BY_ID = new Map(ANALYSIS_RANGE_OPTIONS.map((opt) => [opt.id, opt]));

export function isAnalysisRangeId(value: unknown): value is AnalysisRangeId {
  return typeof value === 'string' && BY_ID.has(value as AnalysisRangeId);
}

export function getAnalysisRangeMeta(id: AnalysisRangeId): AnalysisRangeMeta {
  return BY_ID.get(id) ?? ANALYSIS_RANGE_OPTIONS[1];
}

/**
 * Semanas ISO de leaderboard a agregar para el rango.
 * El backend solo guarda boards semanales, así que 30d/90d se construyen sumando semanas.
 */
export function analysisRangeWeekSpan(id: AnalysisRangeId): number {
  switch (id) {
    case 'day':
    case 'week':
      return 1;
    case '30d':
      return 5;
    case '90d':
      return 13;
  }
}

/** Hoy en UTC como `YYYY-MM-DD`. */
export function todayPeriodId(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Día anterior a un `YYYY-MM-DD`. */
export function previousPeriodId(dayIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayIso.trim());
  if (!match) return todayPeriodId();
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() - 1);
  return todayPeriodId(date);
}

export function formatDayLabel(dayIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayIso.trim());
  if (!match) return dayIso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function analysisRangeNoun(id: AnalysisRangeId, dayIso?: string): string {
  switch (id) {
    case 'day':
      return dayIso ? formatDayLabel(dayIso) : 'el día';
    case 'week':
      return 'esta semana';
    case '30d':
      return '30 días';
    case '90d':
      return '90 días';
  }
}

export function analysisRangeCompareTitle(id: AnalysisRangeId): string {
  switch (id) {
    case 'day':
      return 'Día elegido vs el anterior';
    case 'week':
      return 'Esta semana vs la anterior';
    case '30d':
      return 'Últimos 30 días vs anteriores';
    case '90d':
      return 'Últimos 90 días vs anteriores';
  }
}

export function analysisRangeCompareSubtitle(id: AnalysisRangeId): string {
  switch (id) {
    case 'day':
      return 'Delta de partidas, kills y resultados respecto al día calendario previo.';
    case 'week':
      return 'Delta de partidas, kills y resultados respecto a la semana ISO previa.';
    case '30d':
      return 'Delta de partidas, kills y resultados respecto a los 30 días previos.';
    case '90d':
      return 'Delta de partidas, kills y resultados respecto a los 90 días previos.';
  }
}
