import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewEncapsulation,
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
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { GamePlatformSwitcherComponent } from '../../molecules/game-platform-switcher/game-platform-switcher.component';

@Component({
  standalone: true,
  selector: 'sg-app-topbar',
  encapsulation: ViewEncapsulation.None,
  imports: [
    RouterLink,
    RouterLinkActive,
    NeonBadgeComponent,
    GamePlatformSwitcherComponent,
  ],
  template: `
    <header class="sg-topbar sg-topbar--global">
      <div class="sg-topbar__inner">
        <div class="sg-topbar__left">
          <a routerLink="/" class="sg-topbar__brand" aria-label="StatsGames home">
            <span class="sg-topbar__logo">SG</span>
            <span class="sg-topbar__brand-name">StatsGames</span>
          </a>

          <sg-game-platform-switcher class="sg-topbar__platform-switch" />
        </div>

        <div class="sg-topbar__center sg-topbar__search-wrap">
          <label class="sg-topbar__search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              type="search"
              placeholder="Buscar jugador…"
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
          @if (live) {
            <sg-neon-badge tone="cyan" [pulse]="true" class="sg-topbar__live-badge">Live</sg-neon-badge>
          }
          <div class="sg-topbar__user sg-topbar__user--desktop">
            <span class="sg-topbar__avatar">{{ userInitials() }}</span>
            <div class="sg-topbar__user-meta">
              <span class="sg-topbar__user-email u-truncate">{{ auth.email() ?? 'Gamer' }}</span>
              <span class="sg-topbar__user-role">Pro</span>
            </div>
          </div>
          <button
            type="button"
            class="sg-topbar__logout u-btn u-btn--ghost sg-topbar__logout--desktop"
            (click)="logout.emit()"
          >
            Salir
          </button>

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
              placeholder="Buscar jugador…"
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

        <div class="sg-topbar__mobile-section">
          <p class="sg-topbar__mobile-label">Plataforma</p>
          <sg-game-platform-switcher class="sg-platform-switch--mobile-menu" />
        </div>

        <nav class="sg-topbar__mobile-nav" aria-label="Secciones">
          @for (item of navItems(); track item.id) {
            <a
              class="sg-topbar__mobile-link"
              [routerLink]="item.route"
              routerLinkActive="sg-topbar__mobile-link--active"
              [routerLinkActiveOptions]="{ exact: true }"
              [class.sg-topbar__mobile-link--lime]="item.tone === 'lime'"
              [class.sg-topbar__mobile-link--purple]="item.tone === 'purple'"
              [class.sg-topbar__mobile-link--cyan]="item.tone === 'cyan'"
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
          <div class="sg-topbar__user sg-topbar__user--mobile">
            <span class="sg-topbar__avatar">{{ userInitials() }}</span>
            <div class="sg-topbar__user-meta">
              <span class="sg-topbar__user-email u-truncate">{{ auth.email() ?? 'Gamer' }}</span>
              <span class="sg-topbar__user-role">Pro</span>
            </div>
          </div>
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

  @Input() live = false;
  @Output() readonly logout = new EventEmitter<void>();

  readonly navItems = this.prefs.visibleNavItems;
  readonly searchQuery = signal('');
  readonly searchResults = signal<PlayerSearchHitView[]>([]);
  readonly searching = signal(false);
  readonly searchOpen = signal(false);
  readonly mobileMenuOpen = signal(false);

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      if (userId) this.prefs.load(userId);
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
      .subscribe(() => this.closeMobileMenu());

    effect(() => {
      document.body.classList.toggle('sg-nav-lock', this.mobileMenuOpen());
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMobileMenu();
  }

  userInitials(): string {
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
