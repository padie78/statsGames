/**
 * Catálogo de plataformas StatsGames (MVP multi-juego).
 *
 * Fase 1 — APIs estables: valorant, rocket_league, league_of_legends, cs2
 * Fase 2 — tracción: fortnite (poller), roblox experiences (badges)
 */

export const GAME_PLATFORMS = [
  'valorant',
  'league_of_legends',
  'cs2',
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
  profileField:
    | 'valorantId'
    | 'leagueOfLegendsId'
    | 'cs2Id'
    | 'rocketLeagueId'
    | 'fortniteId'
    | 'robloxId';
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
    statHints: [
      'kills',
      'deaths',
      'assists',
      'headshotPct',
      'score',
      'acs',
      'roundsWon',
      'map',
      'agent',
      'won',
    ],
  },
  league_of_legends: {
    id: 'league_of_legends',
    label: 'League of Legends',
    shortLabel: 'LoL',
    phase: 1,
    integrationMode: 'official_api_poll',
    profileField: 'leagueOfLegendsId',
    externalIdHint: 'Riot ID (Nombre#TAG)',
    externalIdPlaceholder: 'ej. Summoner#EUW',
    statHints: ['kills', 'deaths', 'assists', 'champion', 'role', 'cs', 'visionScore', 'won'],
  },
  cs2: {
    id: 'cs2',
    label: 'Counter-Strike 2',
    shortLabel: 'CS2',
    phase: 1,
    integrationMode: 'webhook_partner',
    profileField: 'cs2Id',
    externalIdHint: 'SteamID64 (17 dígitos)',
    externalIdPlaceholder: 'ej. 76561198000000000',
    statHints: ['kills', 'deaths', 'assists', 'adr', 'headshotPct', 'map', 'won'],
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
    statHints: ['goals', 'assists', 'saves', 'shots', 'shotPct', 'score', 'won'],
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
    statHints: ['kills', 'deaths', 'placement', 'mode', 'won'],
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
    statHints: ['kills', 'deaths', 'placement', 'mode', 'experienceName'],
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
