/**
 * Identificadores discriminantes para cada tipo de ítem en la single-table.
 */
export const EntityType = {
  Player: 'PLAYER',
  Match: 'MATCH',
  GameSession: 'GAME_SESSION',
  StatsRollup: 'STATS_ROLLUP',
  Telemetry: 'TELEMETRY',
  PlatformAccountLink: 'PLATFORM_ACCOUNT_LINK',
  GamerTagLookup: 'GAMERTAG_LOOKUP',
  CommunityBenchmark: 'COMMUNITY_BENCHMARK',
  LeaderboardEntry: 'LEADERBOARD_ENTRY',
  CommunityPlayerSeen: 'COMMUNITY_PLAYER_SEEN',
  MatchAiReport: 'MATCH_AI_REPORT',
  EvolutionAiReport: 'EVOLUTION_AI_REPORT',
} as const;

export type EntityTypeName = (typeof EntityType)[keyof typeof EntityType];
