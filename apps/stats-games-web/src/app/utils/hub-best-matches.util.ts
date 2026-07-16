import type { MatchUpdateView } from '../services/match.service';
import { matchDetailRoute } from './match-analysis.util';
import {
  computeKdRatio,
  isMatchWin,
  type MatchStatsView,
} from './match-stats.util';
import {
  computeKda,
  normalizeStatsPlatform,
} from './platform-stats.util';
import type { SelectedGame } from '../core/game/selected-game';

export interface HubBestMatchView {
  matchId: string;
  route: string;
  subject: string;
  context: string;
  reason: string;
  won: boolean;
  primary: { label: string; value: string };
  secondary: { label: string; value: string };
}

function subjectFromStats(platform: string, stats: MatchStatsView): string {
  switch (platform) {
    case 'league_of_legends':
      return stats.champion || stats.agent || 'Partida ranked';
    case 'valorant':
      return stats.agent || 'Agente';
    case 'cs2':
      return stats.map || 'Mapa';
    case 'rocket_league':
      return stats.mode || 'Playlist';
    case 'fortnite':
      return stats.mode || 'Battle Royale';
    default:
      return stats.mode || stats.map || 'Sesión';
  }
}

function contextFromStats(platform: string, stats: MatchStatsView): string {
  const bits: string[] = [];
  if (platform === 'league_of_legends' && stats.role) bits.push(stats.role);
  if (platform === 'valorant' && stats.map) bits.push(stats.map);
  if (platform === 'cs2' && stats.mode) bits.push(stats.mode);
  if (stats.mode && platform !== 'cs2' && platform !== 'fortnite' && platform !== 'rocket_league') {
    bits.push(stats.mode);
  }
  if (stats.map && platform !== 'valorant' && platform !== 'cs2') bits.push(stats.map);
  return bits.filter(Boolean).join(' · ') || 'Reciente';
}

function primarySecondary(
  platform: string,
  stats: MatchStatsView,
): { primary: HubBestMatchView['primary']; secondary: HubBestMatchView['secondary'] } {
  const kills = stats.kills ?? stats.goals ?? 0;
  const deaths = stats.deaths ?? 0;
  const assists = stats.assists ?? 0;

  switch (platform) {
    case 'league_of_legends':
      return {
        primary: { label: 'KDA', value: computeKda(kills, deaths, assists) },
        secondary: { label: 'CS', value: String(stats.cs ?? '—') },
      };
    case 'valorant':
      return {
        primary: {
          label: 'K/D/A',
          value: `${kills}/${deaths}/${assists}`,
        },
        secondary: {
          label: 'HS%',
          value: stats.headshotPct != null ? `${stats.headshotPct}%` : '—',
        },
      };
    case 'cs2':
      return {
        primary: { label: 'K/D', value: computeKdRatio(kills, deaths) },
        secondary: {
          label: 'ADR',
          value: stats.adr != null ? String(Math.round(stats.adr)) : '—',
        },
      };
    case 'rocket_league':
      return {
        primary: { label: 'Goles', value: String(stats.goals ?? kills) },
        secondary: { label: 'Saves', value: String(stats.saves ?? '—') },
      };
    case 'fortnite':
      return {
        primary: {
          label: 'Place',
          value: stats.placement != null ? `#${stats.placement}` : '—',
        },
        secondary: { label: 'Elims', value: String(kills) },
      };
    default:
      return {
        primary: { label: 'K/D', value: computeKdRatio(kills, deaths) },
        secondary: { label: 'Score', value: String(stats.score ?? '—') },
      };
  }
}

function scoreMatch(platform: string, stats: MatchStatsView | null | undefined): number {
  if (!stats) return 0;
  const kills = stats.kills ?? stats.goals ?? 0;
  const deaths = Math.max(stats.deaths ?? 0, 0);
  const assists = stats.assists ?? 0;
  const winBonus = isMatchWin(stats) ? 40 : 0;

  switch (platform) {
    case 'league_of_legends': {
      const kda = (kills + assists) / Math.max(deaths, 1);
      return winBonus + kda * 18 + (stats.cs ?? 0) * 0.05 + (stats.visionScore ?? 0) * 0.15;
    }
    case 'valorant': {
      const kda = (kills + assists) / Math.max(deaths, 1);
      return winBonus + kda * 20 + (stats.headshotPct ?? 0) * 0.35 + (stats.score ?? 0) * 0.01;
    }
    case 'cs2': {
      const kd = kills / Math.max(deaths, 1);
      return winBonus + kd * 22 + (stats.adr ?? 0) * 0.2 + (stats.headshotPct ?? 0) * 0.25;
    }
    case 'rocket_league':
      return (
        winBonus +
        (stats.goals ?? kills) * 12 +
        (stats.saves ?? 0) * 8 +
        (stats.assists ?? 0) * 6 +
        (stats.score ?? 0) * 0.05
      );
    case 'fortnite': {
      const place = stats.placement ?? 99;
      const placeScore = Math.max(0, 40 - place * 2.5);
      return winBonus + placeScore + kills * 6;
    }
    default:
      return winBonus + kills * 5 - deaths * 2 + assists * 2;
  }
}

function reasonFor(
  platform: string,
  stats: MatchStatsView,
  rank: number,
): string {
  if (rank === 0 && isMatchWin(stats)) return 'Mejor victoria';
  if (platform === 'fortnite' && (stats.placement ?? 99) <= 3) return 'Podium';
  if (platform === 'league_of_legends') return 'Mejor KDA';
  if (platform === 'valorant') return 'Impacto alto';
  if (platform === 'cs2') return 'Mejor round impact';
  if (platform === 'rocket_league') return 'Partida clutch';
  return 'Destacada';
}

/** Elige las mejores partidas del usuario para el hub del dashboard. */
export function pickBestMatchesForHub(
  matches: MatchUpdateView[],
  platformHint?: SelectedGame | string | null,
  limit = 3,
): HubBestMatchView[] {
  const scored = matches
    .map((match) => {
      const platform = normalizeStatsPlatform(platformHint || match.platform);
      const stats = match.stats ?? {};
      return {
        match,
        platform,
        stats,
        score: scoreMatch(platform, match.stats),
      };
    })
    .filter((row) => row.score > 0 || row.match.stats)
    .sort((a, b) => b.score - a.score || b.match.updatedAt.localeCompare(a.match.updatedAt));

  const seen = new Set<string>();
  const picked: HubBestMatchView[] = [];

  for (const row of scored) {
    if (seen.has(row.match.matchId)) continue;
    seen.add(row.match.matchId);
    const { primary, secondary } = primarySecondary(row.platform, row.stats);
    picked.push({
      matchId: row.match.matchId,
      route: matchDetailRoute(row.match.matchId),
      subject: subjectFromStats(row.platform, row.stats),
      context: contextFromStats(row.platform, row.stats),
      reason: reasonFor(row.platform, row.stats, picked.length),
      won: isMatchWin(row.stats),
      primary,
      secondary,
    });
    if (picked.length >= limit) break;
  }

  return picked;
}
