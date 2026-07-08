import { Injectable, computed, inject, signal } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { authenticatedAppsyncOptions } from '../core/auth/appsync-auth.util';
import { AuthService } from '../core/auth/auth.service';
import type { MatchUpdateView } from './match.service';

export type RealtimeConnectionState = 'idle' | 'connecting' | 'live' | 'error';

interface OnMatchUpdateMessage {
  data?: { onMatchUpdate?: MatchUpdateView };
}

const ON_MATCH_UPDATE = /* GraphQL */ `
  subscription OnMatchUpdate($userId: ID!) {
    onMatchUpdate(userId: $userId) {
      userId
      matchId
      platform
      summary
      updatedAt
    }
  }
`;

/**
 * Servicio AppSync realtime — Amplify v6 GraphQL subscriptions + Angular Signals.
 * Las páginas consumen `liveMatches` / `isLive` sin suscribirse a RxJS manualmente.
 */
@Injectable({ providedIn: 'root' })
export class AppSyncRealtimeService {
  private readonly auth = inject(AuthService);
  private readonly client = generateClient();

  private readonly _liveMatches = signal<MatchUpdateView[]>([]);
  private readonly _connectionState = signal<RealtimeConnectionState>('idle');
  private readonly _lastError = signal<string | null>(null);

  private handle?: { unsubscribe: () => void };
  private activeUserId: string | null = null;

  readonly liveMatches = computed(() => this._liveMatches());
  readonly connectionState = computed(() => this._connectionState());
  readonly isLive = computed(() => this._connectionState() === 'live');
  readonly lastError = computed(() => this._lastError());
  readonly liveCount = computed(() => this._liveMatches().length);

  /** Top-N heuristic gamificada para el banner Premium (demo). */
  readonly premiumInsight = computed(() => {
    const count = this._liveMatches().length;
    if (count >= 5) {
      return {
        visible: true,
        headline: 'Estás en el Top 10% de tu rango',
        body: 'Desbloqueá el AI Coach para ver por qué tu placement baja en mid-game y qué arma te está costando fights.',
      };
    }
    if (count >= 1) {
      return {
        visible: true,
        headline: 'Racha detectada — impulsá tu rank',
        body: 'Suscribite a Premium y pedile al coach un plan de 7 días basado en tus últimas partidas en vivo.',
      };
    }
    return {
      visible: false,
      headline: '',
      body: '',
    };
  });

  ensureConnected(userId?: string | null): void {
    const id = userId ?? this.auth.userId();
    if (!id) return;
    if (this.handle && this.activeUserId === id) return;

    this.disconnect();
    this.activeUserId = id;
    this._connectionState.set('connecting');
    this._lastError.set(null);

    void authenticatedAppsyncOptions()
      .then((authOptions) => {
        const subscriptionObservable = this.client.graphql({
          query: ON_MATCH_UPDATE,
          variables: { userId: id },
          ...authOptions,
        });

        this.handle = (
          subscriptionObservable as unknown as {
            subscribe: (handlers: {
              next: (msg: OnMatchUpdateMessage) => void;
              error: (e: unknown) => void;
              complete?: () => void;
            }) => { unsubscribe: () => void };
          }
        ).subscribe({
          next: (msg) => {
            this._connectionState.set('live');
            const payload = msg.data?.onMatchUpdate;
            if (!payload) return;
            this._liveMatches.update((current) => [payload, ...current].slice(0, 25));
          },
          error: (err) => {
            this._connectionState.set('error');
            this._lastError.set(err instanceof Error ? err.message : 'Subscription error');
            this.handle = undefined;
          },
          complete: () => {
            this._connectionState.set('idle');
            this.handle = undefined;
          },
        });
      })
      .catch((err) => {
        this._connectionState.set('error');
        this._lastError.set(err instanceof Error ? err.message : 'Auth error');
      });
  }

  seedFromHistory(matches: MatchUpdateView[]): void {
    if (this._liveMatches().length > 0) return;
    this._liveMatches.set(matches.slice(0, 25));
  }

  disconnect(): void {
    this.handle?.unsubscribe();
    this.handle = undefined;
    this.activeUserId = null;
    this._connectionState.set('idle');
  }

  reset(): void {
    this.disconnect();
    this._liveMatches.set([]);
    this._lastError.set(null);
  }
}
