import {
  backendPlatformForGame,
  isRobloxExperienceGame,
  type SelectedGame,
} from './selected-game';

export type { SelectedGame };
export { backendPlatformForGame, isRobloxExperienceGame };

/** Cover para fan / switcher — still del trailer oficial en YouTube. */
function youtubeCover(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export interface GamePlatformMeta {
  id: SelectedGame;
  label: string;
  shortLabel: string;
  badge: string;
  tagline: string;
  statsHint: string;
  artUrl: string;
  /** Imagen de cover (trailer YT / experience Roblox). */
  portraitUrl: string;
  /** Fallback local si falla el remoto. */
  portraitFallbackUrl: string;
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
    portraitUrl: youtubeCover('e_E9W2vsRbQ'),
    portraitFallbackUrl: '/assets/games/valorant-portrait.svg',
    iconUrl: '/assets/games/valorant-icon.svg',
    officialTrailerVideoId: 'e_E9W2vsRbQ',
    officialTrailerTitle: 'Valorant cinematic',
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
    portraitUrl: youtubeCover('tEnsqpThaFg'),
    portraitFallbackUrl: '/assets/games/league_of_legends-portrait.svg',
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
    portraitUrl: youtubeCover('nSE38xjMLqE'),
    portraitFallbackUrl: '/assets/games/cs2-portrait.svg',
    iconUrl: '/assets/games/cs2-icon.svg',
    officialTrailerVideoId: 'nSE38xjMLqE',
    officialTrailerTitle: 'Counter-Strike 2 trailer',
    accent: 'amber',
    shellGlow: 'rgba(222, 155, 45, 0.16)',
    themeClass: 'sg-theme--cs2',
  },
  dota2: {
    id: 'dota2',
    label: 'Dota 2',
    shortLabel: 'Dota',
    badge: 'MOBA · Ranked',
    tagline: 'KDA, GPM y visión por rol y héroe.',
    statsHint: 'KDA · GPM · XPM',
    artUrl: '/assets/games/dota2-hero.svg',
    portraitUrl: youtubeCover('-cSFPIwMEq4'),
    portraitFallbackUrl: '/assets/games/dota2-portrait.svg',
    iconUrl: '/assets/games/dota2-icon.svg',
    officialTrailerVideoId: '-cSFPIwMEq4',
    officialTrailerTitle: 'Dota 2 cinematic',
    accent: 'rose',
    shellGlow: 'rgba(194, 60, 42, 0.16)',
    themeClass: 'sg-theme--dota2',
  },
  overwatch2: {
    id: 'overwatch2',
    label: 'Overwatch 2',
    shortLabel: 'OW2',
    badge: 'Hero Shooter · Competitive',
    tagline: 'Eliminaciones, damage y role queue.',
    statsHint: 'Elims · Damage · Heals',
    artUrl: '/assets/games/overwatch2-hero.svg',
    portraitUrl: youtubeCover('dushYtgmxvw'),
    portraitFallbackUrl: '/assets/games/overwatch2-portrait.svg',
    iconUrl: '/assets/games/overwatch2-icon.svg',
    officialTrailerVideoId: 'dushYtgmxvw',
    officialTrailerTitle: 'Overwatch 2 trailer',
    accent: 'amber',
    shellGlow: 'rgba(249, 158, 26, 0.16)',
    themeClass: 'sg-theme--overwatch2',
  },
  rocket_league: {
    id: 'rocket_league',
    label: 'Rocket League',
    shortLabel: 'RL',
    badge: 'Sports · Competitive',
    tagline: 'Goles, saves y MMR en cada playlist.',
    statsHint: 'Goals · Saves · Shot%',
    artUrl: '/assets/games/rocket_league-hero.svg',
    portraitUrl: youtubeCover('SgSX3gOrj60'),
    portraitFallbackUrl: '/assets/games/rocket_league-portrait.svg',
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
    portraitUrl: youtubeCover('V5L24DFTFUo'),
    portraitFallbackUrl: '/assets/games/fortnite-portrait.svg',
    iconUrl: '/assets/games/fortnite-icon.svg',
    officialTrailerVideoId: 'V5L24DFTFUo',
    officialTrailerTitle: 'Fortnite cinematic',
    accent: 'purple',
    shellGlow: 'rgba(139, 131, 240, 0.14)',
    themeClass: 'sg-theme--fortnite',
  },
  clash_royale: {
    id: 'clash_royale',
    label: 'Clash Royale',
    shortLabel: 'CR',
    badge: 'Mobile · Strategy',
    tagline: 'Copas, win rate y decks por ladder.',
    statsHint: 'Trophies · WR · Crowns',
    artUrl: '/assets/games/clash_royale-hero.svg',
    portraitUrl: youtubeCover('bBWGTzpefgU'),
    portraitFallbackUrl: '/assets/games/clash_royale-portrait.svg',
    iconUrl: '/assets/games/clash_royale-icon.svg',
    officialTrailerVideoId: 'bBWGTzpefgU',
    officialTrailerTitle: 'Clash Royale trailer',
    accent: 'cyan',
    shellGlow: 'rgba(74, 144, 217, 0.16)',
    themeClass: 'sg-theme--clash_royale',
  },
  brawl_stars: {
    id: 'brawl_stars',
    label: 'Brawl Stars',
    shortLabel: 'BS',
    badge: 'Mobile · Arena',
    tagline: 'Trofeos, win rate y brawlers por modo.',
    statsHint: 'Trophies · WR · Kills',
    artUrl: '/assets/games/brawl_stars-hero.svg',
    portraitUrl: youtubeCover('yru-5Aw2n3g'),
    portraitFallbackUrl: '/assets/games/brawl_stars-portrait.svg',
    iconUrl: '/assets/games/brawl_stars-icon.svg',
    officialTrailerVideoId: 'yru-5Aw2n3g',
    officialTrailerTitle: 'Brawl Stars trailer',
    accent: 'purple',
    shellGlow: 'rgba(245, 197, 24, 0.16)',
    themeClass: 'sg-theme--brawl_stars',
  },
  blox_fruits: {
    id: 'blox_fruits',
    label: 'Blox Fruits',
    shortLabel: 'BF',
    badge: 'Roblox · Adventure',
    tagline: 'Seas, fruits y raids — hitos por badges.',
    statsHint: 'Seas · Badges · Progress',
    artUrl: '/assets/games/blox_fruits-hero.svg',
    portraitUrl:
      'https://tr.rbxcdn.com/180DAY-a64f70da20fc1e80ee76fe5d49c1be0a/512/512/Image/Png/noFilter',
    portraitFallbackUrl: '/assets/games/blox_fruits-portrait.svg',
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
    portraitUrl:
      'https://tr.rbxcdn.com/180DAY-c614dbe36b99f06774bfefa0137096ab/512/512/Image/Png/noFilter',
    portraitFallbackUrl: '/assets/games/adopt_me-portrait.svg',
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
    portraitUrl:
      'https://tr.rbxcdn.com/180DAY-681b48f8fd3d50f8292d1b084158725f/512/512/Image/Png/noFilter',
    portraitFallbackUrl: '/assets/games/brookhaven-portrait.svg',
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
  GAME_PLATFORMS.dota2,
  GAME_PLATFORMS.overwatch2,
  GAME_PLATFORMS.rocket_league,
  GAME_PLATFORMS.fortnite,
  GAME_PLATFORMS.clash_royale,
  GAME_PLATFORMS.brawl_stars,
  GAME_PLATFORMS.blox_fruits,
  GAME_PLATFORMS.adopt_me,
  GAME_PLATFORMS.brookhaven,
];

export function gamePlatformMeta(game: SelectedGame | null | undefined): GamePlatformMeta {
  if (game && game in GAME_PLATFORMS) return GAME_PLATFORMS[game];
  return GAME_PLATFORMS.fortnite;
}
