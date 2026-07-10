import { Injectable } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MEDIA_POLICY, MEDIA_YOUTUBE_ATTRIBUTION_PREFIX } from './media.policy';
import type {
  MediaValidationResult,
  ResolvedYouTubeEmbed,
  SafeMediaAsset,
} from './media.types';

function parseHostname(url: string): string | null {
  try {
    return new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://localhost')
      .hostname;
  } catch {
    return null;
  }
}

function parsePathname(url: string): string {
  try {
    return new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://localhost')
      .pathname;
  } catch {
    return url;
  }
}

export function shouldUseStaticMediaMode(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia(`(max-width: ${MEDIA_POLICY.mobileMaxWidthPx}px)`).matches
  );
}

export function isAllowedEmbedHost(url: string): boolean {
  const host = parseHostname(url);
  if (!host) return false;
  return MEDIA_POLICY.embedAllowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function isForbiddenMediaSource(url: string): boolean {
  const host = parseHostname(url) ?? '';
  const path = parsePathname(url);
  if (MEDIA_POLICY.forbiddenHostPatterns.some((pattern) => pattern.test(host))) return true;
  if (MEDIA_POLICY.forbiddenPathPatterns.some((pattern) => pattern.test(path))) return true;
  if (/\.mp4(\?|$)/i.test(path) && !path.startsWith(MEDIA_POLICY.ambientPathPrefix)) return true;
  return false;
}

export function isApiThumbnailHost(url: string): boolean {
  const host = parseHostname(url);
  if (!host) return false;
  return MEDIA_POLICY.apiThumbnailHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function isOwnAssetUrl(url: string): boolean {
  if (url.startsWith('/assets/')) {
    return MEDIA_POLICY.ownAssetPrefixes.some((prefix) => url.startsWith(prefix));
  }
  return false;
}

/** Solo loops abstractos propios bajo /assets/ambient/*.webm */
export function resolveSafeAmbientVideoUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) return null;
  if (isForbiddenMediaSource(trimmed)) return null;
  if (!trimmed.startsWith(MEDIA_POLICY.ambientPathPrefix)) return null;
  if (!trimmed.toLowerCase().endsWith('.webm')) return null;
  return trimmed;
}

export function buildYouTubeEmbedUrl(videoId: string): ResolvedYouTubeEmbed | null {
  const id = videoId.trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0&modestbranding=1`;
  return { embedUrl, videoId: id };
}

export function validateSafeMediaAsset(asset: SafeMediaAsset): MediaValidationResult {
  if (!asset.url?.trim()) return { ok: false, reason: 'URL vacía' };
  if (isForbiddenMediaSource(asset.url)) {
    return { ok: false, reason: 'Fuente multimedia prohibida por política de IP' };
  }

  switch (asset.type) {
    case 'api-thumbnail':
      if (!asset.playerOwned) {
        return { ok: false, reason: 'api-thumbnail requiere playerOwned: true' };
      }
      if (!isApiThumbnailHost(asset.url)) {
        return { ok: false, reason: 'Host de thumbnail no permitido' };
      }
      if (asset.maxWidthPx > 150) {
        return { ok: false, reason: 'Thumbnail API excede maxWidthPx permitido (150)' };
      }
      return { ok: true };

    case 'own-svg':
      if (!isOwnAssetUrl(asset.url) && !asset.url.endsWith('.svg')) {
        return { ok: false, reason: 'own-svg debe ser asset local /assets/*.svg' };
      }
      return { ok: true };

    case 'ambient-webm': {
      const safe = resolveSafeAmbientVideoUrl(asset.url);
      if (!safe) return { ok: false, reason: 'ambient-webm debe ser /assets/ambient/*.webm' };
      return { ok: true };
    }

    case 'youtube-embed':
      if (!isAllowedEmbedHost(asset.url)) {
        return { ok: false, reason: 'Dominio de embed no está en allowlist' };
      }
      return { ok: true };

    default:
      return { ok: false, reason: 'Tipo de media desconocido' };
  }
}

export function formatYouTubeAttribution(creatorName: string): string {
  const name = creatorName.trim() || 'creador';
  return `${MEDIA_YOUTUBE_ATTRIBUTION_PREFIX} ${name}. UpStats AI no está afiliado a Epic Games ni Roblox Corp.`;
}

@Injectable({ providedIn: 'root' })
export class MediaPolicyService {
  constructor(private readonly sanitizer: DomSanitizer) {}

  validateAsset(asset: SafeMediaAsset): MediaValidationResult {
    return validateSafeMediaAsset(asset);
  }

  safeAmbientVideoUrl(url: string | null | undefined): string | null {
    return resolveSafeAmbientVideoUrl(url);
  }

  safeYouTubeEmbed(videoId: string): SafeResourceUrl | null {
    const resolved = buildYouTubeEmbedUrl(videoId);
    if (!resolved || !isAllowedEmbedHost(resolved.embedUrl)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(resolved.embedUrl);
  }

  staticMediaMode(): boolean {
    return shouldUseStaticMediaMode();
  }
}
