/**
 * Juegos seleccionables en la UI (switcher / onboarding / shell).
 * Roblox experiences top-level: blox_fruits, adopt_me, brookhaven.
 */
export const SELECTED_GAMES = [
  'valorant',
  'rocket_league',
  'fortnite',
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
  if (v === 'roblox') return 'blox_fruits';
  return null;
}

/** Plataforma de backend / perfil para upsert y queries. */
export type BackendPlatform = 'valorant' | 'rocket_league' | 'fortnite' | 'roblox';

export function backendPlatformForGame(game: SelectedGame): BackendPlatform {
  if (game === 'valorant' || game === 'rocket_league' || game === 'fortnite') return game;
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
  if (game === 'roblox' || game === 'valorant' || game === 'rocket_league' || game === 'fortnite') {
    return game;
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
    value === 'valorant' ||
    value === 'rocket_league' ||
    value === 'fortnite' ||
    value === 'roblox'
  );
}
