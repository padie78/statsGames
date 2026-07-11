/**
 * Iconos oficiales de experiences Roblox vía Thumbnails API
 * + avatares showcase (personajes públicos) para login/marketing.
 *
 * Nota: thumbnails.roblox.com a menudo bloquea CORS en browser.
 * Estrategia: timeout corto → fallback a URLs CDN ya resueltas (tr.rbxcdn.com).
 */
import { Injectable, signal } from '@angular/core';
import { isApiThumbnailHost } from '../core/media';

export interface RobloxExperienceThumb {
  placeId: number;
  name: string;
  imageUrl: string;
}

export interface RobloxAvatarThumb {
  userId: number;
  name: string;
  imageUrl: string;
}

/** Experiences populares (placeIds públicos) — solo thumbs API. */
const CURATED_PLACES: Array<{ placeId: number; name: string }> = [
  { placeId: 2753915549, name: 'Blox Fruits' },
  { placeId: 920587237, name: 'Adopt Me!' },
  { placeId: 4924922222, name: 'Brookhaven' },
  { placeId: 286090429, name: 'Arsenal' },
  { placeId: 606849621, name: 'Jailbreak' },
  { placeId: 1537690962, name: 'Bee Swarm Simulator' },
  { placeId: 8737899170, name: 'Pet Simulator 99' },
  { placeId: 189707, name: 'Natural Disaster Survival' },
];

/**
 * Cuentas públicas + CDN fallback (tr.rbxcdn.com) si el XHR falla por CORS.
 * Los hashes rotan ~30 días; el fetch vivo los refresca cuando CORS/proxy lo permite.
 */
const SHOWCASE_AVATARS: Array<{ userId: number; name: string; fallbackUrl: string }> = [
  {
    userId: 1,
    name: 'Roblox',
    fallbackUrl:
      'https://tr.rbxcdn.com/30DAY-Avatar-310966282D3529E36976BF6B07B1DC90-Png/420/420/Avatar/Png/noFilter',
  },
  {
    userId: 156,
    name: 'Builderman',
    fallbackUrl:
      'https://tr.rbxcdn.com/30DAY-Avatar-882C70E071E5997E51F8CB373002AFC3-Png/420/420/Avatar/Png/noFilter',
  },
  {
    userId: 261,
    name: 'Shedletsky',
    fallbackUrl:
      'https://tr.rbxcdn.com/30DAY-Avatar-97C404164D7B9655EC6BFC1B3208F601-Png/420/420/Avatar/Png/noFilter',
  },
  {
    userId: 2032622,
    name: 'Telamon',
    fallbackUrl:
      'https://tr.rbxcdn.com/30DAY-Avatar-2D98E73D8851046C8BFD7037565D0981-Png/420/420/Avatar/Png/noFilter',
  },
];

@Injectable({ providedIn: 'root' })
export class RobloxExperiencesService {
  readonly items = signal<RobloxExperienceThumb[]>([]);
  readonly showcaseAvatars = signal<RobloxAvatarThumb[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private cacheAt = 0;
  private avatarCacheAt = 0;
  private readonly ttlMs = 60 * 60 * 1000;

  async load(limit = 6): Promise<RobloxExperienceThumb[]> {
    if (this.items().length && Date.now() - this.cacheAt < this.ttlMs) {
      return this.items().slice(0, limit);
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const curated = CURATED_PLACES.slice(0, limit);
      const ids = curated.map((p) => p.placeId).join(',');
      const endpoint =
        `https://thumbnails.roblox.com/v1/places/gameicons` +
        `?placeIds=${ids}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`;
      const payload = await this.fetchThumbsJson(endpoint);
      const byId = new Map<number, string>();
      for (const row of payload.data ?? []) {
        if (row.targetId == null || !row.imageUrl || !isApiThumbnailHost(row.imageUrl)) continue;
        byId.set(row.targetId, row.imageUrl);
      }

      const items: RobloxExperienceThumb[] = curated
        .map((place) => {
          const imageUrl = byId.get(place.placeId);
          if (!imageUrl) return null;
          return { placeId: place.placeId, name: place.name, imageUrl };
        })
        .filter((x): x is RobloxExperienceThumb => !!x);

      if (items.length) {
        this.items.set(items);
        this.cacheAt = Date.now();
      }
      return this.items().slice(0, limit);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudieron cargar experiences');
      return this.items().slice(0, limit);
    } finally {
      this.loading.set(false);
    }
  }

  /** Full-body avatars oficiales (≤420px) de cuentas públicas. */
  async loadShowcaseAvatars(limit = 4): Promise<RobloxAvatarThumb[]> {
    if (this.showcaseAvatars().length && Date.now() - this.avatarCacheAt < this.ttlMs) {
      return this.showcaseAvatars().slice(0, limit);
    }

    const curated = SHOWCASE_AVATARS.slice(0, Math.max(limit, 4));
    const fallback = (): RobloxAvatarThumb[] =>
      curated
        .map((user) => ({
          userId: user.userId,
          name: user.name,
          imageUrl: user.fallbackUrl,
        }))
        .filter((item) => isApiThumbnailHost(item.imageUrl))
        .slice(0, limit);

    // Mostrar CDN de inmediato (img no necesita CORS); refrescar si el API responde.
    if (!this.showcaseAvatars().length) {
      this.showcaseAvatars.set(fallback());
    }

    try {
      const ids = curated.map((u) => u.userId).join(',');
      const endpoint =
        `https://thumbnails.roblox.com/v1/users/avatar` +
        `?userIds=${ids}&size=420x420&format=Png&isCircular=false`;
      const payload = await this.fetchThumbsJson(endpoint);
      const byId = new Map<number, string>();
      for (const row of payload.data ?? []) {
        if (row.targetId == null || !row.imageUrl || !isApiThumbnailHost(row.imageUrl)) continue;
        byId.set(row.targetId, row.imageUrl);
      }

      const items: RobloxAvatarThumb[] = curated
        .map((user) => {
          const live = byId.get(user.userId);
          const imageUrl = live && isApiThumbnailHost(live) ? live : user.fallbackUrl;
          if (!isApiThumbnailHost(imageUrl)) return null;
          return { userId: user.userId, name: user.name, imageUrl };
        })
        .filter((x): x is RobloxAvatarThumb => !!x);

      const resolved = items.length ? items : fallback();
      this.showcaseAvatars.set(resolved);
      this.avatarCacheAt = Date.now();
      return resolved.slice(0, limit);
    } catch {
      const resolved = this.showcaseAvatars().length ? this.showcaseAvatars().slice(0, limit) : fallback();
      this.showcaseAvatars.set(resolved);
      this.avatarCacheAt = Date.now();
      return resolved;
    }
  }

  private async fetchThumbsJson(
    endpoint: string,
  ): Promise<{ data?: Array<{ targetId?: number; imageUrl?: string; state?: string }> }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Roblox thumbs HTTP ${response.status}`);
      }
      return (await response.json()) as {
        data?: Array<{ targetId?: number; imageUrl?: string; state?: string }>;
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
