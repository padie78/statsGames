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
} as const;

export type EntityTypeName = (typeof EntityType)[keyof typeof EntityType];
