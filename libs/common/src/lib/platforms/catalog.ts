/**
 * Catálogo de plataformas StatsGames (MVP multi-juego).
 *
 * Fase 1 — APIs estables: valorant, rocket_league
 * Fase 2 — tracción: fortnite (poller), roblox BedWars + Arsenal (badges)
 */

export const GAME_PLATFORMS = [
  'valorant',
  'rocket_league',
  'fortnite',
  'roblox',
] as const;

export type GamePlatform = (typeof GAME_PLATFORMS)[number];

export type PlatformIntegrationMode =
  | 'official_api_poll'
  | 'ecosystem_api_poll'
  | 'webhook_partner'
  | 'presence_badges';

export interface PlatformCatalogEntry {
  id: GamePlatform;
  label: string;
  shortLabel: string;
  phase: 1 | 2;
  integrationMode: PlatformIntegrationMode;
  /** Campo en PlayerProfile Dynamo/GraphQL */
  profileField: 'valorantId' | 'rocketLeagueId' | 'fortniteId' | 'robloxId';
  externalIdHint: string;
  externalIdPlaceholder: string;
  /** Qué stats típicas viajan en Match.stats (además de kills/deaths/assists). */
  statHints: string[];
}

export const PLATFORM_CATALOG: Record<GamePlatform, PlatformCatalogEntry> = {
  valorant: {
    id: 'valorant',
    label: 'Valorant',
    shortLabel: 'VAL',
    phase: 1,
    integrationMode: 'official_api_poll',
    profileField: 'valorantId',
    externalIdHint: 'Riot ID (Nombre#TAG)',
    externalIdPlaceholder: 'ej. Player#NA1',
    statHints: ['kills', 'deaths', 'assists', 'headshotPct', 'roundsWon', 'map', 'agent'],
  },
  rocket_league: {
    id: 'rocket_league',
    label: 'Rocket League',
    shortLabel: 'RL',
    phase: 1,
    integrationMode: 'official_api_poll',
    profileField: 'rocketLeagueId',
    externalIdHint: 'Epic display name / platform id',
    externalIdPlaceholder: 'ej. TuEpicName',
    statHints: ['goals', 'assists', 'saves', 'shots', 'score', 'playlist', 'mmrDelta'],
  },
  fortnite: {
    id: 'fortnite',
    label: 'Fortnite',
    shortLabel: 'FN',
    phase: 2,
    integrationMode: 'ecosystem_api_poll',
    profileField: 'fortniteId',
    externalIdHint: 'Epic account id (32 hex) o display name',
    externalIdPlaceholder: 'ej. TuDisplayName',
    statHints: ['kills', 'deaths', 'wins', 'placement', 'mode'],
  },
  roblox: {
    id: 'roblox',
    label: 'Roblox · BedWars & Arsenal',
    shortLabel: 'RBX',
    phase: 2,
    integrationMode: 'presence_badges',
    profileField: 'robloxId',
    externalIdHint: 'Roblox UserId (número)',
    externalIdPlaceholder: 'ej. 123456789',
    statHints: ['bedwarsBadges', 'arsenalBadges', 'experienceName', 'avatar'],
  },
};

export function isGamePlatform(value: string): value is GamePlatform {
  return (GAME_PLATFORMS as readonly string[]).includes(value.toLowerCase());
}

export function platformLabel(platform: string): string {
  const key = platform.toLowerCase();
  if (isGamePlatform(key)) return PLATFORM_CATALOG[key].label;
  return platform;
}
