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
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/game/selected-game';
import { gameHubSearchHint } from '../../../data/game-hub-mock.data';
import { PlayerService, type PlayerSearchHitView } from '../../../services/player.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

/** Buscador de jugadores dentro del panel gráfico (estilo Tracker.gg). */
@Component({
  standalone: true,
  selector: 'sg-week-hero-search',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <div class="sg-dashboard__week-search">
      <label class="sg-dashboard__week-search-field">
        <img
          class="sg-dashboard__week-search-icon"
          [src]="meta().iconUrl"
          alt=""
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
          class="sg-dashboard__week-search-glyph"
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
        <ul class="sg-dashboard__week-search-results" role="listbox">
          @if (searching()) {
            <li class="sg-dashboard__week-search-result sg-dashboard__week-search-result--muted">
              Buscando…
            </li>
          } @else if (showEmpty()) {
            <li class="sg-dashboard__week-search-result sg-dashboard__week-search-result--muted">
              Sin resultados para “{{ query().trim() }}”
            </li>
          } @else {
            @for (hit of results(); track hit.userId) {
              <li>
                <button
                  type="button"
                  class="sg-dashboard__week-search-result"
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
  `,
})
export class WeekHeroSearchComponent {
  private readonly playerService = inject(PlayerService);
  private readonly router = inject(Router);
  private readonly search$ = new Subject<string>();

  readonly platform = input.required<SelectedGame>();

  readonly meta = computed(() => gamePlatformMeta(this.platform()));
  readonly placeholder = computed(() => gameHubSearchHint(this.platform()));

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
    effect(
      () => {
        this.platform();
        this.query.set('');
        this.results.set([]);
        this.open.set(false);
      },
      { allowSignalWrites: true },
    );

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
    if (!target?.closest('.sg-dashboard__week-search')) {
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
