/**
 * Catálogo de plataformas StatsGames (MVP multi-juego).
 *
 * Fase 1 — APIs estables: valorant, rocket_league, league_of_legends, cs2, dota2
 * Fase 2 — tracción: fortnite, overwatch2, clash_royale, brawl_stars, roblox
 */

export const GAME_PLATFORMS = [
  'valorant',
  'league_of_legends',
  'cs2',
  'dota2',
  'overwatch2',
  'rocket_league',
  'fortnite',
  'clash_royale',
  'brawl_stars',
  'roblox',
] as const;

export type GamePlatform = (typeof GAME_PLATFORMS)[number];

export type PlatformIntegrationMode =
  | 'official_api_poll'
  | 'ecosystem_api_poll'
  | 'webhook_partner'
  | 'presence_badges';

export type PlatformProfileField =
  | 'valorantId'
  | 'leagueOfLegendsId'
  | 'cs2Id'
  | 'dota2Id'
  | 'overwatch2Id'
  | 'rocketLeagueId'
  | 'fortniteId'
  | 'clashRoyaleId'
  | 'brawlStarsId'
  | 'robloxId';

export interface PlatformCatalogEntry {
  id: GamePlatform;
  label: string;
  shortLabel: string;
  phase: 1 | 2;
  integrationMode: PlatformIntegrationMode;
  /** Campo en PlayerProfile Dynamo/GraphQL */
  profileField: PlatformProfileField;
  externalIdHint: string;
  externalIdPlaceholder: string;
  /** Qué stats típicas viajan en Match.stats (además de kills/deaths/assists). */
  statHints: string[];
}

export const PLATFORM_CATALOG: Record<GamePlatform, PlatformCatalogEntry> = {
  /** Perfiles privados por defecto: RSO recomendado, o historial Público + Riot ID. */
  valorant: {
    id: 'valorant',
    label: 'Valorant',
    shortLabel: 'VAL',
    phase: 1,
    integrationMode: 'official_api_poll',
    profileField: 'valorantId',
    externalIdHint: 'RSO o Riot ID (Nombre#TAG) con historial Público',
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
  dota2: {
    id: 'dota2',
    label: 'Dota 2',
    shortLabel: 'Dota',
    phase: 1,
    integrationMode: 'official_api_poll',
    profileField: 'dota2Id',
    externalIdHint: 'SteamID64 (17 dígitos)',
    externalIdPlaceholder: 'ej. 76561198000000000',
    statHints: ['kills', 'deaths', 'assists', 'hero', 'gpm', 'xpm', 'won'],
  },
  overwatch2: {
    id: 'overwatch2',
    label: 'Overwatch 2',
    shortLabel: 'OW2',
    phase: 2,
    integrationMode: 'ecosystem_api_poll',
    profileField: 'overwatch2Id',
    externalIdHint: 'BattleTag (Nombre#1234)',
    externalIdPlaceholder: 'ej. Player#1234',
    statHints: ['kills', 'deaths', 'assists', 'damage', 'healing', 'hero', 'role', 'won'],
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
  clash_royale: {
    id: 'clash_royale',
    label: 'Clash Royale',
    shortLabel: 'CR',
    phase: 2,
    integrationMode: 'official_api_poll',
    profileField: 'clashRoyaleId',
    externalIdHint: 'Player tag (#ABC123)',
    externalIdPlaceholder: 'ej. #2PP',
    statHints: ['won', 'crowns', 'trophies', 'mode', 'score'],
  },
  brawl_stars: {
    id: 'brawl_stars',
    label: 'Brawl Stars',
    shortLabel: 'BS',
    phase: 2,
    integrationMode: 'official_api_poll',
    profileField: 'brawlStarsId',
    externalIdHint: 'Player tag (#ABC123)',
    externalIdPlaceholder: 'ej. #2PP',
    statHints: ['kills', 'deaths', 'won', 'trophies', 'brawler', 'mode'],
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
