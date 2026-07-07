import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { MatchService, type MatchUpdateView } from '../services/match.service';

@Injectable({ providedIn: 'root' })
export class MatchLiveStore {
  private readonly auth = inject(AuthService);
  private readonly matches = inject(MatchService);

  private readonly _liveUpdates = signal<MatchUpdateView[]>([]);
  private subscription?: Subscription;

  readonly liveUpdates = computed(() => this._liveUpdates());

  ensureStarted(): void {
    if (this.subscription) return;
    const userId = this.auth.userId();
    if (!userId) return;

    this.subscription = this.matches.onMatchUpdate(userId).subscribe({
      next: (update) => {
        this._liveUpdates.update((current) => [update, ...current].slice(0, 20));
      },
      error: (err) => {
        console.error('[MatchLiveStore] subscription error', err);
        this.reset();
      },
    });
  }

  reset(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this._liveUpdates.set([]);
  }
}
