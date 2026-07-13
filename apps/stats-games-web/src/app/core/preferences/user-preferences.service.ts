import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { navItemsForRole, type AppSubnavItem } from '../navigation/app-nav.config';

export type StatsDisplayMode = 'simple' | 'advanced';

export interface UserPreferences {
  publicProfileEnabled: boolean;
  appearInSearch: boolean;
  statsMode: StatsDisplayMode;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  publicProfileEnabled: true,
  appearInSearch: true,
  statsMode: 'advanced',
};

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly auth = inject(AuthService);
  private readonly prefs = signal<UserPreferences>({ ...DEFAULT_PREFERENCES });
  private loadedForUserId: string | null = null;

  readonly publicProfileEnabled = computed(() => this.prefs().publicProfileEnabled);
  readonly appearInSearch = computed(() => this.prefs().appearInSearch);
  readonly statsMode = computed(() => this.prefs().statsMode);

  /** Nav del portal activo según rol (player | scout). */
  readonly visibleNavItems = computed((): AppSubnavItem[] =>
    navItemsForRole(this.auth.userRole()),
  );

  load(userId: string): void {
    if (this.loadedForUserId === userId) return;

    this.loadedForUserId = userId;
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) {
      this.prefs.set({ ...DEFAULT_PREFERENCES });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<UserPreferences>;
      this.prefs.set({
        ...DEFAULT_PREFERENCES,
        ...parsed,
      });
    } catch {
      this.prefs.set({ ...DEFAULT_PREFERENCES });
    }
  }

  update(userId: string, patch: Partial<UserPreferences>): void {
    this.load(userId);
    const next = { ...this.prefs(), ...patch };
    this.prefs.set(next);
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  }

  reset(userId: string): void {
    this.prefs.set({ ...DEFAULT_PREFERENCES });
    localStorage.removeItem(storageKey(userId));
    this.loadedForUserId = userId;
  }
}

function storageKey(userId: string): string {
  return `sg-user-prefs:${userId}`;
}
