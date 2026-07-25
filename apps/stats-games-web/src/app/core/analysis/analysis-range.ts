/** Ventanas de análisis para Inicio / Evolución. */
export type AnalysisRangeId = 'week' | '7d' | '30d' | '90d';

export interface AnalysisRangeMeta {
  id: AnalysisRangeId;
  label: string;
  shortLabel: string;
  /** Días rolling para filtrar partidas y curvas diarias. */
  days: number;
  /** Semanas ISO en el chart de forma. */
  formWeeks: number;
  /** Días a pedir al API de rollups diarios (tope backend = 30). */
  dailyApiDays: number;
  description: string;
  /** Preferir rollup WEEKLY de la semana ISO actual para KPIs. */
  preferWeeklyRollup: boolean;
}

export const ANALYSIS_RANGE_OPTIONS: readonly AnalysisRangeMeta[] = [
  {
    id: 'week',
    label: 'Esta semana',
    shortLabel: 'Sem',
    days: 7,
    formWeeks: 4,
    dailyApiDays: 7,
    description: 'Semana ISO en curso',
    preferWeeklyRollup: true,
  },
  {
    id: '7d',
    label: '7 días',
    shortLabel: '7d',
    days: 7,
    formWeeks: 4,
    dailyApiDays: 7,
    description: 'Últimos 7 días',
    preferWeeklyRollup: false,
  },
  {
    id: '30d',
    label: '30 días',
    shortLabel: '30d',
    days: 30,
    formWeeks: 8,
    dailyApiDays: 30,
    description: 'Últimos 30 días',
    preferWeeklyRollup: false,
  },
  {
    id: '90d',
    label: '90 días',
    shortLabel: '90d',
    days: 90,
    formWeeks: 12,
    dailyApiDays: 30,
    description: 'Últimos 90 días',
    preferWeeklyRollup: false,
  },
] as const;

const BY_ID = new Map(ANALYSIS_RANGE_OPTIONS.map((opt) => [opt.id, opt]));

export function isAnalysisRangeId(value: unknown): value is AnalysisRangeId {
  return typeof value === 'string' && BY_ID.has(value as AnalysisRangeId);
}

export function getAnalysisRangeMeta(id: AnalysisRangeId): AnalysisRangeMeta {
  return BY_ID.get(id) ?? ANALYSIS_RANGE_OPTIONS[0];
}

export function analysisRangeNoun(id: AnalysisRangeId): string {
  switch (id) {
    case 'week':
      return 'semana';
    case '7d':
      return '7 días';
    case '30d':
      return '30 días';
    case '90d':
      return '90 días';
  }
}

export function analysisRangeCompareTitle(id: AnalysisRangeId): string {
  switch (id) {
    case 'week':
      return 'Esta semana vs la anterior';
    case '7d':
      return 'Últimos 7 días vs anteriores';
    case '30d':
      return 'Últimos 30 días vs anteriores';
    case '90d':
      return 'Últimos 90 días vs anteriores';
  }
}

export function analysisRangeCompareSubtitle(id: AnalysisRangeId): string {
  const days = getAnalysisRangeMeta(id).days;
  if (id === 'week') {
    return 'Delta de partidas, kills y resultados respecto a la semana ISO previa.';
  }
  return `Delta de partidas, kills y resultados respecto a los ${days} días previos.`;
}
