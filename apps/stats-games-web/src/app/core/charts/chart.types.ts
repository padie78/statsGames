export interface TrendChartPoint {
  label: string;
  /** null = gap (día/semana sin data). */
  value: number | null;
}

export interface MatchDailyTrendSeries {
  kills: TrendChartPoint[];
  matches: TrendChartPoint[];
  placement: TrendChartPoint[];
}
