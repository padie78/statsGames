import type { SelectedGame } from '../core/game/selected-game';
import type {
  CommunityRankRow,
  CommunityRankTableView,
} from '../data/community-mock.data';
import type { LeaderboardEntryView } from '../services/stats.service';

/** KPIs semanales del propio jugador para ubicarlo en el ranking. */
export interface WeeklyCommunitySelf {
  gamerTag: string;
  kd: number;
  winRate: number;
  kills: number;
  matches: number;
  winCount: number;
}

/**
 * Construye la vista de ranking comunitario a partir del leaderboard real.
 * Devuelve `null` cuando no hay jugadores reales: nunca inventa rivales.
 */
export function buildWeeklyCommunityRankView(input: {
  platform: SelectedGame;
  userId: string | null;
  apiRows: LeaderboardEntryView[];
  self: WeeklyCommunitySelf;
  sampleSize?: number | null;
  radius?: number;
}): CommunityRankTableView | null {
  const { platform, userId, apiRows, self } = input;
  if (apiRows.length === 0) return null;
  const radius = input.radius ?? 5;

  const rows: CommunityRankRow[] = apiRows.map((entry) => ({
    rank: entry.rank,
    gamerTag:
      entry.userId === userId
        ? self.gamerTag
        : entry.gamerTag && entry.gamerTag !== entry.userId
          ? entry.gamerTag
          : `Jugador ${entry.rank}`,
    platform,
    isYou: entry.userId === userId,
    kd: entry.kd,
    winRate: entry.winRate,
    kills: entry.totalKills,
    matches: entry.matchCount,
    score: entry.score,
    delta: entry.delta,
    trend: entry.trend === 'up' || entry.trend === 'down' ? entry.trend : 'flat',
  }));

  if (!rows.some((row) => row.isYou) && self.matches > 0) {
    rows.push({
      rank: rows.length + 1,
      gamerTag: self.gamerTag,
      platform,
      isYou: true,
      kd: self.kd,
      winRate: self.winRate,
      kills: self.kills,
      matches: self.matches,
      score: self.kills * 10 + self.winCount * 100 + self.matches * 5,
      delta: '—',
      trend: 'flat',
    });
    rows.sort((a, b) => b.score - a.score);
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });
  }

  const yourIndex = rows.findIndex((row) => row.isYou);
  const start = Math.max(0, yourIndex >= 0 ? yourIndex - radius : 0);
  const end = Math.min(
    rows.length,
    yourIndex >= 0 ? yourIndex + radius + 1 : Math.min(rows.length, radius * 2 + 1),
  );

  return {
    rows: rows.slice(start, end),
    yourRank: yourIndex >= 0 ? (rows[yourIndex]?.rank ?? 0) : 0,
    totalPlayers: input.sampleSize ?? rows.length,
    platform,
  };
}
