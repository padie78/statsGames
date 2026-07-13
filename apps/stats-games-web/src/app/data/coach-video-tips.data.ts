/**
 * Tips / trailers YouTube — canales oficiales.
 * Reglas: youtube-nocookie, click-to-play, sin hostear MP4.
 */
import { gamePlatformMeta } from '../core/game/game-platform.config';
import {
  isRobloxExperienceGame,
  normalizeSelectedGame,
  type SelectedGame,
} from '../core/game/selected-game';

export interface CoachVideoTip {
  videoId: string;
  title: string;
  subtitle: string;
  creatorName: string;
  platform: SelectedGame | 'both';
}

const FORTNITE_TRAILERS: CoachVideoTip[] = [
  {
    videoId: 'V5L24DFTFUo',
    title: 'Chapter 7 Season 3 · Cinematic',
    subtitle: 'Trailer oficial Fortnite · click para reproducir.',
    creatorName: 'Fortnite',
    platform: 'fortnite',
  },
  {
    videoId: 'O4PFmJkedWc',
    title: 'Chapter 7 Season 3 · Gameplay',
    subtitle: 'Gameplay trailer oficial · embed del canal Fortnite.',
    creatorName: 'Fortnite',
    platform: 'fortnite',
  },
  {
    videoId: 'Eln66CJHna8',
    title: 'Chapter 7 · Pacific Break',
    subtitle: 'Cinematic de apertura del capítulo.',
    creatorName: 'Fortnite',
    platform: 'fortnite',
  },
];

const VALORANT_TRAILERS: CoachVideoTip[] = [
  {
    videoId: 'e_E9W2vsRbQ',
    title: 'Valorant · Official Trailer',
    subtitle: 'Trailer oficial Riot · click para reproducir.',
    creatorName: 'VALORANT',
    platform: 'valorant',
  },
];

const CS2_TRAILERS: CoachVideoTip[] = [
  {
    videoId: 'nSE38xjMLqE',
    title: 'Counter-Strike 2 · Launch Trailer',
    subtitle: 'Trailer oficial Valve · click para reproducir.',
    creatorName: 'Valve',
    platform: 'cs2',
  },
];

const RL_TRAILERS: CoachVideoTip[] = [
  {
    videoId: 'SgSX3gOrj60',
    title: 'Rocket League · Trailer',
    subtitle: 'Trailer oficial · click para reproducir.',
    creatorName: 'Rocket League',
    platform: 'rocket_league',
  },
];

const ROBLOX_TRAILERS: CoachVideoTip[] = [
  {
    videoId: '_EPelwsaF9E',
    title: 'Roblox 2021 Cinematic',
    subtitle: 'Cinematic oficial del canal Roblox.',
    creatorName: 'Roblox',
    platform: 'blox_fruits',
  },
  {
    videoId: 'eAvXhNlO-rA',
    title: 'Roblox · Official Trailer',
    subtitle: 'Trailer oficial 2020 · canal Roblox.',
    creatorName: 'Roblox',
    platform: 'adopt_me',
  },
];

export function coachTipForPlatform(platform: string): CoachVideoTip | null {
  const tips = coachTipsForPlatform(platform);
  return tips[0] ?? null;
}

export function coachTipsForPlatform(platform: string): CoachVideoTip[] {
  const game = normalizeSelectedGame(platform) ?? (platform === 'roblox' ? 'blox_fruits' : null);
  if (!game) return [];

  if (game === 'fortnite') {
    const meta = gamePlatformMeta('fortnite');
    if (meta.officialTrailerVideoId) {
      const configured = FORTNITE_TRAILERS.find((t) => t.videoId === meta.officialTrailerVideoId);
      const rest = FORTNITE_TRAILERS.filter((t) => t.videoId !== meta.officialTrailerVideoId);
      return configured ? [configured, ...rest] : FORTNITE_TRAILERS;
    }
    return FORTNITE_TRAILERS;
  }
  if (game === 'valorant') {
    const meta = gamePlatformMeta('valorant');
    if (meta.officialTrailerVideoId) {
      const hit = VALORANT_TRAILERS.find((t) => t.videoId === meta.officialTrailerVideoId);
      return hit ? [hit, ...VALORANT_TRAILERS.filter((t) => t !== hit)] : VALORANT_TRAILERS;
    }
    return VALORANT_TRAILERS;
  }
  if (game === 'cs2') {
    return CS2_TRAILERS;
  }
  if (game === 'rocket_league') {
    return RL_TRAILERS;
  }
  if (isRobloxExperienceGame(game)) {
    return ROBLOX_TRAILERS;
  }
  return [];
}
