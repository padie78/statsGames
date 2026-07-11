/**
 * Media oficial Fortnite: news MOTD, mapa y outfits featured.
 * Prefer media proxy; fallback directo a fortnite-api.com.
 */
import { Injectable, inject, signal } from '@angular/core';
import { isApiThumbnailHost } from '../core/media';
import { environment } from '../../environments/environment';
import { FortniteCosmeticsService, type FortniteCosmeticThumb } from './fortnite-cosmetics.service';

export interface FortniteNewsMotd {
  id: string;
  title: string;
  tabTitle?: string;
  imageUrl: string;
  tileImageUrl?: string;
}

export interface FortniteMapMedia {
  blankUrl: string;
  poisUrl: string;
}

@Injectable({ providedIn: 'root' })
export class FortniteOfficialMediaService {
  private readonly cosmetics = inject(FortniteCosmeticsService);

  readonly news = signal<FortniteNewsMotd[]>([]);
  /** Banner animado del feed news (GIF oficial vía fortnite-api CDN). */
  readonly newsBannerUrl = signal<string | null>(null);
  readonly map = signal<FortniteMapMedia | null>(null);
  readonly featuredOutfits = signal<FortniteCosmeticThumb[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private newsCacheAt = 0;
  private mapCacheAt = 0;
  private featuredCacheAt = 0;
  private readonly ttlMs = 30 * 60 * 1000;

  async hydrate(options?: { newsLimit?: number; featuredLimit?: number }): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await Promise.all([
        this.loadNews(options?.newsLimit ?? 6),
        this.loadMap(),
        this.loadFeaturedOutfits(options?.featuredLimit ?? 8),
      ]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo cargar media Fortnite');
    } finally {
      this.loading.set(false);
    }
  }

  async loadNews(limit = 6): Promise<FortniteNewsMotd[]> {
    if (this.news().length && Date.now() - this.newsCacheAt < this.ttlMs) {
      return this.news().slice(0, limit);
    }

    const payload = await this.fetchJson<{
      data?: {
        image?: string;
        motds?: Array<{
          id?: string;
          title?: string;
          tabTitle?: string;
          image?: string;
          tileImage?: string;
        }>;
      };
    }>({
      proxyPath: '/media/fortnite/news?language=en',
      upstreamPath: '/v2/news/br?language=en',
    });

    const banner = payload.data?.image;
    this.newsBannerUrl.set(banner && isApiThumbnailHost(banner) ? banner : null);

    const motds: FortniteNewsMotd[] = [];
    for (const item of payload.data?.motds ?? []) {
      const imageUrl = item.image || item.tileImage;
      if (!imageUrl || !isApiThumbnailHost(imageUrl)) continue;
      motds.push({
        id: item.id || imageUrl,
        title: item.title || item.tabTitle || 'Fortnite News',
        tabTitle: item.tabTitle,
        imageUrl,
        tileImageUrl:
          item.tileImage && isApiThumbnailHost(item.tileImage) ? item.tileImage : undefined,
      });
    }

    this.news.set(motds);
    this.newsCacheAt = Date.now();
    return motds.slice(0, limit);
  }

  async loadMap(): Promise<FortniteMapMedia | null> {
    if (this.map() && Date.now() - this.mapCacheAt < this.ttlMs) {
      return this.map();
    }

    const payload = await this.fetchJson<{
      data?: { images?: { blank?: string; pois?: string } };
    }>({
      proxyPath: '/media/fortnite/map',
      upstreamPath: '/v1/map',
    });

    const blankUrl = payload.data?.images?.blank;
    const poisUrl = payload.data?.images?.pois;
    if (!blankUrl || !poisUrl || !isApiThumbnailHost(blankUrl) || !isApiThumbnailHost(poisUrl)) {
      return this.map();
    }

    const media = { blankUrl, poisUrl };
    this.map.set(media);
    this.mapCacheAt = Date.now();
    return media;
  }

  async loadFeaturedOutfits(limit = 8): Promise<FortniteCosmeticThumb[]> {
    if (this.featuredOutfits().length && Date.now() - this.featuredCacheAt < this.ttlMs) {
      return this.featuredOutfits().slice(0, limit);
    }

    const shop = await this.cosmetics.loadFeatured(Math.max(limit * 2, 12));
    const enriched: FortniteCosmeticThumb[] = [];

    for (const item of shop) {
      if (item.type !== 'outfit') continue;
      enriched.push(await this.withFeaturedArt(item));
      if (enriched.length >= limit) break;
    }

    this.featuredOutfits.set(enriched);
    this.featuredCacheAt = Date.now();
    return enriched.slice(0, limit);
  }

  private async withFeaturedArt(item: FortniteCosmeticThumb): Promise<FortniteCosmeticThumb> {
    try {
      const payload = await this.fetchJson<{
        data?: { images?: { featured?: string; icon?: string; smallIcon?: string } };
      }>({
        proxyPath: `/media/fortnite/cosmetics/${encodeURIComponent(item.id)}?language=en`,
        upstreamPath: `/v2/cosmetics/br/${encodeURIComponent(item.id)}?language=en`,
      });
      const featured = payload.data?.images?.featured;
      const icon = payload.data?.images?.icon || payload.data?.images?.smallIcon;
      const iconUrl =
        featured && isApiThumbnailHost(featured)
          ? featured
          : icon && isApiThumbnailHost(icon)
            ? icon
            : item.iconUrl;
      return { ...item, iconUrl };
    } catch {
      return item;
    }
  }

  private proxyBase(): string {
    return (environment.mediaProxyBaseUrl ?? '').replace(/\/+$/, '');
  }

  private async fetchJson<T>(args: { proxyPath: string; upstreamPath: string }): Promise<T> {
    const proxyBase = this.proxyBase();
    if (proxyBase) {
      try {
        const response = await fetch(`${proxyBase}${args.proxyPath}`, {
          method: 'GET',
          mode: 'cors',
        });
        if (response.ok) {
          return (await response.json()) as T;
        }
      } catch {
        // fallback
      }
    }

    const response = await fetch(`https://fortnite-api.com${args.upstreamPath}`, {
      method: 'GET',
      mode: 'cors',
    });
    if (!response.ok) {
      throw new Error(`Fortnite media HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
