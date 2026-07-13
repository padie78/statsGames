import type { CommunityBenchmarks } from '../data/community-mock.data';

export type CommunityPercentileTone = 'elite' | 'strong' | 'average' | 'weak';

export interface CommunityComparisonItem {
  id: string;
  label: string;
  playerValue: string;
  communityAvg: string;
  /** Percentil estimado: % de jugadores por debajo de vos (0–100). */
  betterThanPct: number;
  /** Etiqueta corta tipo "Top 18%". */
  topPercentLabel: string;
  /** Texto legible: "Mejor que el 82%". */
  betterThanLabel: string;
  trend: 'up' | 'down' | 'flat';
  comparisonNote: string;
  tone: CommunityPercentileTone;
  /** Posición del promedio en la barra (0–100). */
  avgMarkerPct: number;
}

export interface CommunityComparisonInput {
  benchmarks: CommunityBenchmarks;
  winRate: string;
  winRateNumeric: number | null;
  kd: string;
  kdNumeric: number | null;
  kills: number;
  matchCount: number;
  /** Etiqueta K/D vs KDA según juego. */
  kdLabel?: string;
  /** Etiqueta kills vs goles vs elims. */
  killsLabel?: string;
}

export interface CommunityComparisonSummary {
  overallBetterThanPct: number;
  overallTopLabel: string;
  overallTone: CommunityPercentileTone;
  headline: string;
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

function betterThanLabel(betterThanPct: number): string {
  return `Mejor que el ${betterThanPct}%`;
}

function toneForPct(betterThanPct: number): CommunityPercentileTone {
  if (betterThanPct >= 85) return 'elite';
  if (betterThanPct >= 60) return 'strong';
  if (betterThanPct >= 40) return 'average';
  return 'weak';
}

function trendVsAvg(player: number, avg: number): 'up' | 'down' | 'flat' {
  const diff = player - avg;
  const threshold = Math.max(Math.abs(avg) * 0.03, 0.05);
  if (Math.abs(diff) < threshold) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

function comparisonNote(player: number, avg: number, unit: string): string {
  const diff = player - avg;
  if (Math.abs(diff) < 0.05) return 'En el promedio de la comunidad';
  const sign = diff > 0 ? '+' : '';
  const formatted =
    unit === '%'
      ? `${sign}${Math.round(diff)}${unit}`
      : unit === 'int'
        ? `${sign}${Math.round(diff)}`
        : `${sign}${diff.toFixed(2)}`;
  return diff > 0 ? `${formatted} por encima del promedio` : `${formatted} por debajo del promedio`;
}

/**
 * Coloca el promedio en la barra relativa al jugador.
 * Si estás por encima, el avg queda a la izquierda del fill; si no, a la derecha.
 */
function avgMarkerPct(player: number, avg: number, betterThanPct: number): number {
  if (player <= 0 && avg <= 0) return 50;
  const ratio = avg / Math.max(player, avg, 0.0001);
  const marker = Math.round(betterThanPct * Math.min(1.15, Math.max(0.2, ratio)));
  return Math.max(8, Math.min(92, marker));
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
      id: 'win-rate',
      label: 'Win rate',
      playerValue: input.winRate,
      communityAvg: `${Math.round(benchmarks.avgWinRate)}%`,
      betterThanPct,
      topPercentLabel: topPercentLabel(betterThanPct),
      betterThanLabel: betterThanLabel(betterThanPct),
      trend: trendVsAvg(input.winRateNumeric, benchmarks.avgWinRate),
      comparisonNote: comparisonNote(input.winRateNumeric, benchmarks.avgWinRate, '%'),
      tone: toneForPct(betterThanPct),
      avgMarkerPct: avgMarkerPct(input.winRateNumeric, benchmarks.avgWinRate, betterThanPct),
    });
  }

  if (input.kdNumeric != null) {
    const betterThanPct = estimateBetterThanPct(input.kdNumeric, benchmarks.avgKd, benchmarks.kdStd);
    items.push({
      id: 'kd',
      label: input.kdLabel ?? 'K/D',
      playerValue: input.kd,
      communityAvg: benchmarks.avgKd.toFixed(2),
      betterThanPct,
      topPercentLabel: topPercentLabel(betterThanPct),
      betterThanLabel: betterThanLabel(betterThanPct),
      trend: trendVsAvg(input.kdNumeric, benchmarks.avgKd),
      comparisonNote: comparisonNote(input.kdNumeric, benchmarks.avgKd, ''),
      tone: toneForPct(betterThanPct),
      avgMarkerPct: avgMarkerPct(input.kdNumeric, benchmarks.avgKd, betterThanPct),
    });
  }

  if (input.kills > 0) {
    const betterThanPct = estimateBetterThanPct(
      input.kills,
      benchmarks.avgKillsPerWeek,
      benchmarks.killsStd,
    );
    items.push({
      id: 'kills',
      label: input.killsLabel ?? 'Kills / semana',
      playerValue: String(input.kills),
      communityAvg: String(Math.round(benchmarks.avgKillsPerWeek)),
      betterThanPct,
      topPercentLabel: topPercentLabel(betterThanPct),
      betterThanLabel: betterThanLabel(betterThanPct),
      trend: trendVsAvg(input.kills, benchmarks.avgKillsPerWeek),
      comparisonNote: comparisonNote(input.kills, benchmarks.avgKillsPerWeek, 'int'),
      tone: toneForPct(betterThanPct),
      avgMarkerPct: avgMarkerPct(input.kills, benchmarks.avgKillsPerWeek, betterThanPct),
    });
  }

  if (input.matchCount > 0 && benchmarks.avgMatchesPerWeek > 0) {
    const matchStd = Math.max(4, benchmarks.avgMatchesPerWeek * 0.35);
    const betterThanPct = estimateBetterThanPct(
      input.matchCount,
      benchmarks.avgMatchesPerWeek,
      matchStd,
    );
    items.push({
      id: 'matches',
      label: 'Partidas / semana',
      playerValue: String(input.matchCount),
      communityAvg: String(Math.round(benchmarks.avgMatchesPerWeek)),
      betterThanPct,
      topPercentLabel: topPercentLabel(betterThanPct),
      betterThanLabel: betterThanLabel(betterThanPct),
      trend: trendVsAvg(input.matchCount, benchmarks.avgMatchesPerWeek),
      comparisonNote: comparisonNote(input.matchCount, benchmarks.avgMatchesPerWeek, 'int'),
      tone: toneForPct(betterThanPct),
      avgMarkerPct: avgMarkerPct(input.matchCount, benchmarks.avgMatchesPerWeek, betterThanPct),
    });
  }

  return items;
}

export function summarizeCommunityComparison(
  items: CommunityComparisonItem[],
): CommunityComparisonSummary | null {
  if (!items.length) return null;
  const overallBetterThanPct = Math.round(
    items.reduce((sum, item) => sum + item.betterThanPct, 0) / items.length,
  );
  const overallTone = toneForPct(overallBetterThanPct);
  const overallTopLabel = topPercentLabel(overallBetterThanPct);
  const headline =
    overallTone === 'elite'
      ? 'Estás entre los mejores de la comunidad esta semana.'
      : overallTone === 'strong'
        ? 'Venís por encima del promedio en la mayoría de KPIs.'
        : overallTone === 'average'
          ? 'Estás cerca del promedio comunitario.'
          : 'Hay margen para subir vs la comunidad esta semana.';

  return {
    overallBetterThanPct,
    overallTopLabel,
    overallTone,
    headline,
  };
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
