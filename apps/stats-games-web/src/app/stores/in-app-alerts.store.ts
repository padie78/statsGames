/**
 * Alertas de producto (forma, sync, rank) — conviven con el inbox de partidas.
 * Dedup via sessionStorage para no spamear en cada reload.
 */

import { Injectable, computed, signal } from '@angular/core';

export type InAppAlertKind =
  | 'forma_down'
  | 'sync_stale'
  | 'rank_up'
  | 'rank_down'
  | 'report_ready';

export interface InAppAlert {
  id: string;
  kind: InAppAlertKind;
  title: string;
  body: string;
  route: string;
  read: boolean;
  createdAt: string;
}

const MAX_ITEMS = 20;
const TOAST_MS = 7000;
const DEDUP_PREFIX = 'sg.alert.dedup.';

@Injectable({ providedIn: 'root' })
export class InAppAlertsStore {
  private readonly _items = signal<InAppAlert[]>([]);
  private readonly _toast = signal<InAppAlert | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly items = computed(() => this._items());
  readonly toast = computed(() => this._toast());
  readonly unreadCount = computed(() => this._items().filter((a) => !a.read).length);

  /**
   * Empuja alerta si no se mostró la misma key en esta sesión (o TTL).
   * `dedupKey` ej. `forma_down:2026-W12` / `rank_down:42`.
   */
  push(input: {
    kind: InAppAlertKind;
    title: string;
    body: string;
    route: string;
    dedupKey: string;
  }): boolean {
    if (this.wasSeen(input.dedupKey)) return false;

    const alert: InAppAlert = {
      id: `${input.kind}-${Date.now()}`,
      kind: input.kind,
      title: input.title,
      body: input.body,
      route: input.route,
      read: false,
      createdAt: new Date().toISOString(),
    };

    this.markSeen(input.dedupKey);
    this._items.update((items) => [alert, ...items].slice(0, MAX_ITEMS));
    this.showToast(alert);
    return true;
  }

  dismissToast(): void {
    this._toast.set(null);
    if (this.toastTimer) clearTimeout(this.toastTimer);
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

  private showToast(alert: InAppAlert): void {
    this._toast.set(alert);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      if (this._toast()?.id === alert.id) this._toast.set(null);
      this.toastTimer = null;
    }, TOAST_MS);
  }

  private wasSeen(key: string): boolean {
    try {
      return sessionStorage.getItem(DEDUP_PREFIX + key) === '1';
    } catch {
      return false;
    }
  }

  private markSeen(key: string): void {
    try {
      sessionStorage.setItem(DEDUP_PREFIX + key, '1');
    } catch {
      /* ignore */
    }
  }
}
