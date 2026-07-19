import type { EChartsOption } from 'echarts';
import type { StatsRadarAxis } from './stats-chart.util';
import type { TrendChartPoint } from './chart.types';

export type TrendChartVariant = 'bar' | 'line' | 'area';

const CHART_COLORS = {
  /** Paleta alineada a Inicio / LoL (oro). Sin cyan. */
  primary: '#f0d060',
  primarySoft: 'rgba(240, 208, 96, 0.2)',
  lime: '#f0d060',
  limeSoft: 'rgba(240, 208, 96, 0.18)',
  gold: '#f0d060',
  goldSoft: 'rgba(240, 208, 96, 0.22)',
  /** Peers / benchmark secundario (bronce, no cyan). */
  muted: '#c89b3c',
  mutedSoft: 'rgba(200, 155, 60, 0.22)',
  /** Alias legacy → oro (evita cyan en charts compartidos). */
  cyan: '#c89b3c',
  cyanSoft: 'rgba(200, 155, 60, 0.2)',
  pink: '#ff4d9a',
  text: '#a8b2c6',
  textMuted: '#738095',
  grid: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255, 255, 255, 0.1)',
};

function softGradient(top: string, bottom: string) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: top },
      { offset: 1, color: bottom },
    ],
  };
}

export function buildTrendChartOptions(
  points: TrendChartPoint[],
  options?: {
    variant?: TrendChartVariant;
    color?: string;
    areaColor?: string;
    yAxisName?: string;
  },
): EChartsOption {
  const variant = options?.variant ?? 'bar';
  const color = options?.color ?? CHART_COLORS.primary;
  const areaColor = options?.areaColor ?? CHART_COLORS.primarySoft;
  const labels = points.map((point) => point.label);
  const values = points.map((point) => point.value);

  const baseSeries =
    variant === 'line' || variant === 'area'
      ? {
          type: 'line' as const,
          smooth: true,
          connectNulls: false,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color },
          itemStyle: { color, borderColor: '#0a1020', borderWidth: 2 },
          areaStyle:
            variant === 'area'
              ? {
                  color: softGradient(areaColor, 'rgba(10, 16, 32, 0)'),
                }
              : undefined,
          emphasis: {
            focus: 'none' as const,
            itemStyle: { shadowBlur: 12, shadowColor: areaColor },
          },
        }
      : {
          type: 'bar' as const,
          barWidth: '54%',
          itemStyle: {
            color: softGradient(color, areaColor),
            borderRadius: [8, 8, 2, 2],
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 14,
              shadowColor: areaColor,
            },
          },
        };

  return {
    animationDuration: 680,
    animationEasing: 'cubicOut',
    grid: {
      left: 8,
      right: 10,
      top: 22,
      bottom: 4,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 14, 24, 0.94)',
      borderColor: CHART_COLORS.border,
      textStyle: { color: '#f2f5fb', fontSize: 12 },
      axisPointer: {
        type: variant === 'bar' ? 'shadow' : 'line',
        lineStyle: { color: 'rgba(240, 208, 96, 0.35)' },
        shadowStyle: { color: 'rgba(240, 208, 96, 0.08)' },
      },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params) ? params : [];
        const row = rows[0] as { axisValueLabel?: string; value?: number | null; marker?: string };
        if (!row) return '';
        const val = row.value;
        if (val == null || Number.isNaN(Number(val))) {
          return `${row.axisValueLabel ?? ''}<br/>Sin datos`;
        }
        return `${row.marker ?? ''} ${row.axisValueLabel ?? ''}: <b>${val}</b>`;
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_COLORS.textMuted,
        fontSize: 11,
        margin: 10,
        formatter: (value: string, index: number) => {
          const point = points[index];
          if (point?.value == null) return `{gap|${value}}`;
          return value;
        },
        rich: {
          gap: { color: '#5a6578' },
        },
      },
    },
    yAxis: {
      type: 'value',
      name: options?.yAxisName,
      nameTextStyle: { color: CHART_COLORS.textMuted, fontSize: 11 },
      splitLine: {
        lineStyle: { color: CHART_COLORS.grid, type: 'dashed' },
      },
      axisLabel: {
        color: CHART_COLORS.textMuted,
        fontSize: 11,
      },
    },
    series: [
      {
        ...baseSeries,
        data: values,
      },
    ],
  };
}

export interface MatchComparisonChartRow {
  label: string;
  matchValue: number;
  averageValue: number;
}

export function buildMatchComparisonChartOptions(rows: MatchComparisonChartRow[]): EChartsOption {
  return buildYouVsBenchmarkChartOptions(
    rows.map((row) => ({
      label: row.label,
      you: row.matchValue,
      benchmark: row.averageValue,
    })),
    { you: 'Esta partida', benchmark: 'Tu promedio' },
  );
}

export function buildYouVsBenchmarkChartOptions(
  rows: Array<{ label: string; you: number; benchmark: number }>,
  labels: { you: string; benchmark: string } = { you: 'Vos', benchmark: 'Comunidad' },
): EChartsOption {
  if (rows.length === 0) return {};

  return {
    animationDuration: 680,
    grid: { left: 8, right: 8, top: 36, bottom: 0, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: CHART_COLORS.text, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 14, 24, 0.94)',
      borderColor: CHART_COLORS.border,
      textStyle: { color: '#f2f5fb', fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' } },
      axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
    },
    series: [
      {
        name: labels.you,
        type: 'bar',
        barWidth: '28%',
        data: rows.map((row) => row.you),
        itemStyle: {
          color: softGradient(CHART_COLORS.lime, CHART_COLORS.limeSoft),
          borderRadius: [7, 7, 2, 2],
        },
        emphasis: {
          itemStyle: { shadowBlur: 12, shadowColor: CHART_COLORS.limeSoft },
        },
      },
      {
        name: labels.benchmark,
        type: 'bar',
        barWidth: '28%',
        data: rows.map((row) => row.benchmark),
        itemStyle: {
          color: softGradient(CHART_COLORS.muted, CHART_COLORS.mutedSoft),
          borderRadius: [7, 7, 2, 2],
        },
      },
    ],
  };
}

export function buildMatchRadarOptions(
  axes: StatsRadarAxis[],
  seriesName = 'Esta partida',
): EChartsOption {
  const base = buildStatsRadarOptions(axes);
  const series = base.series;
  if (Array.isArray(series) && series[0] && typeof series[0] === 'object') {
    const radarSeries = series[0] as { data?: Array<{ name?: string; value: number[] }> };
    if (radarSeries.data?.[0]) {
      radarSeries.data[0].name = seriesName;
    }
  }
  return base;
}

export function buildDualTrendChartOptions(
  primary: TrendChartPoint[],
  secondary: TrendChartPoint[],
  labels: { primary: string; secondary: string },
): EChartsOption {
  const categories = primary.map((point) => point.label);

  return {
    animationDuration: 680,
    grid: {
      left: 8,
      right: 8,
      top: 36,
      bottom: 0,
      containLabel: true,
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: CHART_COLORS.text, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 14, 24, 0.94)',
      borderColor: CHART_COLORS.border,
      textStyle: { color: '#f2f5fb', fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' } },
      axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
    },
    series: [
      {
        name: labels.primary,
        type: 'bar',
        barWidth: '34%',
        data: primary.map((point) => point.value),
        itemStyle: {
          color: softGradient(CHART_COLORS.gold, CHART_COLORS.goldSoft),
          borderRadius: [6, 6, 2, 2],
        },
      },
      {
        name: labels.secondary,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: secondary.map((point) => point.value),
        lineStyle: { width: 3, color: CHART_COLORS.muted },
        itemStyle: { color: CHART_COLORS.muted, borderColor: '#0a1020', borderWidth: 2 },
        areaStyle: {
          color: softGradient(CHART_COLORS.mutedSoft, 'rgba(10, 16, 32, 0)'),
        },
      },
    ],
  };
}

type WeeklyFormChartPoint = {
  label: string;
  winRate: number | null;
  kd: number | null;
  matchCount: number;
  hasData?: boolean;
  isCurrent?: boolean;
};

function weeklyFormSeriesPoint(
  value: number | null,
  point: { isCurrent?: boolean },
  color: string,
): number | null | { value: number; symbolSize: number; itemStyle: Record<string, unknown> } {
  if (value == null) return null;
  if (!point.isCurrent) return value;
  return {
    value,
    symbolSize: 11,
    itemStyle: {
      color,
      borderColor: '#fff3c4',
      borderWidth: 2,
      shadowBlur: 12,
      shadowColor: 'rgba(240, 208, 96, 0.55)',
    },
  };
}

/** Forma multi-semana: WR (%) + K/D|KDA con ejes independientes. */
export function buildWeeklyFormChartOptions(
  points: WeeklyFormChartPoint[],
  kdLabel = 'K/D',
): EChartsOption {
  if (!points.length) return {};
  const categories = points.map((p) => p.label);

  return {
    animationDuration: 720,
    grid: {
      left: 8,
      right: 12,
      top: 36,
      bottom: 0,
      containLabel: true,
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: CHART_COLORS.text, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    tooltip: {
      trigger: 'axis',
      triggerOn: 'mousemove',
      appendTo: 'body',
      confine: false,
      padding: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      extraCssText: 'box-shadow: none; padding: 0; border: 0; background: transparent;',
      className: 'sg-echart-tip',
      axisPointer: {
        type: 'line',
        lineStyle: { color: 'rgba(240, 208, 96, 0.35)', width: 1.5, type: 'dashed' },
      },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params) ? params : [];
        if (!rows.length) return '';
        const idx =
          typeof (rows[0] as { dataIndex?: number }).dataIndex === 'number'
            ? (rows[0] as { dataIndex: number }).dataIndex
            : 0;
        const point = points[idx];
        const week = escapeHtml(
          String((rows[0] as { axisValueLabel?: string }).axisValueLabel ?? point?.label ?? ''),
        );
        const currentTag = point?.isCurrent ? ' · esta semana' : '';
        if (!point?.hasData && (point?.matchCount ?? 0) === 0) {
          return `
            <div class="sg-echart-tip__card">
              <p class="sg-echart-tip__name">${week}${currentTag}</p>
              <p class="sg-echart-tip__empty u-m-0">Sin partidas esta semana</p>
            </div>
          `;
        }
        const wr = point.winRate;
        const kd = point.kd;
        const wrLabel = wr == null ? '—' : `${Number(wr).toFixed(1)}%`;
        const kdVal = kd == null ? '—' : Number(kd).toFixed(2);
        const matches = point.matchCount;
        return `
          <div class="sg-echart-tip__card">
            <p class="sg-echart-tip__name">${week}${currentTag}</p>
            <dl class="sg-echart-tip__stats sg-echart-tip__stats--form">
              <div><dt>WR</dt><dd>${wrLabel}</dd></div>
              <div><dt>${escapeHtml(kdLabel)}</dt><dd>${kdVal}</dd></div>
              <div><dt>Games</dt><dd>${matches}</dd></div>
            </dl>
          </div>
        `;
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_COLORS.textMuted,
        fontSize: 11,
        formatter: (value: string, index: number) => {
          const point = points[index];
          if (point?.isCurrent) return `{current|${value}}`;
          if (!point?.hasData) return `{gap|${value}}`;
          return value;
        },
        rich: {
          current: {
            color: CHART_COLORS.gold,
            fontWeight: 700,
          },
          gap: {
            color: '#5a6578',
          },
        },
      },
    },
    yAxis: [
      {
        type: 'value',
        name: 'WR %',
        min: 0,
        max: 100,
        nameTextStyle: { color: CHART_COLORS.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' } },
        axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
      },
      {
        type: 'value',
        name: kdLabel,
        min: 0,
        nameTextStyle: { color: CHART_COLORS.textMuted, fontSize: 10 },
        splitLine: { show: false },
        axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
      },
    ],
    series: [
      {
        name: 'Win rate',
        type: 'line',
        smooth: true,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: true,
        yAxisIndex: 0,
        data: points.map((p) => weeklyFormSeriesPoint(p.winRate, p, CHART_COLORS.gold)),
        selectedMode: false,
        lineStyle: { width: 3, color: CHART_COLORS.gold },
        itemStyle: {
          color: CHART_COLORS.gold,
          borderColor: '#0a1020',
          borderWidth: 2,
        },
        areaStyle: {
          color: softGradient(CHART_COLORS.goldSoft, 'rgba(10, 16, 32, 0)'),
        },
        emphasis: {
          focus: 'none',
          scale: 1.15,
          itemStyle: {
            color: CHART_COLORS.gold,
            borderColor: '#f5e6a8',
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: 'rgba(240, 208, 96, 0.45)',
          },
          lineStyle: { width: 3.5, color: CHART_COLORS.gold },
        },
        blur: {
          itemStyle: { opacity: 1 },
          lineStyle: { opacity: 1 },
          areaStyle: { opacity: 1 },
        },
        select: { disabled: true },
      },
      {
        name: kdLabel,
        type: 'line',
        smooth: true,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: true,
        yAxisIndex: 1,
        data: points.map((p) => weeklyFormSeriesPoint(p.kd, p, CHART_COLORS.muted)),
        selectedMode: false,
        lineStyle: { width: 3, color: CHART_COLORS.muted },
        itemStyle: {
          color: CHART_COLORS.muted,
          borderColor: '#0a1020',
          borderWidth: 2,
        },
        emphasis: {
          focus: 'none',
          scale: 1.15,
          itemStyle: {
            color: CHART_COLORS.muted,
            borderColor: '#e0c078',
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: 'rgba(200, 155, 60, 0.4)',
          },
          lineStyle: { width: 3.5, color: CHART_COLORS.muted },
        },
        blur: {
          itemStyle: { opacity: 1 },
          lineStyle: { opacity: 1 },
        },
        select: { disabled: true },
      },
    ],
  };
}

/** Score justo multi-semana (misma fórmula que el ranking de la muestra). */
export function buildWeeklyFairScoreChartOptions(
  points: Array<{
    label: string;
    fairScore: number | null;
    matchCount: number;
    winRate: number | null;
    hasData?: boolean;
    isCurrent?: boolean;
  }>,
  peerMedian?: Array<number | null>,
): EChartsOption {
  if (!points.length) return {};
  const categories = points.map((p) => p.label);
  const scores = points.map((p) =>
    weeklyFormSeriesPoint(p.fairScore, p, CHART_COLORS.gold),
  );
  const medianSeries = (peerMedian ?? []).map((v) => (v == null ? null : v));
  const hasPeerMedian = medianSeries.some((v) => v != null);
  const numericScores = [
    ...points.map((p) => p.fairScore),
    ...medianSeries,
  ].filter((v): v is number => v != null);
  const maxScore = Math.max(...numericScores, 1);
  const yMax = Math.ceil(maxScore * 1.15);

  return {
    animationDuration: 720,
    grid: {
      left: 8,
      right: 8,
      top: 28,
      bottom: 0,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      triggerOn: 'mousemove',
      appendTo: 'body',
      confine: false,
      padding: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      extraCssText: 'box-shadow: none; padding: 0; border: 0; background: transparent;',
      className: 'sg-echart-tip',
      axisPointer: {
        type: 'line',
        lineStyle: { color: 'rgba(240, 208, 96, 0.35)', width: 1.5, type: 'dashed' },
      },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params) ? params : [];
        if (!rows.length) return '';
        const idx =
          typeof (rows[0] as { dataIndex?: number }).dataIndex === 'number'
            ? (rows[0] as { dataIndex: number }).dataIndex
            : 0;
        const point = points[idx];
        const week = escapeHtml(
          String((rows[0] as { axisValueLabel?: string }).axisValueLabel ?? point?.label ?? ''),
        );
        const currentTag = point?.isCurrent ? ' · esta semana' : '';
        if (!point?.hasData && (point?.matchCount ?? 0) === 0) {
          return `
            <div class="sg-echart-tip__card">
              <p class="sg-echart-tip__name">${week}${currentTag}</p>
              <p class="sg-echart-tip__empty u-m-0">Sin partidas esta semana</p>
            </div>
          `;
        }
        const score = point.fairScore ?? '—';
        const wr = point.winRate == null ? '—' : `${point.winRate.toFixed(1)}%`;
        const matches = point.matchCount;
        const median = hasPeerMedian ? medianSeries[idx] : null;
        const medianLabel = median == null ? '—' : String(median);
        return `
          <div class="sg-echart-tip__card">
            <p class="sg-echart-tip__name">${week}${currentTag}</p>
            <dl class="sg-echart-tip__stats sg-echart-tip__stats--form">
              <div><dt>Vos</dt><dd>${score}</dd></div>
              <div><dt>Mediana</dt><dd>${medianLabel}</dd></div>
              <div><dt>Games</dt><dd>${matches}</dd></div>
            </dl>
            <p class="sg-echart-tip__empty u-m-0" style="margin-top:6px">WR ${wr}</p>
          </div>
        `;
      },
    },
    legend: hasPeerMedian
      ? {
          top: 0,
          right: 0,
          textStyle: { color: CHART_COLORS.text, fontSize: 11 },
          itemWidth: 10,
          itemHeight: 10,
        }
      : undefined,
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_COLORS.textMuted,
        fontSize: 11,
        formatter: (value: string, index: number) => {
          const point = points[index];
          if (point?.isCurrent) return `{current|${value}}`;
          if (!point?.hasData) return `{gap|${value}}`;
          return value;
        },
        rich: {
          current: {
            color: CHART_COLORS.gold,
            fontWeight: 700,
          },
          gap: {
            color: '#5a6578',
          },
        },
      },
    },
    yAxis: {
      type: 'value',
      name: 'Score',
      min: 0,
      max: yMax,
      nameTextStyle: { color: CHART_COLORS.textMuted, fontSize: 10 },
      splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' } },
      axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
    },
    series: [
      {
        name: 'Score justo',
        type: 'line',
        smooth: true,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: true,
        data: scores,
        selectedMode: false,
        lineStyle: { width: 3, color: CHART_COLORS.gold },
        itemStyle: {
          color: CHART_COLORS.gold,
          borderColor: '#0a1020',
          borderWidth: 2,
        },
        areaStyle: {
          color: softGradient(CHART_COLORS.goldSoft, 'rgba(10, 16, 32, 0)'),
        },
        emphasis: {
          focus: 'none',
          scale: 1.15,
          itemStyle: {
            color: CHART_COLORS.gold,
            borderColor: '#f5e6a8',
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: 'rgba(240, 208, 96, 0.45)',
          },
          lineStyle: { width: 3.5, color: CHART_COLORS.gold },
        },
        blur: {
          itemStyle: { opacity: 1 },
          lineStyle: { opacity: 1 },
          areaStyle: { opacity: 1 },
        },
        select: { disabled: true },
      },
      ...(hasPeerMedian
        ? [
            {
              name: 'Mediana peers',
              type: 'line' as const,
              smooth: true,
              connectNulls: false,
              symbol: 'circle',
              symbolSize: 6,
              showSymbol: true,
              data: medianSeries,
              selectedMode: false as const,
              lineStyle: { width: 2, color: CHART_COLORS.muted, type: 'dashed' as const },
              itemStyle: {
                color: CHART_COLORS.muted,
                borderColor: '#0a1020',
                borderWidth: 1,
              },
              emphasis: { focus: 'none' as const },
              select: { disabled: true },
            },
          ]
        : []),
    ],
  };
}

/** Curva dual CS / Gold con ejes independientes (timeline LoL estimado). */
export function buildEconomyTimelineChartOptions(
  csTrend: TrendChartPoint[],
  goldTrend: TrendChartPoint[],
): EChartsOption {
  if (!csTrend.length && !goldTrend.length) return {};
  const categories = (csTrend.length ? csTrend : goldTrend).map((point) => point.label);

  return {
    animationDuration: 720,
    grid: {
      left: 8,
      right: 12,
      top: 36,
      bottom: 0,
      containLabel: true,
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: CHART_COLORS.text, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 14, 24, 0.94)',
      borderColor: CHART_COLORS.border,
      textStyle: { color: '#f2f5fb', fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'CS',
        nameTextStyle: { color: CHART_COLORS.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' } },
        axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
      },
      {
        type: 'value',
        name: 'Gold',
        nameTextStyle: { color: CHART_COLORS.textMuted, fontSize: 10 },
        splitLine: { show: false },
        axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
      },
    ],
    series: [
      {
        name: 'CS acum.',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        yAxisIndex: 0,
        data: csTrend.map((point) => point.value),
        lineStyle: { width: 3, color: CHART_COLORS.lime },
        itemStyle: { color: CHART_COLORS.lime, borderColor: '#0a1020', borderWidth: 2 },
        areaStyle: {
          color: softGradient(CHART_COLORS.limeSoft, 'rgba(10, 16, 32, 0)'),
        },
      },
      {
        name: 'Gold acum.',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        yAxisIndex: 1,
        data: goldTrend.map((point) => point.value),
        lineStyle: { width: 3, color: CHART_COLORS.gold },
        itemStyle: { color: CHART_COLORS.gold, borderColor: '#0a1020', borderWidth: 2 },
        areaStyle: {
          color: softGradient(CHART_COLORS.goldSoft, 'rgba(10, 16, 32, 0)'),
        },
      },
    ],
  };
}

export function buildStatsRadarOptions(axes: StatsRadarAxis[]): EChartsOption {
  if (axes.length === 0) return {};

  const indicator = axes.map((axis) => ({
    name: axis.name,
    max: 100,
  }));

  return {
    animationDuration: 720,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 14, 24, 0.94)',
      borderColor: CHART_COLORS.border,
      textStyle: { color: '#f2f5fb', fontSize: 12 },
    },
    radar: {
      center: ['50%', '54%'],
      radius: '64%',
      splitNumber: 4,
      axisName: {
        color: CHART_COLORS.text,
        fontSize: 11,
      },
      splitLine: {
        lineStyle: { color: CHART_COLORS.grid },
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(255,255,255,0.015)', 'rgba(61,224,245,0.04)'],
        },
      },
      axisLine: {
        lineStyle: { color: CHART_COLORS.border },
      },
      indicator,
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 2.5,
          color: CHART_COLORS.lime,
        },
        itemStyle: {
          color: CHART_COLORS.lime,
          borderColor: '#0a1020',
          borderWidth: 2,
        },
        areaStyle: {
          color: CHART_COLORS.limeSoft,
        },
        data: [
          {
            value: axes.map((axis) => axis.value),
            name: 'Semana actual',
          },
        ],
      },
    ],
  };
}

export interface PercentileGaugeItem {
  name: string;
  value: number;
  tone?: 'elite' | 'strong' | 'average' | 'weak';
}

export function buildPercentileGaugesOptions(items: PercentileGaugeItem[]): EChartsOption {
  if (items.length === 0) return {};

  const colors: Record<string, string> = {
    elite: CHART_COLORS.gold,
    strong: CHART_COLORS.muted,
    average: '#8fa3c4',
    weak: CHART_COLORS.pink,
  };

  const centers = items.map((_, index) => {
    const count = items.length;
    const x = ((index + 0.5) / count) * 100;
    return [`${x}%`, '56%'] as [string, string];
  });

  return {
    animationDuration: 760,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 14, 24, 0.94)',
      borderColor: CHART_COLORS.border,
      textStyle: { color: '#f2f5fb', fontSize: 12 },
      formatter: (params: unknown) => {
        const p = params as { name?: string; value?: number };
        return `${p.name ?? ''}: mejor que el ${p.value ?? 0}%`;
      },
    },
    series: items.map((item, index) => {
      const color = colors[item.tone ?? 'strong'] ?? CHART_COLORS.gold;
      return {
        type: 'gauge',
        center: centers[index],
        radius: items.length > 3 ? '58%' : '68%',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        splitNumber: 4,
        itemStyle: { color },
        progress: {
          show: true,
          width: 10,
          roundCap: true,
        },
        pointer: { show: false },
        axisLine: {
          lineStyle: {
            width: 10,
            color: [[1, 'rgba(255,255,255,0.08)']],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: {
          offsetCenter: [0, '72%'],
          color: CHART_COLORS.textMuted,
          fontSize: 11,
        },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '8%'],
          formatter: '{value}%',
          color: color,
          fontSize: 18,
          fontWeight: 700,
        },
        data: [{ value: item.value, name: item.name }],
      };
    }),
  };
}

export interface PeerBenchmarkPoint {
  gamerTag: string;
  kd: number;
  winRate: number;
  score: number;
  isYou?: boolean;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Normaliza WR a 0–100 (API a veces manda 0–1). */
function normalizeWinRatePct(value: unknown): number {
  let wr = finiteNumber(value, 0);
  if (wr > 0 && wr <= 1) wr *= 100;
  return Math.max(0, Math.min(100, wr));
}

function scatterSymbolSize(score: number): number {
  return Math.max(12, Math.min(30, 11 + finiteNumber(score) / 70));
}

function toScatterDatum(point: PeerBenchmarkPoint): {
  name: string;
  value: [number, number, number];
  symbolSize: number;
} {
  const wr = normalizeWinRatePct(point.winRate);
  const kd = Math.max(0, finiteNumber(point.kd));
  const score = Math.max(0, finiteNumber(point.score));
  return {
    name: point.gamerTag || 'Jugador',
    value: [wr, kd, score],
    symbolSize: scatterSymbolSize(score),
  };
}

/** Scatter WR × KDA de peers; resalta al usuario. */
export function buildPeerBenchmarkScatterOptions(
  peers: PeerBenchmarkPoint[],
): EChartsOption {
  const valid = (peers ?? []).filter((p) => Boolean(p?.gamerTag) || p?.isYou);
  if (!valid.length) return {};

  const others = valid.filter((p) => !p.isYou).map(toScatterDatum);
  const youPoint = valid.find((p) => p.isYou);
  const you = youPoint ? toScatterDatum(youPoint) : null;

  const allKd = [...others, ...(you ? [you] : [])].map((d) => d.value[1]);
  const maxKd = Math.max(2, ...allKd, 0);
  const yMax = Math.ceil(maxKd * 1.25 * 10) / 10;

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: 8, right: 12, top: 40, bottom: 36, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: CHART_COLORS.text, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove|click|mousewheel',
      appendTo: 'body',
      confine: false,
      enterable: false,
      hideDelay: 80,
      padding: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      extraCssText: 'box-shadow: none; padding: 0; border: 0; background: transparent;',
      className: 'sg-echart-tip',
      formatter: (params: unknown) => {
        const p = params as {
          seriesName?: string;
          data?: { value?: number[]; name?: string } | number[];
          name?: string;
        };
        const raw = p.data;
        const value = Array.isArray(raw) ? raw : (raw?.value ?? []);
        const tag = escapeHtml(
          (Array.isArray(raw) ? undefined : raw?.name) ?? p.name ?? p.seriesName ?? 'Jugador',
        );
        const wr = Number(value[0] ?? 0).toFixed(0);
        const kd = Number(value[1] ?? 0).toFixed(2);
        const score = Number(value[2] ?? 0).toFixed(0);
        const isYou = p.seriesName === 'Vos';
        return `
          <div class="sg-echart-tip__card${isYou ? ' sg-echart-tip__card--you' : ''}">
            <p class="sg-echart-tip__name">${tag}${isYou ? ' · Vos' : ''}</p>
            <dl class="sg-echart-tip__stats">
              <div><dt>WR</dt><dd>${wr}%</dd></div>
              <div><dt>KDA</dt><dd>${kd}</dd></div>
              <div><dt>Score</dt><dd>${score}</dd></div>
            </dl>
          </div>
        `;
      },
    },
    xAxis: {
      type: 'value',
      name: 'Win rate %',
      nameLocation: 'middle',
      nameGap: 28,
      min: 0,
      max: 100,
      scale: false,
      nameTextStyle: { color: CHART_COLORS.textMuted, fontSize: 11 },
      axisLine: { show: true, lineStyle: { color: CHART_COLORS.border } },
      splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' } },
      axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: 'KDA',
      min: 0,
      max: yMax,
      nameTextStyle: { color: CHART_COLORS.textMuted, fontSize: 11 },
      axisLine: { show: true, lineStyle: { color: CHART_COLORS.border } },
      splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' } },
      axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
    },
    series: [
      {
        name: 'Peers',
        type: 'scatter',
        data: others,
        cursor: 'pointer',
        selectedMode: false,
        itemStyle: {
          color: CHART_COLORS.muted,
          opacity: 0.88,
          borderColor: 'rgba(10, 16, 32, 0.9)',
          borderWidth: 1,
        },
        emphasis: {
          scale: 1.08,
          focus: 'none',
          itemStyle: {
            color: '#e0b84a',
            borderColor: '#f0d060',
            borderWidth: 2,
            opacity: 1,
          },
          label: { show: false },
        },
        blur: {
          itemStyle: { opacity: 0.88 },
        },
        select: {
          disabled: true,
        },
      },
      ...(you
        ? [
            {
              name: 'Vos',
              type: 'scatter' as const,
              z: 10,
              data: [you],
              cursor: 'pointer' as const,
              selectedMode: false as const,
              itemStyle: {
                color: CHART_COLORS.gold,
                borderColor: '#c89b3c',
                borderWidth: 2,
                shadowBlur: 10,
                shadowColor: CHART_COLORS.goldSoft,
              },
              label: {
                show: true,
                formatter: 'Vos',
                position: 'top' as const,
                color: CHART_COLORS.gold,
                fontSize: 11,
                fontWeight: 700 as const,
              },
              emphasis: {
                scale: 1.06,
                focus: 'none' as const,
                itemStyle: {
                  color: CHART_COLORS.gold,
                  borderColor: '#f0d060',
                  borderWidth: 2,
                  opacity: 1,
                },
                label: { show: true },
              },
              blur: {
                itemStyle: { opacity: 1 },
              },
              select: {
                disabled: true,
              },
            },
          ]
        : []),
    ],
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Barras horizontales de score vs peers (muestra). */
export function buildPeerScoreBarOptions(
  peers: PeerBenchmarkPoint[],
  limit = 12,
): EChartsOption {
  if (!peers.length) return {};

  const sorted = [...peers].sort((a, b) => b.score - a.score).slice(0, limit);
  const labels = sorted.map((p) => (p.isYou ? `${p.gamerTag} · Vos` : p.gamerTag));
  const values = sorted.map((p) => p.score);
  const colors = sorted.map((p) =>
    p.isYou
      ? softGradient(CHART_COLORS.gold, CHART_COLORS.goldSoft)
      : softGradient(CHART_COLORS.muted, CHART_COLORS.mutedSoft),
  );

  return {
    animationDuration: 680,
    grid: { left: 8, right: 16, top: 8, bottom: 0, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 14, 24, 0.94)',
      borderColor: CHART_COLORS.border,
      textStyle: { color: '#f2f5fb', fontSize: 12 },
      axisPointer: { type: 'shadow' },
    },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' } },
      axisLabel: { color: CHART_COLORS.textMuted, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: labels,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_COLORS.textMuted,
        fontSize: 10,
        width: 110,
        overflow: 'truncate',
      },
    },
    series: [
      {
        type: 'bar',
        barWidth: '58%',
        data: values.map((value, index) => ({
          value,
          itemStyle: {
            color: colors[index],
            borderRadius: [0, 6, 6, 0],
          },
        })),
        label: {
          show: true,
          position: 'right',
          color: CHART_COLORS.text,
          fontSize: 10,
        },
      },
    ],
  };
}
