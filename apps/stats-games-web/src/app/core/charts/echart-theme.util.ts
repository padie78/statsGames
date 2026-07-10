import type { EChartsOption } from 'echarts';
import type { StatsRadarAxis } from './stats-chart.util';
import type { TrendChartPoint } from './chart.types';

export type TrendChartVariant = 'bar' | 'line' | 'area';

const CHART_COLORS = {
  primary: '#22d3ee',
  primarySoft: 'rgba(34, 211, 238, 0.18)',
  gold: '#f5d075',
  goldSoft: 'rgba(245, 208, 117, 0.22)',
  cyan: '#22d3ee',
  cyanSoft: 'rgba(34, 211, 238, 0.18)',
  text: '#9aa3b2',
  textMuted: '#6b7280',
  grid: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255, 255, 255, 0.08)',
};

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
          symbolSize: 7,
          lineStyle: { width: 3, color },
          itemStyle: { color, borderColor: '#0b0c14', borderWidth: 2 },
          areaStyle: variant === 'area' ? { color: areaColor } : undefined,
        }
      : {
          type: 'bar' as const,
          barWidth: '52%',
          itemStyle: {
            color,
            borderRadius: [6, 6, 0, 0],
          },
        };

  return {
    animationDuration: 520,
    animationEasing: 'cubicOut',
    grid: {
      left: 8,
      right: 8,
      top: 18,
      bottom: 0,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(14, 16, 23, 0.94)',
      borderColor: CHART_COLORS.border,
      textStyle: { color: '#eef0f4', fontSize: 12 },
      axisPointer: {
        type: variant === 'bar' ? 'shadow' : 'line',
        lineStyle: { color: 'rgba(117, 105, 240, 0.35)' },
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

export function buildDualTrendChartOptions(
  primary: TrendChartPoint[],
  secondary: TrendChartPoint[],
  labels: { primary: string; secondary: string },
): EChartsOption {
  const categories = primary.map((point) => point.label);

  return {
    animationDuration: 520,
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
      backgroundColor: 'rgba(14, 16, 23, 0.94)',
      borderColor: CHART_COLORS.border,
      textStyle: { color: '#eef0f4', fontSize: 12 },
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
        itemStyle: { color: CHART_COLORS.gold, borderRadius: [5, 5, 0, 0] },
      },
      {
        name: labels.secondary,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: secondary.map((point) => point.value),
        lineStyle: { width: 2, color: CHART_COLORS.cyan },
        itemStyle: { color: CHART_COLORS.cyan },
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
    animationDuration: 640,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(14, 16, 23, 0.94)',
      borderColor: CHART_COLORS.border,
      textStyle: { color: '#eef0f4', fontSize: 12 },
    },
    radar: {
      center: ['50%', '54%'],
      radius: '62%',
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
          color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'],
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
        symbolSize: 5,
        lineStyle: {
          width: 2,
          color: CHART_COLORS.primary,
        },
        itemStyle: {
          color: CHART_COLORS.primary,
          borderColor: '#0b0c14',
          borderWidth: 2,
        },
        areaStyle: {
          color: CHART_COLORS.primarySoft,
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
