/**
 * Score de ranking comunitario basado en ratios (no volumen bruto).
 * Evita que más partidas/kills totales empujen artificialmente al tope.
 *
 * Componentes:
 * - KDA (kills+assists)/deaths
 * - Win rate %
 * - Kills por partida
 * - Fiabilidad: peso completo desde 5 partidas
 */
export function computeFairLeaderboardScore(input: {
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
  const raw = kda * 100 + winRate * 1.5 + killsPerGame * 12;
  return Math.round(raw * reliability);
}

export function computeTrueKda(input: {
  totalKills: number;
  totalDeaths: number;
  totalAssists?: number;
}): number {
  const deaths = Math.max(1, input.totalDeaths);
  const assists = Math.max(0, input.totalAssists ?? 0);
  return Math.round(((input.totalKills + assists) / deaths) * 100) / 100;
}
