/**
 * Juegos seleccionables en la UI (switcher / onboarding / shell).
 * Roblox experiences top-level: blox_fruits, adopt_me, brookhaven.
 */
export const SELECTED_GAMES = [
  'valorant',
  'league_of_legends',
  'cs2',
  'dota2',
  'overwatch2',
  'rocket_league',
  'fortnite',
  'clash_royale',
  'brawl_stars',
  'blox_fruits',
  'adopt_me',
  'brookhaven',
] as const;

export type SelectedGame = (typeof SELECTED_GAMES)[number];

export function isSelectedGame(value: string | null | undefined): value is SelectedGame {
  return !!value && (SELECTED_GAMES as readonly string[]).includes(value);
}

/** Migra valores legacy de Cognito. */
export function normalizeSelectedGame(raw: string | null | undefined): SelectedGame | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (isSelectedGame(v)) return v;
  if (v === 'lol') return 'league_of_legends';
  if (v === 'counter_strike_2' || v === 'counter-strike-2') return 'cs2';
  if (v === 'dota' || v === 'dota_2') return 'dota2';
  if (v === 'overwatch' || v === 'overwatch_2' || v === 'ow2') return 'overwatch2';
  if (v === 'clashroyale' || v === 'clash-royale') return 'clash_royale';
  if (v === 'brawlstars' || v === 'brawl-stars') return 'brawl_stars';
  if (v === 'roblox') return 'blox_fruits';
  return null;
}

/** Plataforma de backend / perfil para upsert y queries. */
export type BackendPlatform =
  | 'valorant'
  | 'league_of_legends'
  | 'cs2'
  | 'dota2'
  | 'overwatch2'
  | 'rocket_league'
  | 'fortnite'
  | 'clash_royale'
  | 'brawl_stars'
  | 'roblox';

const FIRST_CLASS_BACKEND: ReadonlySet<BackendPlatform> = new Set([
  'valorant',
  'league_of_legends',
  'cs2',
  'dota2',
  'overwatch2',
  'rocket_league',
  'fortnite',
  'clash_royale',
  'brawl_stars',
]);

export function backendPlatformForGame(game: SelectedGame): BackendPlatform {
  if (FIRST_CLASS_BACKEND.has(game as BackendPlatform)) {
    return game as BackendPlatform;
  }
  return 'roblox';
}

export function isRobloxExperienceGame(game: SelectedGame | null | undefined): boolean {
  return game === 'blox_fruits' || game === 'adopt_me' || game === 'brookhaven';
}

/** Plataforma de match/API a partir del juego UI (o backend). */
export function matchBackendPlatform(
  game: SelectedGame | BackendPlatform | null | undefined,
): BackendPlatform | undefined {
  if (!game) return undefined;
  if (game === 'roblox' || FIRST_CLASS_BACKEND.has(game as BackendPlatform)) {
    return game as BackendPlatform;
  }
  return backendPlatformForGame(game);
}

/** Normaliza platform de API/match a SelectedGame para UI. */
export function selectedGameFromBackend(
  platform: string | null | undefined,
  preferred?: SelectedGame | null,
): SelectedGame {
  const normalized = normalizeSelectedGame(platform);
  if (normalized) return normalized;
  if (platform?.toLowerCase() === 'roblox') {
    return preferred && isRobloxExperienceGame(preferred) ? preferred : 'blox_fruits';
  }
  return preferred ?? 'fortnite';
}

export function isBackendPlatform(value: string | null | undefined): value is BackendPlatform {
  return (
    value === 'roblox' ||
    (typeof value === 'string' && FIRST_CLASS_BACKEND.has(value as BackendPlatform))
  );
}
