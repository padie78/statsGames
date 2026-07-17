import type { EChartsOption } from 'echarts';
import type { StatsRadarAxis } from './stats-chart.util';
import type { TrendChartPoint } from './chart.types';

export type TrendChartVariant = 'bar' | 'line' | 'area';

const CHART_COLORS = {
  primary: '#3de0f5',
  primarySoft: 'rgba(61, 224, 245, 0.2)',
  lime: '#b8ff3c',
  limeSoft: 'rgba(184, 255, 60, 0.18)',
  gold: '#f5d075',
  goldSoft: 'rgba(245, 208, 117, 0.22)',
  cyan: '#3de0f5',
  cyanSoft: 'rgba(61, 224, 245, 0.18)',
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
            focus: 'series' as const,
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
        lineStyle: { color: 'rgba(61, 224, 245, 0.35)' },
        shadowStyle: { color: 'rgba(61, 224, 245, 0.08)' },
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
          color: softGradient(CHART_COLORS.cyan, CHART_COLORS.cyanSoft),
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
        lineStyle: { width: 3, color: CHART_COLORS.cyan },
        itemStyle: { color: CHART_COLORS.cyan, borderColor: '#0a1020', borderWidth: 2 },
        areaStyle: {
          color: softGradient(CHART_COLORS.cyanSoft, 'rgba(10, 16, 32, 0)'),
        },
      },
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
    elite: CHART_COLORS.lime,
    strong: CHART_COLORS.cyan,
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
      const color = colors[item.tone ?? 'strong'] ?? CHART_COLORS.cyan;
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
