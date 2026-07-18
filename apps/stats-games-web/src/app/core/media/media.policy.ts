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
  /** Arte propio + press kits descargados manualmente tras revisar licencia */
  ownAssetPrefixes: [
    '/assets/games/',
    '/assets/platforms/',
    '/assets/ambient/',
    '/assets/press/',
  ] as const,
  forbiddenHostPatterns: [
    /tiktok\.com/i,
    /tiktokcdn\.com/i,
  ] as const,
  /** No hostear trailers como MP4 propio; usar YouTube embed */
  forbiddenPathPatterns: [
    /\/official-logo/i,
    /epic-gameplay/i,
    /\/hosted-trailer/i,
  ] as const,
  apiThumbnailHosts: [
    'thumbnails.roblox.com',
    'tr.rbxcdn.com',
    'fortnite-api.com',
    'cdn.fortnite-api.com',
    'media.fortnite.com',
    'cdn2.unrealengine.com',
    'cdn-live.prm.ol.epicgames.com',
    'ddragon.leagueoflegends.com',
    'cdn.communitydragon.org',
    'raw.communitydragon.org',
    'i.ytimg.com',
  ] as const,
  maxApiThumbPx: {
    avatar: 150,
    cosmetic: 64,
    featuredCosmetic: 160,
    newsTile: 400,
  } as const,
} as const;

export const MEDIA_LEGAL_DISCLAIMER =
  'StatsGames no está afiliado, respaldado ni patrocinado por Riot Games, Valve, Psyonix, Epic Games, Roblox Corporation ni sus licenciantes. Valorant, League of Legends, Counter-Strike, Rocket League, Fortnite y Roblox son marcas de sus respectivos titulares.';

export const MEDIA_YOUTUBE_ATTRIBUTION_PREFIX = 'Video ©';

/** Docs / press — el usuario debe aceptar términos antes de copiar assets */
export const MEDIA_PRESS_KIT_GUIDE = {
  fortnite: 'https://www.epicgames.com/fortnite/news',
  roblox: 'https://create.roblox.com/docs/production/promotion',
  epicBrand: 'https://brand.epicgames.com/',
} as const;
