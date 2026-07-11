import { Injectable, inject, signal } from '@angular/core';
import { gamePlatformMeta } from '../core/game/game-platform.config';
import type { SelectedGame } from '../core/services/auth.service';
import { FortniteCosmeticsService, type FortniteCosmeticThumb } from './fortnite-cosmetics.service';
import { PlayerAvatarService } from './player-avatar.service';

/**
 * Orquesta media dinámica permitida:
 * - Avatar Roblox (API)
 * - Cosméticos Fortnite (fortnite-api.com)
 * - Fallback a arte propio / press opcional
 */
@Injectable({ providedIn: 'root' })
export class PlatformMediaService {
  private readonly avatars = inject(PlayerAvatarService);
  private readonly fortnite = inject(FortniteCosmeticsService);

  readonly fortniteFeatured = signal<FortniteCosmeticThumb[]>([]);
  readonly loading = signal(false);

  async hydrateForPlatform(platform: SelectedGame): Promise<void> {
    this.loading.set(true);
    try {
      if (platform === 'fortnite') {
        const featured = await this.fortnite.loadFeatured(10);
        this.fortniteFeatured.set(featured);
      } else {
        this.fortniteFeatured.set([]);
      }
    } finally {
      this.loading.set(false);
    }
  }

  resolveHeroArt(platform: SelectedGame): string {
    const meta = gamePlatformMeta(platform);
    return meta.pressBannerUrl || meta.artUrl;
  }

  resolvePlayerAvatar(source: {
    avatarUrl?: string | null;
    robloxId?: string | null;
  }): Promise<string | null> {
    return this.avatars.resolve(source);
  }

  resolveRobloxFullBody(robloxId: string | null | undefined): Promise<string | null> {
    return this.avatars.resolveFullBody(robloxId);
  }

  cosmeticIcon(cosmeticId: string): Promise<FortniteCosmeticThumb | null> {
    return this.fortnite.resolveById(cosmeticId);
  }
}
