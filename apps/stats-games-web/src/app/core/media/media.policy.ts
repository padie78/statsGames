/** Límites de multimedia — ver `.cursor/rules/media-ip-policy.mdc` */
export const MEDIA_POLICY = {
  maxConcurrentVideos: 1,
  maxAmbientDurationSec: 8,
  maxAmbientFileSizeKb: 200,
  allowAutoplay: false,
  allowAudio: false,
  mobileMaxWidthPx: 767,
  embedAllowlist: ['youtube-nocookie.com', 'www.youtube-nocookie.com'] as const,
  ambientPathPrefix: '/assets/ambient/',
  ownAssetPrefixes: ['/assets/games/', '/assets/platforms/', '/assets/ambient/'] as const,
  forbiddenHostPatterns: [
    /epicgames\.com/i,
    /fortnite\.com/i,
    /tiktok\.com/i,
    /tiktokcdn\.com/i,
  ] as const,
  forbiddenPathPatterns: [
    /\/fortnite-trailer/i,
    /\/roblox-promo/i,
    /\/official-logo/i,
    /epic-gameplay/i,
    /\/video\//i,
  ] as const,
  apiThumbnailHosts: [
    'thumbnails.roblox.com',
    'tr.rbxcdn.com',
    'fortnite-api.com',
    'cdn2.unrealengine.com',
  ] as const,
} as const;

export const MEDIA_LEGAL_DISCLAIMER =
  'UpStats AI no está afiliado, respaldado ni patrocinado por Epic Games, Roblox Corporation ni sus licenciantes. Fortnite y Roblox son marcas de sus respectivos titulares.';

export const MEDIA_YOUTUBE_ATTRIBUTION_PREFIX = 'Video ©';
