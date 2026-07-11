/**
 * Tips / trailers YouTube — canales oficiales o demos de producto.
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

export function coachTipForPlatform(platform: string): CoachVideoTip | null {
  if (platform !== 'fortnite' && platform !== 'roblox') return null;
  const meta = gamePlatformMeta(platform);
  if (!meta.officialTrailerVideoId) return null;

  return {
    videoId: meta.officialTrailerVideoId,
    title: meta.officialTrailerTitle ?? `Trailer oficial · ${meta.label}`,
    subtitle: 'Embed del canal oficial · click para reproducir (no hospedamos el video).',
    creatorName: platform === 'fortnite' ? 'Fortnite' : 'Roblox',
    platform,
  };
}
