export type MediaSourceType = 'api-thumbnail' | 'own-svg' | 'youtube-embed' | 'ambient-webm';

export type SafeMediaMaxWidth = 48 | 64 | 150 | 320;

export interface SafeMediaAsset {
  type: MediaSourceType;
  url: string;
  alt: string;
  maxWidthPx: SafeMediaMaxWidth;
  /** Obligatorio cuando type === 'api-thumbnail' */
  playerOwned?: boolean;
  attribution?: string;
}

export interface MediaValidationResult {
  ok: boolean;
  reason?: string;
}

export interface ResolvedYouTubeEmbed {
  embedUrl: string;
  videoId: string;
}
