/**
 * Stats / KPIs / rankings por juego — estilo OP.GG pero orientado a rendimiento.
 */
import type { KpiStripItem } from '../ui/molecules/kpi-strip/kpi-strip.component';
import type { MatchUpdateView } from '../services/match.service';
import type { MatchStatsView } from './match-stats.util';
import {
  computeKdRatio,
  computeWinRate,
  isMatchWin,
} from './match-stats.util';
import type { NeonBadgeTone } from '../ui/atoms/neon-badge/neon-badge.component';

export type StatsPlatform =
  | 'valorant'
  | 'league_of_legends'
  | 'cs2'
  | 'rocket_league'
  | 'fortnite'
  | 'roblox'
  | 'blox_fruits'
  | 'adopt_me'
  | 'brookhaven'
  | string;

export interface PlatformAggregateSummary {
  matchCount: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  avgPlacement: string;
  bestPlacement: number | null;
  kd: string;
  kda: string;
  winCount: number;
  winRate: string;
  avgHeadshotPct: string;
  avgScore: string;
  avgAdr: string;
  avgCs: string;
  avgVision: string;
  totalGoals: number;
  totalSaves: number;
  avgShotPct: string;
}

export function normalizeStatsPlatform(platform?: string | null): StatsPlatform {
  const p = (platform ?? '').toLowerCase();
  if (p === 'roblox' || p === 'blox_fruits' || p === 'adopt_me' || p === 'brookhaven') {
    return p === 'roblox' ? 'blox_fruits' : p;
  }
  return p || 'fortnite';
}

export { isMatchWin } from './match-stats.util';

export function getMatchOutcomeForPlatform(
  platform: string | null | undefined,
  stats?: MatchStatsView | null,
): { label: string; tone: NeonBadgeTone } {
  const p = normalizeStatsPlatform(platform);

  if (stats?.won === true) return { label: 'Victoria', tone: 'lime' };
  if (stats?.won === false) return { label: 'Derrota', tone: 'muted' };

  const placement = stats?.placement;
  if (placement == null || placement <= 0) {
    return { label: 'Sin resultado', tone: 'cyan' };
  }

  if (p === 'fortnite' || p === 'blox_fruits' || p === 'adopt_me' || p === 'brookhaven') {
    if (placement === 1) return { label: 'Victoria', tone: 'lime' };
    if (placement <= 3) return { label: 'Podio', tone: 'cyan' };
    if (placement <= 10) return { label: 'Top 10', tone: 'cyan' };
    if (placement <= 25) return { label: 'Top 25', tone: 'muted' };
    return { label: `#${placement}`, tone: 'muted' };
  }

  if (placement === 1) return { label: 'Victoria', tone: 'lime' };
  return { label: 'Derrota', tone: 'muted' };
}

export function computeKda(kills: number, deaths: number, assists: number): string {
  if (deaths === 0) return (kills + assists).toFixed(1);
  return ((kills + assists) / deaths).toFixed(2);
}

function avgOrDash(sum: number, count: number, digits = 1): string {
  if (!count) return '—';
  return (sum / count).toFixed(digits);
}

export function aggregatePlatformMatchStats(
  matches: MatchUpdateView[],
): PlatformAggregateSummary {
  if (!matches.length) {
    return {
      matchCount: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      avgPlacement: '—',
      bestPlacement: null,
      kd: '—',
      kda: '—',
      winCount: 0,
      winRate: '—',
      avgHeadshotPct: '—',
      avgScore: '—',
      avgAdr: '—',
      avgCs: '—',
      avgVision: '—',
      totalGoals: 0,
      totalSaves: 0,
      avgShotPct: '—',
    };
  }

  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let placementSum = 0;
  let placementCount = 0;
  let bestPlacement: number | null = null;
  let winCount = 0;
  let hsSum = 0;
  let hsCount = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let adrSum = 0;
  let adrCount = 0;
  let csSum = 0;
  let csCount = 0;
  let visionSum = 0;
  let visionCount = 0;
  let totalGoals = 0;
  let totalSaves = 0;
  let shotPctSum = 0;
  let shotPctCount = 0;

  for (const match of matches) {
    const s = match.stats;
    totalKills += s?.kills ?? s?.goals ?? 0;
    totalDeaths += s?.deaths ?? 0;
    totalAssists += s?.assists ?? 0;
    totalGoals += s?.goals ?? (normalizeStatsPlatform(match.platform) === 'rocket_league' ? s?.kills ?? 0 : 0);
    totalSaves += s?.saves ?? 0;

    if (isMatchWin(s)) winCount += 1;

    const placement = s?.placement;
    if (placement != null && placement > 0) {
      placementSum += placement;
      placementCount += 1;
      bestPlacement = bestPlacement == null ? placement : Math.min(bestPlacement, placement);
    }

    if (s?.headshotPct != null) {
      hsSum += s.headshotPct;
      hsCount += 1;
    }
    if (s?.score != null) {
      const rounds = (s.roundsWon ?? 0) + (s.roundsLost ?? 0);
      // ACS ≈ score / rondas cuando hay rondas; si no, score bruto.
      scoreSum += rounds > 0 ? s.score / rounds : s.score;
      scoreCount += 1;
    }
    if (s?.adr != null) {
      adrSum += s.adr;
      adrCount += 1;
    }
    if (s?.cs != null) {
      csSum += s.cs;
      csCount += 1;
    }
    if (s?.visionScore != null) {
      visionSum += s.visionScore;
      visionCount += 1;
    }
    if (s?.shotPct != null) {
      shotPctSum += s.shotPct;
      shotPctCount += 1;
    }
  }

  const n = matches.length;
  return {
    matchCount: n,
    totalKills,
    totalDeaths,
    totalAssists,
    avgPlacement: placementCount ? (placementSum / placementCount).toFixed(1) : '—',
    bestPlacement,
    kd: computeKdRatio(totalKills, totalDeaths),
    kda: computeKda(totalKills, totalDeaths, totalAssists),
    winCount,
    winRate: computeWinRate(winCount, n),
    avgHeadshotPct: hsCount ? `${avgOrDash(hsSum, hsCount, 1)}%` : '—',
    avgScore: avgOrDash(scoreSum, scoreCount, 0),
    avgAdr: avgOrDash(adrSum, adrCount, 0),
    avgCs: avgOrDash(csSum, csCount, 0),
    avgVision: avgOrDash(visionSum, visionCount, 0),
    totalGoals,
    totalSaves,
    avgShotPct: shotPctCount ? `${avgOrDash(shotPctSum, shotPctCount, 0)}%` : '—',
  };
}

/** KPIs del strip según el juego activo (OP.GG-like). */
export function buildPlatformKpiItems(
  platform: string | null | undefined,
  summary: PlatformAggregateSummary,
  opts?: {
    deltas?: Partial<
      Record<'wins' | 'kills' | 'matches' | 'kd', { note?: string; trend?: 'up' | 'down' | 'flat' }>
    >;
  },
): KpiStripItem[] {
  const p = normalizeStatsPlatform(platform);
  const d = opts?.deltas ?? {};

  const partidas: KpiStripItem = {
    label: 'Partidas',
    value: summary.matchCount,
    icon: 'matches',
    delta: d.matches?.note,
    deltaTrend: d.matches?.trend,
  };
  const victorias: KpiStripItem = {
    label: 'Victorias',
    value: summary.winCount,
    accent: 'lime',
    icon: 'placement',
    delta: d.wins?.note,
    deltaTrend: d.wins?.trend,
  };
  const winRate: KpiStripItem = {
    label: 'Win rate',
    value: summary.winRate,
    accent: 'cyan',
    icon: 'kd',
  };
  const kd: KpiStripItem = {
    label: 'K/D',
    value: summary.kd,
    accent: 'cyan',
    icon: 'kd',
    delta: d.kd?.note,
    deltaTrend: d.kd?.trend,
  };
  const kda: KpiStripItem = {
    label: 'KDA',
    value: summary.kda,
    accent: 'purple',
    icon: 'kd',
  };
  const kills: KpiStripItem = {
    label: p === 'rocket_league' ? 'Goles' : 'Kills',
    value: p === 'rocket_league' ? summary.totalGoals || summary.totalKills : summary.totalKills,
    accent: 'lime',
    icon: 'kills',
    delta: d.kills?.note,
    deltaTrend: d.kills?.trend,
  };

  switch (p) {
    case 'valorant':
      return [
        victorias,
        winRate,
        kda,
        { label: 'ACS', value: summary.avgScore, accent: 'cyan', icon: 'kd' },
        { label: 'HS%', value: summary.avgHeadshotPct, accent: 'lime', icon: 'kills' },
        partidas,
      ];
    case 'league_of_legends':
      return [
        victorias,
        winRate,
        kda,
        { label: 'CS medio', value: summary.avgCs, accent: 'cyan', icon: 'kills' },
        { label: 'Visión', value: summary.avgVision, accent: 'purple', icon: 'kd' },
        partidas,
      ];
    case 'cs2':
      return [
        victorias,
        winRate,
        kd,
        { label: 'ADR', value: summary.avgAdr, accent: 'cyan', icon: 'kills' },
        { label: 'HS%', value: summary.avgHeadshotPct, accent: 'lime', icon: 'kills' },
        partidas,
      ];
    case 'rocket_league':
      return [
        victorias,
        winRate,
        kills,
        { label: 'Saves', value: summary.totalSaves, accent: 'cyan', icon: 'kd' },
        { label: 'Shot %', value: summary.avgShotPct, accent: 'purple', icon: 'kills' },
        partidas,
      ];
    case 'fortnite':
      return [
        victorias,
        winRate,
        kd,
        kills,
        {
          label: 'Mejor lugar',
          value: summary.bestPlacement != null ? `#${summary.bestPlacement}` : '—',
          accent: 'lime',
          icon: 'placement',
        },
        partidas,
      ];
    default:
      // Roblox experiences / fallback
      return [victorias, winRate, kd, kills, partidas];
  }
}

export interface MatchCardStatCell {
  label: string;
  value: string | number;
  accent?: 'default' | 'lime' | 'cyan' | 'purple';
}

/** Celdas de la card de partida según plataforma. */
export function buildMatchCardStatCells(
  platform: string | null | undefined,
  stats: MatchStatsView,
  detailed = false,
): MatchCardStatCell[] {
  const p = normalizeStatsPlatform(platform);
  const kills = stats.kills ?? stats.goals ?? null;
  const deaths = stats.deaths ?? null;
  const assists = stats.assists ?? null;
  const kd =
    kills != null || deaths != null
      ? computeKdRatio(kills ?? 0, deaths ?? 0)
      : '—';
  const kda =
    kills != null || deaths != null || assists != null
      ? computeKda(kills ?? 0, deaths ?? 0, assists ?? 0)
      : '—';

  const rounds =
    stats.roundsWon != null && stats.roundsLost != null
      ? `${stats.roundsWon}-${stats.roundsLost}`
      : null;
  const acs =
    stats.score != null
      ? (() => {
          const r = (stats.roundsWon ?? 0) + (stats.roundsLost ?? 0);
          return r > 0 ? Math.round(stats.score / r) : stats.score;
        })()
      : null;

  switch (p) {
    case 'valorant': {
      const cells: MatchCardStatCell[] = [
        { label: 'K/D/A', value: `${kills ?? 0}/${deaths ?? 0}/${assists ?? 0}`, accent: 'lime' },
        { label: 'ACS', value: acs ?? '—', accent: 'cyan' },
        { label: 'HS%', value: stats.headshotPct != null ? `${stats.headshotPct}%` : '—' },
      ];
      if (detailed) {
        cells.push(
          { label: 'Agente', value: stats.agent ?? '—' },
          { label: 'Mapa', value: stats.map ?? '—' },
          { label: 'Rondas', value: rounds ?? '—' },
          { label: 'KDA', value: kda, accent: 'purple' },
        );
      }
      return cells;
    }
    case 'league_of_legends': {
      const cells: MatchCardStatCell[] = [
        { label: 'K/D/A', value: `${kills ?? 0}/${deaths ?? 0}/${assists ?? 0}`, accent: 'lime' },
        { label: 'CS', value: stats.cs ?? '—', accent: 'cyan' },
        { label: 'Visión', value: stats.visionScore ?? '—' },
      ];
      if (detailed) {
        cells.push(
          { label: 'Campeón', value: stats.champion ?? stats.agent ?? '—' },
          { label: 'Rol', value: stats.role ?? '—' },
          { label: 'KDA', value: kda, accent: 'purple' },
        );
      }
      return cells;
    }
    case 'cs2': {
      const cells: MatchCardStatCell[] = [
        { label: 'K/D/A', value: `${kills ?? 0}/${deaths ?? 0}/${assists ?? 0}`, accent: 'lime' },
        { label: 'ADR', value: stats.adr != null ? Math.round(stats.adr) : '—', accent: 'cyan' },
        { label: 'HS%', value: stats.headshotPct != null ? `${stats.headshotPct}%` : '—' },
      ];
      if (detailed) {
        cells.push(
          { label: 'Mapa', value: stats.map ?? '—' },
          { label: 'K/D', value: kd, accent: 'purple' },
        );
      }
      return cells;
    }
    case 'rocket_league': {
      const cells: MatchCardStatCell[] = [
        { label: 'Goles', value: stats.goals ?? kills ?? '—', accent: 'lime' },
        { label: 'Assists', value: assists ?? '—' },
        { label: 'Saves', value: stats.saves ?? '—', accent: 'cyan' },
      ];
      if (detailed) {
        cells.push(
          { label: 'Shots', value: stats.shots ?? '—' },
          {
            label: 'Shot %',
            value: stats.shotPct != null ? `${Math.round(stats.shotPct)}%` : '—',
          },
          { label: 'Score', value: stats.score ?? '—', accent: 'purple' },
        );
      }
      return cells;
    }
    case 'fortnite': {
      const cells: MatchCardStatCell[] = [
        {
          label: 'Placement',
          value: stats.placement != null ? `#${stats.placement}` : '—',
          accent: 'lime',
        },
        { label: 'Elims', value: kills ?? '—', accent: 'cyan' },
        { label: 'Deaths', value: deaths ?? '—' },
      ];
      if (detailed) {
        cells.push(
          { label: 'K/D', value: kd, accent: 'purple' },
          { label: 'Modo', value: stats.mode ?? '—' },
        );
      }
      return cells;
    }
    default: {
      const cells: MatchCardStatCell[] = [
        { label: 'Kills', value: kills ?? '—', accent: 'lime' },
        { label: 'Deaths', value: deaths ?? '—' },
        { label: 'K/D', value: kd, accent: 'cyan' },
      ];
      if (detailed) {
        cells.push(
          { label: 'Assists', value: assists ?? '—' },
          { label: 'Modo', value: stats.mode ?? '—' },
        );
      }
      return cells;
    }
  }
}
