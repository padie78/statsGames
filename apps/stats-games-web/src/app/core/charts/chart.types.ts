export interface TrendChartPoint {
  label: string;
  value: number;
}

export interface MatchDailyTrendSeries {
  kills: TrendChartPoint[];
  matches: TrendChartPoint[];
  placement: TrendChartPoint[];
}
