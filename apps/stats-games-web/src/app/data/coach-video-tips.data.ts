/**
 * Tips / trailers YouTube — canales oficiales.
 * Reglas: youtube-nocookie, click-to-play, sin hostear MP4.
 */
import { gamePlatformMeta } from '../core/game/game-platform.config';

export interface CoachVideoTip {
  videoId: string;
  title: string;
  subtitle: string;
  creatorName: string;
  platform: 'fortnite' | 'roblox' | 'both';
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

const ROBLOX_TRAILERS: CoachVideoTip[] = [
  {
    videoId: '_EPelwsaF9E',
    title: 'Roblox 2021 Cinematic',
    subtitle: 'Cinematic oficial del canal Roblox.',
    creatorName: 'Roblox',
    platform: 'roblox',
  },
  {
    videoId: 'eAvXhNlO-rA',
    title: 'Roblox · Official Trailer',
    subtitle: 'Trailer oficial 2020 · canal Roblox.',
    creatorName: 'Roblox',
    platform: 'roblox',
  },
];

export function coachTipForPlatform(platform: string): CoachVideoTip | null {
  const tips = coachTipsForPlatform(platform);
  return tips[0] ?? null;
}

export function coachTipsForPlatform(platform: string): CoachVideoTip[] {
  if (platform === 'fortnite') {
    const meta = gamePlatformMeta('fortnite');
    if (meta.officialTrailerVideoId) {
      const configured = FORTNITE_TRAILERS.find((t) => t.videoId === meta.officialTrailerVideoId);
      const rest = FORTNITE_TRAILERS.filter((t) => t.videoId !== meta.officialTrailerVideoId);
      return configured ? [configured, ...rest] : FORTNITE_TRAILERS;
    }
    return FORTNITE_TRAILERS;
  }
  if (platform === 'roblox') {
    return ROBLOX_TRAILERS;
  }
  return [];
}
