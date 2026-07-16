import { DecimalPipe } from '@angular/common';
import {
  Component,
  HostListener,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import {
  gameHubMeta,
  gameHubSearchHint,
  gameHubSubtitle,
} from '../../../data/game-hub-mock.data';
import type { MatchUpdateView } from '../../../services/match.service';
import { PlayerService, type PlayerSearchHitView } from '../../../services/player.service';
import { pickBestMatchesForHub } from '../../../utils/hub-best-matches.util';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

/**
 * Hub del dashboard: arte del juego + buscador grande + mejores partidas del usuario.
 */
@Component({
  standalone: true,
  selector: 'sg-player-search-hero',
  encapsulation: ViewEncapsulation.None,
  imports: [DecimalPipe, NeonBadgeComponent, RouterLink],
  template: `
    <section class="sg-game-hub" [attr.data-game]="game().id" aria-label="Hub del juego">
      <div class="sg-game-hub__stage">
        <div
          class="sg-game-hub__art"
          [style.background-image]="'url(' + artUrl() + ')'"
          role="presentation"
        ></div>
        <div class="sg-game-hub__veil" aria-hidden="true"></div>

        <div class="sg-game-hub__panel">
          <div class="sg-game-hub__copy">
            <p class="sg-game-hub__eyebrow">{{ game().badge }}</p>
            <h1 class="sg-game-hub__title">{{ game().label }} Stats</h1>
            <p class="sg-game-hub__subtitle">{{ subtitle() }}</p>

            <div class="sg-game-hub__field-wrap">
              <label class="sg-game-hub__field">
                <img
                  class="sg-game-hub__field-icon"
                  [src]="game().iconUrl"
                  [alt]=""
                  width="22"
                  height="22"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  [attr.placeholder]="placeholder()"
                  [attr.aria-label]="placeholder()"
                  [value]="query()"
                  (input)="onInput($event)"
                  (focus)="open.set(true)"
                  autocomplete="off"
                />
                <svg
                  class="sg-game-hub__search-glyph"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </label>

              @if (open() && (searching() || results().length > 0 || showEmpty())) {
                <ul class="sg-game-hub__results" role="listbox">
                  @if (searching()) {
                    <li class="sg-game-hub__result sg-game-hub__result--muted">Buscando…</li>
                  } @else if (showEmpty()) {
                    <li class="sg-game-hub__result sg-game-hub__result--muted">
                      Sin resultados para “{{ query().trim() }}”
                    </li>
                  } @else {
                    @for (hit of results(); track hit.userId) {
                      <li>
                        <button
                          type="button"
                          class="sg-game-hub__result"
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

          <aside class="sg-game-hub__rail" aria-label="Tus mejores partidas">
            @if (bestMatches().length > 0) {
              @for (match of bestMatches(); track match.matchId) {
                <a
                  class="sg-game-hub__card"
                  [class.sg-game-hub__card--win]="match.won"
                  [routerLink]="match.route"
                >
                  <span class="sg-game-hub__card-badge">{{ match.reason }}</span>
                  <span class="sg-game-hub__card-subject">{{ match.subject }}</span>
                  <span class="sg-game-hub__card-context">{{ match.context }}</span>
                  <span class="sg-game-hub__card-metric-label">{{ match.primary.label }}</span>
                  <span class="sg-game-hub__card-metric">{{ match.primary.value }}</span>
                  <span class="sg-game-hub__card-secondary">
                    {{ match.secondary.label }} {{ match.secondary.value }}
                  </span>
                  <span class="sg-game-hub__card-cta">Ver partida</span>
                </a>
              }
            } @else {
              <div class="sg-game-hub__empty">
                Todavía no hay partidas destacadas. Jugá una sesión y van a aparecer acá.
                <a routerLink="/tabs/matches">Ir a Partidas</a>
              </div>
            }
          </aside>
        </div>
      </div>

      @if (metaPreview().length > 0) {
        <div class="sg-game-hub__meta">
          <div class="sg-game-hub__meta-inner">
            <div class="sg-game-hub__meta-head">
              <h2 class="sg-game-hub__meta-title">{{ meta().title }}</h2>
              <p class="sg-game-hub__meta-desc">{{ meta().description }}</p>
            </div>
            <div class="sg-game-hub__meta-grid" role="list">
              @for (entity of metaPreview(); track entity.id) {
                <article class="sg-game-hub__entity" role="listitem">
                  @if (entity.imageUrl) {
                    <img
                      class="sg-game-hub__entity-art"
                      [src]="entity.imageUrl"
                      [alt]="entity.name"
                      width="44"
                      height="44"
                      loading="lazy"
                    />
                  } @else {
                    <span class="sg-game-hub__entity-fallback" aria-hidden="true">
                      {{ initials(entity.name) }}
                    </span>
                  }
                  <div class="sg-game-hub__entity-copy">
                    <h3 class="sg-game-hub__entity-name">{{ entity.name }}</h3>
                    <p class="sg-game-hub__entity-role">{{ entity.role }}</p>
                  </div>
                  <div class="sg-game-hub__entity-stats">
                    <span><strong>{{ entity.winRate | number: '1.0-1' }}%</strong> WR</span>
                    <span><strong>{{ entity.pickRate | number: '1.0-1' }}%</strong> Pick</span>
                  </div>
                </article>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class PlayerSearchHeroComponent {
  private readonly auth = inject(AuthService);
  private readonly playerService = inject(PlayerService);
  private readonly router = inject(Router);
  private readonly search$ = new Subject<string>();

  /** Partidas recientes del usuario (ya filtradas por plataforma en el dashboard). */
  readonly matches = input<MatchUpdateView[]>([]);

  readonly game = computed(() => {
    const id = this.auth.selectedGame();
    return id ? gamePlatformMeta(id) : gamePlatformMeta('fortnite');
  });
  readonly artUrl = computed(() => this.game().portraitUrl || this.game().artUrl);
  readonly subtitle = computed(() => gameHubSubtitle(this.game().id));
  readonly placeholder = computed(() => gameHubSearchHint(this.game().id));
  readonly bestMatches = computed(() =>
    pickBestMatchesForHub(this.matches(), this.game().id, 3),
  );
  readonly meta = computed(() => gameHubMeta(this.game().id));
  readonly metaPreview = computed(() => this.meta().entities.slice(0, 6));

  readonly query = signal('');
  readonly results = signal<PlayerSearchHitView[]>([]);
  readonly searching = signal(false);
  readonly open = signal(false);
  readonly showEmpty = computed(
    () =>
      !this.searching() &&
      this.query().trim().length >= 2 &&
      this.results().length === 0 &&
      this.open(),
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
    if (!target?.closest('.sg-game-hub__field-wrap')) {
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

  initials(value: string): string {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return value.slice(0, 2).toUpperCase();
  }
}
