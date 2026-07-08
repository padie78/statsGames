import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { AppSyncRealtimeService } from '../services/appsync-realtime.service';
import { MatchService } from '../services/match.service';

/**
 * Facade del live feed — mantiene compatibilidad con MatchLiveStore previo
 * y delega en AppSyncRealtimeService (Signals).
 */
@Injectable({ providedIn: 'root' })
export class MatchLiveStore {
  private readonly realtime = inject(AppSyncRealtimeService);
  private readonly auth = inject(AuthService);
  private readonly matches = inject(MatchService);

  readonly liveUpdates = computed(() => this.realtime.liveMatches());

  ensureStarted(): void {
    this.realtime.ensureConnected(this.auth.userId());
  }

  reset(): void {
    this.realtime.reset();
  }

  /** @deprecated Preferir AppSyncRealtimeService.seedFromHistory */
  prefetchHistory(userId: string): void {
    this.matches.listPlayerMatches(userId).subscribe({
      next: (rows) => this.realtime.seedFromHistory(rows),
    });
  }
}
