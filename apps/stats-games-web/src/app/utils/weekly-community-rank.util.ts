import type { SelectedGame } from '../core/game/selected-game';
import type {
  CommunityRankRow,
  CommunityRankTableView,
} from '../data/community-mock.data';
import type { LeaderboardEntryView } from '../services/stats.service';

/** KPIs semanales del propio jugador para ubicarlo en el ranking. */
export interface WeeklyCommunitySelf {
  gamerTag: string;
  avatarUrl?: string;
  kd: number;
  winRate: number;
  kills: number;
  deaths?: number;
  assists?: number;
  matches: number;
  winCount: number;
  leaguePoints?: number;
}

/** Score por ratios — espejo de libs/common fair-leaderboard-score. */
export function computeFairCommunityScore(input: {
  totalKills: number;
  totalDeaths: number;
  totalAssists?: number;
  winCount: number;
  matchCount: number;
}): number {
  const matches = Math.max(0, Math.floor(input.matchCount));
  if (matches === 0) return 0;
  const deaths = Math.max(1, input.totalDeaths);
  const assists = Math.max(0, input.totalAssists ?? 0);
  const kda = (input.totalKills + assists) / deaths;
  const winRate = (input.winCount / matches) * 100;
  const killsPerGame = input.totalKills / matches;
  const reliability = Math.min(1, matches / 5);
  return Math.round((kda * 100 + winRate * 1.5 + killsPerGame * 12) * reliability);
}

function trueKda(kills: number, deaths: number, assists: number): number {
  return Math.round(((kills + assists) / Math.max(1, deaths)) * 100) / 100;
}

function toRow(input: {
  rank: number;
  gamerTag: string;
  avatarUrl?: string;
  platform: SelectedGame;
  isYou: boolean;
  kills: number;
  deaths: number;
  assists: number;
  winCount: number;
  matches: number;
  leaguePoints?: number;
  delta: string;
  trend: 'up' | 'down' | 'flat';
}): CommunityRankRow {
  const winRate = input.matches > 0 ? (input.winCount / input.matches) * 100 : 0;
  return {
    rank: input.rank,
    gamerTag: input.gamerTag,
    avatarUrl: input.avatarUrl,
    platform: input.platform,
    isYou: input.isYou,
    kd: trueKda(input.kills, input.deaths, input.assists),
    winRate: Math.round(winRate * 10) / 10,
    kills: input.kills,
    deaths: input.deaths,
    assists: input.assists,
    killsPerGame:
      input.matches > 0
        ? Math.round((input.kills / input.matches) * 10) / 10
        : 0,
    matches: input.matches,
    leaguePoints: input.leaguePoints,
    score: computeFairCommunityScore({
      totalKills: input.kills,
      totalDeaths: input.deaths,
      totalAssists: input.assists,
      winCount: input.winCount,
      matchCount: input.matches,
    }),
    delta: input.delta,
    trend: input.trend,
  };
}

/**
 * Construye la vista de ranking comunitario a partir del leaderboard real.
 * Reordena con score justo (ratios). Devuelve `null` si no hay peers reales.
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

  const rows: CommunityRankRow[] = apiRows.map((entry) => {
    const isYou = entry.userId === userId;
    // Usar siempre stats del leaderboard (misma ventana/sample que peers).
    // Solo overlay de identidad (tag / avatar) desde el perfil local.
    const kills = entry.totalKills;
    const deaths = entry.totalDeaths;
    const assists = entry.totalAssists ?? 0;
    const matches = entry.matchCount;
    const winCount =
      entry.winCount ?? Math.round((entry.winRate / 100) * entry.matchCount);

    return toRow({
      rank: entry.rank,
      gamerTag: isYou
        ? self.gamerTag
        : entry.gamerTag && entry.gamerTag !== entry.userId
          ? entry.gamerTag
          : `Jugador ${entry.rank}`,
      avatarUrl: isYou
        ? self.avatarUrl ?? entry.avatarUrl ?? undefined
        : entry.avatarUrl ?? undefined,
      platform,
      isYou,
      kills,
      deaths,
      assists,
      winCount,
      matches,
      leaguePoints: entry.leaguePoints ?? undefined,
      delta: entry.delta,
      trend: entry.trend === 'up' || entry.trend === 'down' ? entry.trend : 'flat',
    });
  });

  if (!rows.some((row) => row.isYou) && self.matches > 0) {
    rows.push(
      toRow({
        rank: rows.length + 1,
        gamerTag: self.gamerTag,
        avatarUrl: self.avatarUrl,
        platform,
        isYou: true,
        kills: self.kills,
        deaths: self.deaths ?? 0,
        assists: self.assists ?? 0,
        winCount: self.winCount,
        matches: self.matches,
        leaguePoints: self.leaguePoints,
        delta: '—',
        trend: 'flat',
      }),
    );
  }

  rows.sort((a, b) => b.score - a.score || b.kills - a.kills);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

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
