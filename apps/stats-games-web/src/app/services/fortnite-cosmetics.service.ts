/**
 * Fortnite cosmetics / shop imagery.
 * Prefer media proxy (API Gateway) to avoid CORS; fallback a fortnite-api.com.
 */
import { Injectable, signal } from '@angular/core';
import { isApiThumbnailHost } from '../core/media';
import { environment } from '../../environments/environment';

export interface FortniteCosmeticThumb {
  id: string;
  name: string;
  type: string;
  iconUrl: string;
  rarity?: string;
}

interface ShopEntry {
  brItems?: Array<{
    id?: string;
    name?: string;
    type?: { value?: string };
    rarity?: { value?: string };
    images?: { smallIcon?: string; icon?: string; featured?: string };
  }>;
}

@Injectable({ providedIn: 'root' })
export class FortniteCosmeticsService {
  readonly featured = signal<FortniteCosmeticThumb[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly usedProxy = signal(false);

  private cacheAt = 0;
  private readonly cacheTtlMs = 30 * 60 * 1000;
  private byId = new Map<string, FortniteCosmeticThumb>();

  /** Ítems destacados del shop actual (outfits primero). */
  async loadFeatured(limit = 8): Promise<FortniteCosmeticThumb[]> {
    if (this.featured().length && Date.now() - this.cacheAt < this.cacheTtlMs) {
      return this.featured().slice(0, limit);
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const payload = await this.fetchShopJson();
      const thumbs: FortniteCosmeticThumb[] = [];

      for (const entry of payload.data?.entries ?? []) {
        for (const item of entry.brItems ?? []) {
          const iconUrl =
            item.images?.featured || item.images?.icon || item.images?.smallIcon;
          if (!item.id || !iconUrl || !isApiThumbnailHost(iconUrl)) continue;
          const thumb: FortniteCosmeticThumb = {
            id: item.id,
            name: item.name ?? item.id,
            type: item.type?.value ?? 'item',
            iconUrl,
            rarity: item.rarity?.value,
          };
          this.byId.set(thumb.id.toLowerCase(), thumb);
          thumbs.push(thumb);
        }
      }

      const outfits = thumbs.filter((t) => t.type === 'outfit');
      const rest = thumbs.filter((t) => t.type !== 'outfit');
      const ranked = [...outfits, ...rest];
      const unique: FortniteCosmeticThumb[] = [];
      const seen = new Set<string>();
      for (const t of ranked) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        unique.push(t);
      }

      this.featured.set(unique);
      this.cacheAt = Date.now();
      return unique.slice(0, limit);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo cargar el shop');
      return this.featured().slice(0, limit);
    } finally {
      this.loading.set(false);
    }
  }

  async resolveById(cosmeticId: string): Promise<FortniteCosmeticThumb | null> {
    const key = cosmeticId.trim().toLowerCase();
    if (!key) return null;

    const cached = this.byId.get(key);
    if (cached) return cached;

    try {
      const payload = await this.fetchCosmeticJson(cosmeticId);
      const item = payload.data;
      const iconUrl =
        item?.images?.featured || item?.images?.icon || item?.images?.smallIcon;
      if (!item?.id || !iconUrl || !isApiThumbnailHost(iconUrl)) return null;
      const thumb: FortniteCosmeticThumb = {
        id: item.id,
        name: item.name ?? item.id,
        type: item.type?.value ?? 'item',
        iconUrl,
        rarity: item.rarity?.value,
      };
      this.byId.set(thumb.id.toLowerCase(), thumb);
      return thumb;
    } catch {
      return null;
    }
  }

  /**
   * Skin icónica de Fortnite para el collage de login (1 personaje).
   * Solo arte `featured` full-body del CDN — Raven (antes slot derecho).
   */
  async loadLoginStageOutfits(limit = 1): Promise<FortniteCosmeticThumb[]> {
    const iconicIds = [
      'CID_102_Athena_Commando_M_Raven', // Raven — único en login
      'CID_028_Athena_Commando_F', // Renegade Raider (fallback)
      'CID_479_Athena_Commando_F_Davinci', // Glow
      'CID_175_Athena_Commando_M_Celestial', // Galaxy
    ];

    const filled: FortniteCosmeticThumb[] = [];
    const seen = new Set<string>();

    for (const id of iconicIds) {
      if (filled.length >= limit) break;
      if (seen.has(id.toLowerCase())) continue;
      const resolved = await this.resolveById(id);
      if (!resolved?.iconUrl || !/\/featured\./i.test(resolved.iconUrl)) continue;
      seen.add(resolved.id.toLowerCase());
      filled.push(resolved);
    }

    return filled;
  }

  private proxyBase(): string {
    return (environment.mediaProxyBaseUrl ?? '').replace(/\/+$/, '');
  }

  private async fetchShopJson(): Promise<{ data?: { entries?: ShopEntry[] } }> {
    const language = 'en';
    const proxyBase = this.proxyBase();
    if (proxyBase) {
      try {
        const response = await fetch(
          `${proxyBase}/media/fortnite/shop?language=${encodeURIComponent(language)}`,
          { method: 'GET', mode: 'cors' },
        );
        if (response.ok) {
          this.usedProxy.set(true);
          return (await response.json()) as { data?: { entries?: ShopEntry[] } };
        }
      } catch {
        // fallback below
      }
    }

    this.usedProxy.set(false);
    const response = await fetch(
      `https://fortnite-api.com/v2/shop?language=${encodeURIComponent(language)}`,
      { method: 'GET', mode: 'cors' },
    );
    if (!response.ok) {
      throw new Error(`shop HTTP ${response.status}`);
    }
    return (await response.json()) as { data?: { entries?: ShopEntry[] } };
  }

  private async fetchCosmeticJson(cosmeticId: string): Promise<{
    data?: {
      id?: string;
      name?: string;
      type?: { value?: string };
      rarity?: { value?: string };
      images?: { smallIcon?: string; icon?: string; featured?: string };
    };
  }> {
    const language = 'en';
    const proxyBase = this.proxyBase();
    if (proxyBase) {
      try {
        const response = await fetch(
          `${proxyBase}/media/fortnite/cosmetics/${encodeURIComponent(cosmeticId)}?language=${encodeURIComponent(language)}`,
          { method: 'GET', mode: 'cors' },
        );
        if (response.ok) {
          this.usedProxy.set(true);
          return (await response.json()) as {
            data?: {
              id?: string;
              name?: string;
              type?: { value?: string };
              rarity?: { value?: string };
              images?: { smallIcon?: string; icon?: string; featured?: string };
            };
          };
        }
      } catch {
        // fallback
      }
    }

    this.usedProxy.set(false);
    const response = await fetch(
      `https://fortnite-api.com/v2/cosmetics/br/${encodeURIComponent(cosmeticId)}?language=${encodeURIComponent(language)}`,
      { method: 'GET', mode: 'cors' },
    );
    if (!response.ok) return {};
    return (await response.json()) as {
      data?: {
        id?: string;
        name?: string;
        type?: { value?: string };
        rarity?: { value?: string };
        images?: { smallIcon?: string; icon?: string; featured?: string };
      };
    };
  }
}
