import type { SelectedGame } from '../services/auth.service';

export interface GamePlatformMeta {
  id: SelectedGame;
  label: string;
  shortLabel: string;
  badge: string;
  tagline: string;
  statsHint: string;
  artUrl: string;
  iconUrl: string;
  /** Loop WebM opcional — si falta, usa animación CSS */
  ambientVideoUrl?: string;
  accent: 'lime' | 'purple';
  /** Color para fondos y glow del shell cuando este juego está activo */
  shellGlow: string;
}

export const GAME_PLATFORMS: Record<SelectedGame, GamePlatformMeta> = {
  roblox: {
    id: 'roblox',
    label: 'Roblox',
    shortLabel: 'RBX',
    badge: 'Sandbox · Experiences',
    tagline: 'Sesiones largas, XP y economía de experiencias.',
    statsHint: 'Sessions · XP/h · Hops',
    artUrl: '/assets/games/roblox-hero.svg',
    iconUrl: '/assets/games/roblox-icon.svg',
    ambientVideoUrl: '',
    accent: 'lime',
    shellGlow: 'rgba(139, 131, 240, 0.08)',
  },
  fortnite: {
    id: 'fortnite',
    label: 'Fortnite',
    shortLabel: 'FN',
    badge: 'Battle Royale · Ranked',
    tagline: 'Placement, eliminations y clutch en cada storm.',
    statsHint: 'Placement · K/D · Win Rate',
    artUrl: '/assets/games/fortnite-hero.svg',
    iconUrl: '/assets/games/fortnite-icon.svg',
    ambientVideoUrl: '',
    accent: 'purple',
    shellGlow: 'rgba(139, 131, 240, 0.1)',
  },
};

export const GAME_PLATFORM_LIST: GamePlatformMeta[] = [
  GAME_PLATFORMS['roblox'],
  GAME_PLATFORMS['fortnite'],
];

export function gamePlatformMeta(game: SelectedGame | null | undefined): GamePlatformMeta {
  if (game === 'roblox') return GAME_PLATFORMS['roblox'];
  return GAME_PLATFORMS['fortnite'];
}
