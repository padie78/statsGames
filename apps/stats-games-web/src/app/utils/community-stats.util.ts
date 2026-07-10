import type { CommunityBenchmarks } from '../data/community-mock.data';

export interface CommunityComparisonItem {
  label: string;
  playerValue: string;
  communityAvg: string;
  betterThanPct: number;
  topPercentLabel: string;
  trend: 'up' | 'down' | 'flat';
  comparisonNote: string;
}

export interface CommunityComparisonInput {
  benchmarks: CommunityBenchmarks;
  winRate: string;
  winRateNumeric: number | null;
  kd: string;
  kdNumeric: number | null;
  kills: number;
  matchCount: number;
}

function parsePercent(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]);
}

function parseKd(value: string): number | null {
  if (value === '—' || !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function estimateBetterThanPct(player: number, avg: number, stdDev: number): number {
  if (stdDev <= 0) return 50;
  const z = (player - avg) / stdDev;
  const ratio = 1 / (1 + Math.exp(-1.15 * z));
  return Math.round(Math.max(3, Math.min(97, ratio * 100)));
}

function topPercentLabel(betterThanPct: number): string {
  const top = Math.max(1, Math.min(97, 100 - betterThanPct));
  return `Top ${top}%`;
}

function trendVsAvg(player: number, avg: number): 'up' | 'down' | 'flat' {
  const diff = player - avg;
  if (Math.abs(diff) < 0.05) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

function comparisonNote(player: number, avg: number, unit: string): string {
  const diff = player - avg;
  if (Math.abs(diff) < 0.05) return 'En el promedio comunitario';
  const sign = diff > 0 ? '+' : '';
  const formatted =
    unit === '%'
      ? `${sign}${Math.round(diff)}${unit}`
      : unit === 'int'
        ? `${sign}${Math.round(diff)}`
        : `${sign}${diff.toFixed(2)}`;
  return `${formatted} vs comunidad`;
}

export function buildCommunityComparison(input: CommunityComparisonInput): CommunityComparisonItem[] {
  const { benchmarks } = input;
  if (input.matchCount === 0) return [];

  const items: CommunityComparisonItem[] = [];

  if (input.winRateNumeric != null) {
    const betterThanPct = estimateBetterThanPct(
      input.winRateNumeric,
      benchmarks.avgWinRate,
      benchmarks.winRateStd,
    );
    items.push({
      label: 'Win rate',
      playerValue: input.winRate,
      communityAvg: `${benchmarks.avgWinRate}%`,
      betterThanPct,
      topPercentLabel: topPercentLabel(betterThanPct),
      trend: trendVsAvg(input.winRateNumeric, benchmarks.avgWinRate),
      comparisonNote: comparisonNote(input.winRateNumeric, benchmarks.avgWinRate, '%'),
    });
  }

  if (input.kdNumeric != null) {
    const betterThanPct = estimateBetterThanPct(input.kdNumeric, benchmarks.avgKd, benchmarks.kdStd);
    items.push({
      label: 'K/D',
      playerValue: input.kd,
      communityAvg: benchmarks.avgKd.toFixed(2),
      betterThanPct,
      topPercentLabel: topPercentLabel(betterThanPct),
      trend: trendVsAvg(input.kdNumeric, benchmarks.avgKd),
      comparisonNote: comparisonNote(input.kdNumeric, benchmarks.avgKd, ''),
    });
  }

  if (input.kills > 0) {
    const betterThanPct = estimateBetterThanPct(
      input.kills,
      benchmarks.avgKillsPerWeek,
      benchmarks.killsStd,
    );
    items.push({
      label: 'Kills / semana',
      playerValue: String(input.kills),
      communityAvg: String(Math.round(benchmarks.avgKillsPerWeek)),
      betterThanPct,
      topPercentLabel: topPercentLabel(betterThanPct),
      trend: trendVsAvg(input.kills, benchmarks.avgKillsPerWeek),
      comparisonNote: comparisonNote(input.kills, benchmarks.avgKillsPerWeek, 'int'),
    });
  }

  return items;
}

export function parsePlayerWinRateForCommunity(winRate: string): number | null {
  return parsePercent(winRate);
}

export function parsePlayerKdForCommunity(kd: string): number | null {
  return parseKd(kd);
}

export function formatCommunitySampleSize(size: number): string {
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)}M`;
  if (size >= 1_000) return `${Math.round(size / 1_000)}K`;
  return String(size);
}

export function mapCommunityBenchmarksFromApi(
  view: CommunityBenchmarks,
): CommunityBenchmarks {
  return {
    platform: view.platform,
    sampleSize: view.sampleSize,
    avgWinRate: view.avgWinRate,
    avgKd: view.avgKd,
    avgKillsPerWeek: view.avgKillsPerWeek,
    avgMatchesPerWeek: view.avgMatchesPerWeek,
    winRateStd: view.winRateStd,
    kdStd: view.kdStd,
    killsStd: view.killsStd,
  };
}
