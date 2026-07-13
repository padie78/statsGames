import {
  backendPlatformForGame,
  isRobloxExperienceGame,
  type SelectedGame,
} from './selected-game';

export type { SelectedGame };
export { backendPlatformForGame, isRobloxExperienceGame };

export interface GamePlatformMeta {
  id: SelectedGame;
  label: string;
  shortLabel: string;
  badge: string;
  tagline: string;
  statsHint: string;
  artUrl: string;
  portraitUrl: string;
  iconUrl: string;
  ambientVideoUrl?: string;
  pressBannerUrl?: string;
  officialTrailerVideoId?: string;
  officialTrailerTitle?: string;
  accent: 'lime' | 'cyan' | 'purple' | 'amber' | 'rose' | 'sky';
  shellGlow: string;
  themeClass: string;
}

export const GAME_PLATFORMS: Record<SelectedGame, GamePlatformMeta> = {
  valorant: {
    id: 'valorant',
    label: 'Valorant',
    shortLabel: 'VAL',
    badge: 'Tactical FPS · Ranked',
    tagline: 'KDA, headshots y clutch por ronda.',
    statsHint: 'K/D · HS% · Rounds',
    artUrl: '/assets/games/valorant-hero.svg',
    portraitUrl: '/assets/games/valorant-portrait.svg',
    iconUrl: '/assets/games/valorant-icon.svg',
    officialTrailerVideoId: 'IhhjcL2enJk',
    officialTrailerTitle: 'Valorant trailer',
    accent: 'rose',
    shellGlow: 'rgba(255, 70, 85, 0.14)',
    themeClass: 'sg-theme--valorant',
  },
  league_of_legends: {
    id: 'league_of_legends',
    label: 'League of Legends',
    shortLabel: 'LoL',
    badge: 'MOBA · Ranked',
    tagline: 'KDA, CS y visión por rol y campeón.',
    statsHint: 'KDA · CS · Vision',
    artUrl: '/assets/games/league_of_legends-hero.svg',
    portraitUrl: '/assets/games/league_of_legends-portrait.svg',
    iconUrl: '/assets/games/league_of_legends-icon.svg',
    officialTrailerVideoId: 'tEnsqpThaFg',
    officialTrailerTitle: 'League of Legends cinematic',
    accent: 'amber',
    shellGlow: 'rgba(200, 155, 60, 0.16)',
    themeClass: 'sg-theme--league_of_legends',
  },
  cs2: {
    id: 'cs2',
    label: 'Counter-Strike 2',
    shortLabel: 'CS2',
    badge: 'Tactical FPS · Competitive',
    tagline: 'ADR, HS% y rounds en cada mapa.',
    statsHint: 'K/D · ADR · HS%',
    artUrl: '/assets/games/cs2-hero.svg',
    portraitUrl: '/assets/games/cs2-portrait.svg',
    iconUrl: '/assets/games/cs2-icon.svg',
    officialTrailerVideoId: 'n1sP7VD2I04',
    officialTrailerTitle: 'Counter-Strike 2 trailer',
    accent: 'amber',
    shellGlow: 'rgba(222, 155, 45, 0.16)',
    themeClass: 'sg-theme--cs2',
  },
  rocket_league: {
    id: 'rocket_league',
    label: 'Rocket League',
    shortLabel: 'RL',
    badge: 'Sports · Competitive',
    tagline: 'Goles, saves y MMR en cada playlist.',
    statsHint: 'Goals · Saves · Shot%',
    artUrl: '/assets/games/rocket_league-hero.svg',
    portraitUrl: '/assets/games/rocket_league-portrait.svg',
    iconUrl: '/assets/games/rocket_league-icon.svg',
    officialTrailerVideoId: 'SgSX3gOrj60',
    officialTrailerTitle: 'Rocket League trailer',
    accent: 'sky',
    shellGlow: 'rgba(56, 189, 248, 0.14)',
    themeClass: 'sg-theme--rocket_league',
  },
  fortnite: {
    id: 'fortnite',
    label: 'Fortnite',
    shortLabel: 'FN',
    badge: 'Battle Royale · Ranked',
    tagline: 'Placement, eliminations y clutch en cada storm.',
    statsHint: 'Placement · K/D · Win Rate',
    artUrl: '/assets/games/fortnite-hero.svg',
    portraitUrl: '/assets/games/fortnite-portrait.svg',
    iconUrl: '/assets/games/fortnite-icon.svg',
    officialTrailerVideoId: 'V5L24DFTFUo',
    officialTrailerTitle: 'Fortnite cinematic',
    accent: 'purple',
    shellGlow: 'rgba(139, 131, 240, 0.14)',
    themeClass: 'sg-theme--fortnite',
  },
  blox_fruits: {
    id: 'blox_fruits',
    label: 'Blox Fruits',
    shortLabel: 'BF',
    badge: 'Roblox · Adventure',
    tagline: 'Seas, fruits y raids — hitos por badges.',
    statsHint: 'Seas · Badges · Progress',
    artUrl: '/assets/games/blox_fruits-hero.svg',
    portraitUrl: '/assets/games/blox_fruits-portrait.svg',
    iconUrl: '/assets/games/blox_fruits-icon.svg',
    accent: 'amber',
    shellGlow: 'rgba(251, 191, 36, 0.14)',
    themeClass: 'sg-theme--blox_fruits',
  },
  adopt_me: {
    id: 'adopt_me',
    label: 'Adopt Me!',
    shortLabel: 'AM',
    badge: 'Roblox · Pets',
    tagline: 'Pets, eggs y quests de temporada.',
    statsHint: 'Quests · Pets · Badges',
    artUrl: '/assets/games/adopt_me-hero.svg',
    portraitUrl: '/assets/games/adopt_me-portrait.svg',
    iconUrl: '/assets/games/adopt_me-icon.svg',
    accent: 'rose',
    shellGlow: 'rgba(244, 114, 182, 0.14)',
    themeClass: 'sg-theme--adopt_me',
  },
  brookhaven: {
    id: 'brookhaven',
    label: 'Brookhaven RP',
    shortLabel: 'BH',
    badge: 'Roblox · Roleplay',
    tagline: 'Vida en la ciudad — sesiones y estilo.',
    statsHint: 'Sessions · Presence',
    artUrl: '/assets/games/brookhaven-hero.svg',
    portraitUrl: '/assets/games/brookhaven-portrait.svg',
    iconUrl: '/assets/games/brookhaven-icon.svg',
    accent: 'lime',
    shellGlow: 'rgba(132, 204, 22, 0.14)',
    themeClass: 'sg-theme--brookhaven',
  },
};

export const GAME_PLATFORM_LIST: GamePlatformMeta[] = [
  GAME_PLATFORMS.valorant,
  GAME_PLATFORMS.league_of_legends,
  GAME_PLATFORMS.cs2,
  GAME_PLATFORMS.rocket_league,
  GAME_PLATFORMS.fortnite,
  GAME_PLATFORMS.blox_fruits,
  GAME_PLATFORMS.adopt_me,
  GAME_PLATFORMS.brookhaven,
];

export function gamePlatformMeta(game: SelectedGame | null | undefined): GamePlatformMeta {
  if (game && game in GAME_PLATFORMS) return GAME_PLATFORMS[game];
  return GAME_PLATFORMS.fortnite;
}
