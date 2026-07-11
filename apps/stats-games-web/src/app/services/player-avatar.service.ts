import { Injectable, signal } from '@angular/core';
import { isApiThumbnailHost, isOwnAssetUrl } from '../core/media';

export interface AvatarSource {
  avatarUrl?: string | null;
  robloxId?: string | null;
  gamerTag?: string | null;
}

/**
 * Avatar del jugador — solo fuentes permitidas (media-ip-policy):
 * - avatarUrl guardado (CDN/API allowlist u own asset)
 * - Roblox Thumbnails API → imageUrl en tr.rbxcdn.com
 */
@Injectable({ providedIn: 'root' })
export class PlayerAvatarService {
  readonly url = signal<string | null>(null);
  readonly fullBodyUrl = signal<string | null>(null);
  readonly loading = signal(false);

  private lastKey = '';
  private lastFullBodyId = '';

  async resolve(source: AvatarSource): Promise<string | null> {
    const key = `${source.avatarUrl ?? ''}|${source.robloxId ?? ''}`;
    if (key === this.lastKey && this.url()) {
      return this.url();
    }
    this.lastKey = key;
    this.loading.set(true);

    try {
      const stored = source.avatarUrl?.trim();
      if (stored && this.isSafeAvatarUrl(stored)) {
        this.url.set(stored);
        return stored;
      }

      const robloxId = source.robloxId?.trim();
      if (!robloxId || !/^\d+$/.test(robloxId)) {
        this.url.set(null);
        return null;
      }

      const fromApi = await this.fetchRobloxThumb(robloxId, 'avatar-headshot', '150x150');
      this.url.set(fromApi);
      return fromApi;
    } finally {
      this.loading.set(false);
    }
  }

  /** Render 3D completo (≤420px) — solo jugador conectado. */
  async resolveFullBody(robloxId: string | null | undefined): Promise<string | null> {
    const id = robloxId?.trim() ?? '';
    if (!id || !/^\d+$/.test(id)) {
      this.fullBodyUrl.set(null);
      return null;
    }
    if (id === this.lastFullBodyId && this.fullBodyUrl()) {
      return this.fullBodyUrl();
    }
    this.lastFullBodyId = id;
    const url = await this.fetchRobloxThumb(id, 'avatar', '420x420');
    this.fullBodyUrl.set(url);
    return url;
  }

  clear(): void {
    this.lastKey = '';
    this.lastFullBodyId = '';
    this.url.set(null);
    this.fullBodyUrl.set(null);
  }

  private isSafeAvatarUrl(url: string): boolean {
    if (isOwnAssetUrl(url)) return true;
    if (isApiThumbnailHost(url)) return true;
    return false;
  }

  private async fetchRobloxThumb(
    userId: string,
    kind: 'avatar-headshot' | 'avatar',
    size: string,
  ): Promise<string | null> {
    try {
      const endpoint =
        `https://thumbnails.roblox.com/v1/users/${kind}` +
        `?userIds=${encodeURIComponent(userId)}&size=${size}&format=Png&isCircular=false`;
      const response = await fetch(endpoint, { method: 'GET', mode: 'cors' });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        data?: Array<{ imageUrl?: string; state?: string }>;
      };
      const imageUrl = payload.data?.[0]?.imageUrl?.trim();
      if (!imageUrl || !this.isSafeAvatarUrl(imageUrl)) return null;
      return imageUrl;
    } catch {
      return null;
    }
  }
}
