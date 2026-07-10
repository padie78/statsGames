import { Injectable, signal } from '@angular/core';
import { MEDIA_POLICY } from './media.policy';

@Injectable({ providedIn: 'root' })
export class MediaPlaybackRegistry {
  private readonly activeIds = signal<ReadonlySet<string>>(new Set());

  readonly activeCount = () => this.activeIds().size;

  canRegister(): boolean {
    return this.activeIds().size < MEDIA_POLICY.maxConcurrentVideos;
  }

  register(id: string): boolean {
    const active = this.activeIds();
    if (active.has(id)) return true;
    if (active.size >= MEDIA_POLICY.maxConcurrentVideos) return false;
    this.activeIds.set(new Set([...active, id]));
    return true;
  }

  unregister(id: string): void {
    const active = this.activeIds();
    if (!active.has(id)) return;
    const next = new Set(active);
    next.delete(id);
    this.activeIds.set(next);
  }
}
