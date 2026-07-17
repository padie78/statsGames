import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { AppSyncRealtimeService } from '../services/appsync-realtime.service';
import { MatchAiService, type MatchAiReadyView } from '../services/match-ai.service';
import type { MatchUpdateView } from '../services/match.service';

export type MatchAiStatus = 'pending' | 'ready' | 'failed';

export interface MatchNotification {
  id: string;
  matchId: string;
  platform: string;
  summary: string;
  updatedAt: string;
  stats?: MatchUpdateView['stats'];
  aiStatus: MatchAiStatus;
  /** Texto corto cuando la IA terminó. */
  aiHeadline: string;
  read: boolean;
  createdAt: string;
  match: MatchUpdateView;
}

const FALLBACK_AI_DELAY_MS = 90_000;
const MAX_ITEMS = 30;

/**
 * Inbox de partidas en vivo.
 * - onMatchUpdate → notificación con IA pendiente.
 * - onMatchAiReady (Bedrock) → IA ready / failed.
 * - Fallback timeout solo si no llega el evento (p.ej. plataforma sin pipeline IA).
 */
@Injectable({ providedIn: 'root' })
export class MatchNotificationsStore {
  private readonly realtime = inject(AppSyncRealtimeService);
  private readonly matchAi = inject(MatchAiService);
  private readonly auth = inject(AuthService);

  private readonly _items = signal<MatchNotification[]>([]);
  private readonly _panelOpen = signal(false);
  private readonly _toast = signal<MatchNotification | null>(null);
  private readonly seenIds = new Set<string>();
  private readonly aiTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private aiReadySub: Subscription | null = null;
  private lastAiUserId: string | null = null;

  readonly items = computed(() => this._items());
  readonly panelOpen = computed(() => this._panelOpen());
  readonly toast = computed(() => this._toast());
  readonly unreadCount = computed(
    () => this._items().filter((item) => !item.read).length,
  );
  readonly pendingAiCount = computed(
    () => this._items().filter((item) => item.aiStatus === 'pending').length,
  );

  constructor() {
    effect(
      () => {
        const matches = this.realtime.liveMatches();
        for (const match of [...matches].reverse()) {
          this.ingestLiveMatch(match);
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const userId = this.auth.userId();
        this.ensureAiReadySubscription(userId);
      },
      { allowSignalWrites: true },
    );
  }

  togglePanel(): void {
    this._panelOpen.update((open) => !open);
  }

  openPanel(): void {
    this._panelOpen.set(true);
  }

  closePanel(): void {
    this._panelOpen.set(false);
  }

  dismissToast(): void {
    this._toast.set(null);
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = null;
  }

  markRead(id: string): void {
    this._items.update((items) =>
      items.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }

  markAllRead(): void {
    this._items.update((items) => items.map((item) => ({ ...item, read: true })));
  }

  getByMatchId(matchId: string): MatchNotification | undefined {
    return this._items().find((item) => item.matchId === matchId);
  }

  /** La ficha se puede abrir siempre; la IA enriquece el detalle cuando esté lista. */
  canOpenMatch(id: string): boolean {
    return this._items().some((n) => n.id === id);
  }

  /** Demo / tests: empuja una partida como si viniera de AppSync. */
  pushDemoMatch(partial?: Partial<MatchUpdateView>): void {
    const matchId = partial?.matchId ?? `demo-${Date.now()}`;
    const match: MatchUpdateView = {
      userId: partial?.userId ?? 'demo',
      matchId,
      platform: partial?.platform ?? 'fortnite',
      summary: partial?.summary ?? 'Partida en vivo · análisis IA pendiente',
      updatedAt: partial?.updatedAt ?? new Date().toISOString(),
      stats: partial?.stats ?? { kills: 7, deaths: 2, placement: 4, assists: 1 },
    };
    this.ingestLiveMatch(match);
  }

  reset(): void {
    for (const timer of this.aiTimers.values()) clearTimeout(timer);
    this.aiTimers.clear();
    this.seenIds.clear();
    this.dismissToast();
    this.aiReadySub?.unsubscribe();
    this.aiReadySub = null;
    this.lastAiUserId = null;
    this._items.set([]);
    this._panelOpen.set(false);
  }

  markAiReadyFromEvent(event: MatchAiReadyView): void {
    const id = `match-${event.matchId}`;
    const existingTimer = this.aiTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.aiTimers.delete(id);
    }

    const status: MatchAiStatus = event.status === 'failed' ? 'failed' : 'ready';
    const headline =
      event.headline?.trim() ||
      (status === 'failed' ? 'Análisis IA no disponible' : 'Análisis listo');

    this._items.update((items) => {
      const found = items.some((item) => item.matchId === event.matchId);
      if (!found) {
        return [
          {
            id,
            matchId: event.matchId,
            platform: event.platform,
            summary: event.summary || headline,
            updatedAt: event.createdAt,
            aiStatus: status,
            aiHeadline: headline,
            read: false,
            createdAt: new Date().toISOString(),
            match: {
              userId: event.userId,
              matchId: event.matchId,
              platform: event.platform,
              summary: event.summary || headline,
              updatedAt: event.createdAt,
            },
          },
          ...items,
        ].slice(0, MAX_ITEMS);
      }

      return items.map((item) =>
        item.matchId === event.matchId
          ? {
              ...item,
              aiStatus: status,
              aiHeadline: headline,
              summary: item.summary,
            }
          : item,
      );
    });

    const updated = this._items().find((item) => item.matchId === event.matchId);
    if (updated) this.showToast(updated);
  }

  private ensureAiReadySubscription(userId: string | null): void {
    if (!userId) {
      this.aiReadySub?.unsubscribe();
      this.aiReadySub = null;
      this.lastAiUserId = null;
      return;
    }
    if (this.aiReadySub && this.lastAiUserId === userId) return;

    this.aiReadySub?.unsubscribe();
    this.lastAiUserId = userId;
    this.aiReadySub = this.matchAi.onMatchAiReady(userId).subscribe({
      next: (event) => this.markAiReadyFromEvent(event),
      error: () => {
        this.aiReadySub = null;
        this.lastAiUserId = null;
      },
    });
  }

  private ingestLiveMatch(match: MatchUpdateView): void {
    if (!match.matchId || this.seenIds.has(match.matchId)) return;
    this.seenIds.add(match.matchId);

    const notification: MatchNotification = {
      id: `match-${match.matchId}`,
      matchId: match.matchId,
      platform: match.platform,
      summary: match.summary || `${match.platform} · nueva partida`,
      updatedAt: match.updatedAt,
      stats: match.stats,
      aiStatus: 'pending',
      aiHeadline: 'La IA está analizando esta partida…',
      read: false,
      createdAt: new Date().toISOString(),
      match,
    };

    this._items.update((items) => [notification, ...items].slice(0, MAX_ITEMS));
    this.showToast(notification);
    this.scheduleAiFallback(notification.id, match);
  }

  private scheduleAiFallback(id: string, match: MatchUpdateView): void {
    const existing = this.aiTimers.get(id);
    if (existing) clearTimeout(existing);

    // Solo fallback local si no llega Bedrock (otras plataformas / demo).
    const timer = setTimeout(() => {
      this.aiTimers.delete(id);
      const current = this._items().find((item) => item.id === id);
      if (!current || current.aiStatus !== 'pending') return;

      const headline = buildAiHeadline(match);
      this._items.update((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                aiStatus: 'ready' as const,
                aiHeadline: headline,
              }
            : item,
        ),
      );

      const updated = this._items().find((item) => item.id === id);
      if (updated && this._toast()?.id === id) {
        this.showToast(updated);
      }
    }, FALLBACK_AI_DELAY_MS);

    this.aiTimers.set(id, timer);
  }

  private showToast(notification: MatchNotification): void {
    this._toast.set(notification);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      if (this._toast()?.id === notification.id) {
        this._toast.set(null);
      }
      this.toastTimer = null;
    }, 6500);
  }
}

function buildAiHeadline(match: MatchUpdateView): string {
  const kills = match.stats?.kills ?? 0;
  const placement = match.stats?.placement;
  if (match.stats?.won === true) return `Victoria · ${kills} kills — análisis listo`;
  if (placement === 1) return `Victoria · ${kills} kills — análisis listo`;
  if (placement != null && placement <= 5) {
    return `Top ${placement} · ${kills} kills — análisis listo`;
  }
  return `Análisis listo · ${kills} kills`;
}
