import {
  Component,
  HostListener,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import { PlayerService, type PlayerSearchHitView } from '../../../services/player.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

/**
 * Search hero en el body (estilo fortnitetracker.com):
 * “Find your {Game} stats” + input grande.
 */
@Component({
  standalone: true,
  selector: 'sg-player-search-hero',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-player-search" [attr.data-game]="game().id" aria-label="Buscar jugador">
      <div class="sg-player-search__inner">
        <p class="sg-player-search__eyebrow">Find your</p>
        <h2 class="sg-player-search__title">{{ game().label }} stats</h2>
        <p class="sg-player-search__hint">
          Search by gamertag or account ID
        </p>

        <div class="sg-player-search__field-wrap">
          <label class="sg-player-search__field">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              type="search"
              [attr.placeholder]="placeholder()"
              [attr.aria-label]="placeholder()"
              [value]="query()"
              (input)="onInput($event)"
              (focus)="open.set(true)"
              autocomplete="off"
            />
          </label>

          @if (open() && (searching() || results().length > 0 || showEmpty())) {
            <ul class="sg-player-search__results" role="listbox">
              @if (searching()) {
                <li class="sg-player-search__result sg-player-search__result--muted">Buscando…</li>
              } @else if (showEmpty()) {
                <li class="sg-player-search__result sg-player-search__result--muted">
                  Sin resultados para “{{ query().trim() }}”
                </li>
              } @else {
                @for (hit of results(); track hit.userId) {
                  <li>
                    <button
                      type="button"
                      class="sg-player-search__result"
                      (click)="goToPlayer(hit)"
                    >
                      <span>{{ hit.gamerTag }}</span>
                      <sg-neon-badge tone="muted">{{ hit.primaryPlatform }}</sg-neon-badge>
                    </button>
                  </li>
                }
              }
            </ul>
          }
        </div>
      </div>
    </section>
  `,
})
export class PlayerSearchHeroComponent {
  private readonly auth = inject(AuthService);
  private readonly playerService = inject(PlayerService);
  private readonly router = inject(Router);
  private readonly search$ = new Subject<string>();

  readonly game = computed(() => {
    const id = this.auth.selectedGame();
    return id ? gamePlatformMeta(id) : gamePlatformMeta('fortnite');
  });
  readonly placeholder = computed(() => `Search ${this.game().label} Tracker…`);

  readonly query = signal('');
  readonly results = signal<PlayerSearchHitView[]>([]);
  readonly searching = signal(false);
  readonly open = signal(false);
  readonly showEmpty = computed(
    () => !this.searching() && this.query().trim().length >= 2 && this.results().length === 0 && this.open(),
  );

  constructor() {
    effect(() => {
      this.auth.selectedGame();
      this.query.set('');
      this.results.set([]);
      this.open.set(false);
    });

    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => {
          if (value.trim().length < 2) {
            this.searching.set(false);
            return of([]);
          }
          this.searching.set(true);
          return this.playerService.searchPlayers(value.trim(), 8);
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (hits) => {
          this.results.set(hits);
          this.searching.set(false);
        },
        error: () => {
          this.results.set([]);
          this.searching.set(false);
        },
      });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.sg-player-search__field-wrap')) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.open.set(true);
    this.search$.next(value);
  }

  goToPlayer(hit: PlayerSearchHitView): void {
    this.open.set(false);
    this.query.set('');
    this.results.set([]);
    void this.router.navigate(['/player', hit.gamerTag]);
  }
}
