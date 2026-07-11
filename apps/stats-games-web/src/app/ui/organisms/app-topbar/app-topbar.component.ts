import {
  Component,
  EventEmitter,
  HostListener,
  Output,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, of, switchMap, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserPreferencesService } from '../../../core/preferences/user-preferences.service';
import { AuthService } from '../../../core/services/auth.service';
import { PlayerService, type PlayerSearchHitView } from '../../../services/player.service';
import { APP_ACCOUNT_MENU_ITEMS } from '../../../core/navigation/app-nav.config';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { NotificationsBellComponent } from '../../molecules/notifications-bell/notifications-bell.component';

/**
 * Línea 2 del chrome TRN:
 * Search —— User actions
 */
@Component({
  standalone: true,
  selector: 'sg-app-topbar',
  encapsulation: ViewEncapsulation.None,
  imports: [
    RouterLink,
    RouterLinkActive,
    NeonBadgeComponent,
    NotificationsBellComponent,
  ],
  template: `
    <header class="sg-topbar sg-topbar--trn">
      <div class="sg-topbar__inner">
        <div class="sg-topbar__center sg-topbar__search-wrap">
          <label class="sg-topbar__search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              type="search"
              placeholder="Search for a player…"
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              (focus)="searchOpen.set(true)"
              autocomplete="off"
            />
          </label>

          @if (searchOpen() && (searching() || searchResults().length > 0)) {
            <ul class="sg-topbar__search-results" role="listbox">
              @if (searching()) {
                <li class="sg-topbar__search-item sg-topbar__search-item--muted">Buscando…</li>
              }
              @for (hit of searchResults(); track hit.userId) {
                <li>
                  <button
                    type="button"
                    class="sg-topbar__search-item"
                    (click)="goToPlayer(hit)"
                  >
                    <span>{{ hit.gamerTag }}</span>
                    <sg-neon-badge tone="muted">{{ hit.primaryPlatform }}</sg-neon-badge>
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        <div class="sg-topbar__right">
          <sg-notifications-bell />

          <div class="sg-topbar__account" [class.sg-topbar__account--open]="accountMenuOpen()">
            <button
              type="button"
              class="sg-topbar__account-trigger"
              [attr.aria-expanded]="accountMenuOpen()"
              aria-haspopup="true"
              aria-controls="sg-topbar-account-menu"
              aria-label="Menú de cuenta"
              (click)="toggleAccountMenu($event)"
            >
              <span class="sg-topbar__avatar">{{ userInitials() }}</span>
              <span class="sg-topbar__account-meta">
                <span class="sg-topbar__user-email u-truncate">
                  {{ gamerTag() || auth.email() || 'Gamer' }}
                </span>
                <span class="sg-topbar__user-role">Cuenta</span>
              </span>
              <span class="sg-topbar__account-caret" aria-hidden="true"></span>
            </button>

            @if (accountMenuOpen()) {
              <div
                id="sg-topbar-account-menu"
                class="sg-topbar__account-menu"
                role="menu"
                aria-label="Cuenta"
              >
                <div class="sg-topbar__account-head">
                  <span class="sg-topbar__avatar">{{ userInitials() }}</span>
                  <div class="sg-topbar__user-meta">
                    <span class="sg-topbar__user-email u-truncate">
                      {{ gamerTag() || auth.email() || 'Gamer' }}
                    </span>
                    <span class="sg-topbar__user-role">Pro</span>
                  </div>
                </div>

                @if (profileRoute(); as profilePath) {
                  <a
                    class="sg-topbar__account-item"
                    role="menuitem"
                    [routerLink]="profilePath"
                    (click)="closeAccountMenu()"
                  >
                    Mi perfil
                  </a>
                }
                @for (item of accountMenuItems; track item.id) {
                  <a
                    class="sg-topbar__account-item"
                    role="menuitem"
                    [routerLink]="item.route"
                    (click)="closeAccountMenu()"
                  >
                    {{ item.label }}
                  </a>
                }
                <button
                  type="button"
                  class="sg-topbar__account-item sg-topbar__account-item--danger"
                  role="menuitem"
                  (click)="onAccountLogout()"
                >
                  Salir
                </button>
              </div>
            }
          </div>

          <button
            type="button"
            class="sg-topbar__menu-btn"
            [class.sg-topbar__menu-btn--open]="mobileMenuOpen()"
            [attr.aria-expanded]="mobileMenuOpen()"
            aria-controls="sg-topbar-mobile-panel"
            aria-label="Abrir menú de navegación"
            (click)="toggleMobileMenu()"
          >
            <span class="sg-topbar__menu-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>

      @if (mobileMenuOpen()) {
        <button
          type="button"
          class="sg-topbar__backdrop"
          aria-label="Cerrar menú"
          (click)="closeMobileMenu()"
        ></button>
      }

      <div
        id="sg-topbar-mobile-panel"
        class="sg-topbar__mobile-panel"
        [class.sg-topbar__mobile-panel--open]="mobileMenuOpen()"
      >
        <div class="sg-topbar__mobile-section">
          <label class="sg-topbar__search sg-topbar__search--mobile">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              type="search"
              placeholder="Search for a player…"
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              (focus)="searchOpen.set(true)"
              autocomplete="off"
            />
          </label>

          @if (searchOpen() && (searching() || searchResults().length > 0)) {
            <ul class="sg-topbar__search-results sg-topbar__search-results--mobile" role="listbox">
              @if (searching()) {
                <li class="sg-topbar__search-item sg-topbar__search-item--muted">Buscando…</li>
              }
              @for (hit of searchResults(); track hit.userId) {
                <li>
                  <button
                    type="button"
                    class="sg-topbar__search-item"
                    (click)="goToPlayer(hit)"
                  >
                    <span>{{ hit.gamerTag }}</span>
                    <sg-neon-badge tone="muted">{{ hit.primaryPlatform }}</sg-neon-badge>
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        <nav class="sg-topbar__mobile-nav" aria-label="Secciones">
          @for (item of navItems(); track item.id) {
            <a
              class="sg-topbar__mobile-link"
              [routerLink]="item.route"
              routerLinkActive="sg-topbar__mobile-link--active"
              [routerLinkActiveOptions]="{ exact: true }"
              (click)="closeMobileMenu()"
            >
              <span>{{ item.label }}</span>
              @if (item.badge) {
                <sg-neon-badge [tone]="item.tone === 'purple' ? 'purple' : 'lime'">{{ item.badge }}</sg-neon-badge>
              }
            </a>
          }
        </nav>

        <div class="sg-topbar__mobile-footer">
          @if (profileRoute(); as profilePath) {
            <a
              class="sg-topbar__mobile-link"
              [routerLink]="profilePath"
              (click)="closeMobileMenu()"
            >
              Mi perfil
            </a>
          }
          @for (item of accountMenuItems; track item.id) {
            <a
              class="sg-topbar__mobile-link"
              [routerLink]="item.route"
              (click)="closeMobileMenu()"
            >
              {{ item.label }}
            </a>
          }
          <button type="button" class="u-btn u-btn--ghost sg-topbar__mobile-logout" (click)="onMobileLogout()">
            Salir
          </button>
        </div>
      </div>
    </header>
  `,
})
export class AppTopbarComponent {
  readonly auth = inject(AuthService);
  readonly prefs = inject(UserPreferencesService);
  private readonly playerService = inject(PlayerService);
  private readonly router = inject(Router);
  private readonly search$ = new Subject<string>();

  @Output() readonly logout = new EventEmitter<void>();

  readonly navItems = this.prefs.visibleNavItems;
  readonly accountMenuItems = APP_ACCOUNT_MENU_ITEMS;
  readonly gamerTag = signal<string | null>(null);
  readonly profileRoute = computed(() => {
    const tag = this.gamerTag();
    return tag ? `/player/${encodeURIComponent(tag)}` : null;
  });
  readonly searchQuery = signal('');
  readonly searchResults = signal<PlayerSearchHitView[]>([]);
  readonly searching = signal(false);
  readonly searchOpen = signal(false);
  readonly mobileMenuOpen = signal(false);
  readonly accountMenuOpen = signal(false);

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      if (userId) this.prefs.load(userId);
    });

    effect(() => {
      const userId = this.auth.userId();
      if (!userId) {
        this.gamerTag.set(null);
        return;
      }
      void this.playerService
        .getPlayerProfileOrNull(userId)
        .then((profile) => this.gamerTag.set(profile?.gamerTag ?? null))
        .catch(() => this.gamerTag.set(null));
    });

    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.trim().length < 2) {
            this.searching.set(false);
            return of([]);
          }
          this.searching.set(true);
          return this.playerService.searchPlayers(query.trim(), 8);
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (hits) => {
          this.searchResults.set(hits);
          this.searching.set(false);
        },
        error: () => {
          this.searchResults.set([]);
          this.searching.set(false);
        },
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.closeMobileMenu();
        this.closeAccountMenu();
      });

    effect(() => {
      document.body.classList.toggle('sg-nav-lock', this.mobileMenuOpen());
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.sg-topbar__account')) {
      this.closeAccountMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMobileMenu();
    this.closeAccountMenu();
  }

  userInitials(): string {
    const tag = this.gamerTag();
    if (tag) return tag.slice(0, 2).toUpperCase();
    const email = this.auth.email();
    if (!email) return 'SG';
    return email.slice(0, 2).toUpperCase();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchOpen.set(true);
    this.search$.next(value);
  }

  goToPlayer(hit: PlayerSearchHitView): void {
    this.searchOpen.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.closeMobileMenu();
    void this.router.navigate(['/player', hit.gamerTag]);
  }

  toggleAccountMenu(event: Event): void {
    event.stopPropagation();
    this.accountMenuOpen.update((open) => !open);
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  onAccountLogout(): void {
    this.closeAccountMenu();
    this.logout.emit();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  onMobileLogout(): void {
    this.closeMobileMenu();
    this.logout.emit();
  }
}
