import type { SelectedGame } from '../services/auth.service';

export interface GamePlatformMeta {
  id: SelectedGame;
  label: string;
  shortLabel: string;
  badge: string;
  tagline: string;
  statsHint: string;
  artUrl: string;
  /** Arte vertical para picker tipo portrait (Mobalytics-style) */
  portraitUrl: string;
  iconUrl: string;
  /** Loop WebM opcional — si falta, usa animación CSS */
  ambientVideoUrl?: string;
  /**
   * Banner press kit opcional (copiar a /assets/press/... tras revisar licencia Epic/Roblox).
   * Si existe, PlatformMediaService lo prioriza sobre artUrl.
   */
  pressBannerUrl?: string;
  /** Trailer oficial YouTube (click-to-play, no hostear MP4) */
  officialTrailerVideoId?: string;
  officialTrailerTitle?: string;
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
    artUrl: '/assets/games/roblox-hero.png',
    portraitUrl: '/assets/games/roblox-hero.png',
    iconUrl: '/assets/games/roblox-icon.png',
    ambientVideoUrl: '/assets/ambient/roblox-abstract-loop.webm',
    officialTrailerVideoId: '_EPelwsaF9E',
    officialTrailerTitle: 'Roblox 2021 Cinematic (oficial)',
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
    artUrl: '/assets/games/fortnite-hero.png',
    portraitUrl: '/assets/games/fortnite-hero.png',
    iconUrl: '/assets/games/fortnite-icon.png',
    ambientVideoUrl: '/assets/ambient/fortnite-abstract-loop.webm',
    officialTrailerVideoId: 'V5L24DFTFUo',
    officialTrailerTitle: 'Chapter 7 Season 3 · Official Cinematic',
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
