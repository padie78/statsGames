import { Component, EventEmitter, Input, Output, ViewEncapsulation, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { PlayerService, type PlayerSearchHitView } from '../../../services/player.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { GamePlatformSwitcherComponent } from '../../molecules/game-platform-switcher/game-platform-switcher.component';

@Component({
  standalone: true,
  selector: 'sg-app-topbar',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent, GamePlatformSwitcherComponent],
  template: `
    <header class="sg-topbar sg-topbar--global">
      <div class="sg-topbar__left">
        <a routerLink="/tabs/dashboard" class="sg-topbar__brand" aria-label="StatsGames home">
          <span class="sg-topbar__logo">SG</span>
          <span class="sg-topbar__brand-name">StatsGames</span>
        </a>

        <sg-game-platform-switcher />
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
          <sg-neon-badge tone="lime" [pulse]="true">LIVE</sg-neon-badge>
        }
        <div class="sg-topbar__user">
          <span class="sg-topbar__avatar">{{ userInitials() }}</span>
          <div class="sg-topbar__user-meta">
            <span class="sg-topbar__user-email u-truncate">{{ auth.email() ?? 'Gamer' }}</span>
            <span class="sg-topbar__user-role">TRN Edition</span>
          </div>
        </div>
        <button type="button" class="sg-topbar__logout u-btn u-btn--ghost" (click)="logout.emit()">
          Salir
        </button>
      </div>
    </header>
  `,
})
export class AppTopbarComponent {
  readonly auth = inject(AuthService);
  private readonly playerService = inject(PlayerService);
  private readonly router = inject(Router);
  private readonly search$ = new Subject<string>();

  @Input() live = false;
  @Output() readonly logout = new EventEmitter<void>();

  readonly searchQuery = signal('');
  readonly searchResults = signal<PlayerSearchHitView[]>([]);
  readonly searching = signal(false);
  readonly searchOpen = signal(false);

  constructor() {
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
    void this.router.navigate(['/player', hit.gamerTag]);
  }
}
