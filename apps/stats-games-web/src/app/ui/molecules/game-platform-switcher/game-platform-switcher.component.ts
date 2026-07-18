import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  ViewChild,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, type SelectedGame } from '../../../core/services/auth.service';
import { GameContextService } from '../../../core/game/game-context.service';
import {
  GAME_PLATFORM_LIST,
  type GamePlatformMeta,
} from '../../../core/game/game-platform.config';
import { ChromeAccountComponent } from '../chrome-account/chrome-account.component';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell.component';

/**
 * Línea 1 del chrome (estilo OP.GG):
 * Logo + juegos | notificaciones + cuenta (derecha).
 */
@Component({
  standalone: true,
  selector: 'sg-game-platform-switcher',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NotificationsBellComponent, ChromeAccountComponent],
  template: `
    <nav
      class="sg-games-bar"
      aria-label="Seleccionar juego"
      [class.sg-games-bar--loading]="gameContext.switching()"
    >
      <div class="sg-games-bar__inner">
        <a routerLink="/" class="sg-games-bar__brand" aria-label="StatsGames home">
          <span class="sg-games-bar__brand-body">
            <span class="sg-games-bar__logo">SG</span>
            <span class="sg-games-bar__brand-name">StatsGames</span>
          </span>
        </a>

        <div class="sg-games-bar__games" #gameHost role="tablist" aria-label="Juegos">
          @for (platform of visiblePlatforms(); track platform.id) {
            <button
              type="button"
              role="tab"
              class="sg-games-bar__item"
              [class.sg-games-bar__item--active]="isCurrentGame(platform.id)"
              [attr.data-game]="platform.id"
              [attr.aria-selected]="isCurrentGame(platform.id)"
              [attr.aria-current]="isCurrentGame(platform.id) ? 'page' : null"
              [attr.title]="platform.label"
              [attr.aria-label]="platform.label"
              [disabled]="gameContext.switching() || isCurrentGame(platform.id)"
              (click)="select(platform.id)"
            >
              <span class="sg-games-bar__item-body">
                <img
                  class="sg-games-bar__icon"
                  [src]="platform.iconUrl"
                  [alt]=""
                  width="26"
                  height="26"
                  aria-hidden="true"
                />
                <span class="sg-games-bar__name">{{ platform.label }}</span>
              </span>
            </button>
          }

          @if (overflowPlatforms().length > 0) {
            <div
              class="sg-games-bar__more"
              [class.sg-games-bar__more--open]="moreOpen()"
            >
              <button
                type="button"
                class="sg-games-bar__more-btn"
                [attr.aria-expanded]="moreOpen()"
                aria-haspopup="true"
                aria-controls="sg-games-bar-more-menu"
                [attr.aria-label]="'Más juegos (' + overflowPlatforms().length + ')'"
                [disabled]="gameContext.switching()"
                (click)="toggleMore($event)"
              >
                <span class="sg-games-bar__item-body">
                  <span class="sg-games-bar__more-label">Más</span>
                  <span class="sg-games-bar__more-count">{{ overflowPlatforms().length }}</span>
                </span>
              </button>

              @if (moreOpen()) {
                <ul
                  id="sg-games-bar-more-menu"
                  class="sg-games-bar__more-menu"
                  role="listbox"
                  aria-label="Juegos restantes"
                >
                  @for (platform of overflowPlatforms(); track platform.id) {
                    <li role="none">
                      <button
                        type="button"
                        role="option"
                        class="sg-games-bar__more-item"
                        [class.sg-games-bar__more-item--active]="isCurrentGame(platform.id)"
                        [attr.aria-selected]="isCurrentGame(platform.id)"
                        [disabled]="gameContext.switching() || isCurrentGame(platform.id)"
                        (click)="selectFromMore(platform.id)"
                      >
                        <img
                          class="sg-games-bar__icon"
                          [src]="platform.iconUrl"
                          [alt]=""
                          width="22"
                          height="22"
                          aria-hidden="true"
                        />
                        <span>{{ platform.label }}</span>
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </div>

        <div class="sg-games-bar__end">
          <sg-notifications-bell />
          <sg-chrome-account (logout)="logout.emit()" />
        </div>
      </div>

      <div class="sg-games-bar__measure" aria-hidden="true" #measureHost>
        @for (platform of platforms; track platform.id) {
          <button type="button" class="sg-games-bar__item" tabindex="-1">
            <span class="sg-games-bar__item-body">
              <img class="sg-games-bar__icon" [src]="platform.iconUrl" alt="" width="26" height="26" />
              <span class="sg-games-bar__name">{{ platform.label }}</span>
            </span>
          </button>
        }
        <button type="button" class="sg-games-bar__more-btn" tabindex="-1">
          <span class="sg-games-bar__item-body">
            <span class="sg-games-bar__more-label">Más</span>
            <span class="sg-games-bar__more-count">9</span>
          </span>
        </button>
      </div>
    </nav>
  `,
})
export class GamePlatformSwitcherComponent implements AfterViewInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly gameContext = inject(GameContextService);
  readonly platforms = GAME_PLATFORM_LIST;

  @Output() readonly logout = new EventEmitter<void>();

  @ViewChild('gameHost') private readonly gamesHost?: ElementRef<HTMLElement>;
  @ViewChild('measureHost') private readonly measureHost?: ElementRef<HTMLElement>;

  readonly moreOpen = signal(false);
  readonly visibleCount = signal(GAME_PLATFORM_LIST.length);

  readonly visiblePlatforms = computed(() => {
    const { visible } = this.splitPlatforms(this.visibleCount());
    return visible;
  });

  readonly overflowPlatforms = computed(() => {
    const { overflow } = this.splitPlatforms(this.visibleCount());
    return overflow;
  });

  private resizeObserver: ResizeObserver | null = null;
  private rafId = 0;

  constructor() {
    effect(() => {
      this.auth.selectedGame();
      this.queueRecalc();
    });
  }

  ngAfterViewInit(): void {
    const host = this.gamesHost?.nativeElement;
    if (host && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.queueRecalc());
      this.resizeObserver.observe(host);
    }
    this.queueRecalc();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.queueRecalc();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.sg-games-bar__more')) {
      this.moreOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.moreOpen.set(false);
  }

  isCurrentGame(game: SelectedGame): boolean {
    return this.auth.selectedGame() === game;
  }

  select(game: SelectedGame): void {
    if (this.isCurrentGame(game) || this.gameContext.switching()) return;
    void this.gameContext.switchPlatform(game);
  }

  selectFromMore(game: SelectedGame): void {
    this.moreOpen.set(false);
    this.select(game);
  }

  toggleMore(event: Event): void {
    event.stopPropagation();
    this.moreOpen.update((open) => !open);
  }

  private splitPlatforms(count: number): {
    visible: GamePlatformMeta[];
    overflow: GamePlatformMeta[];
  } {
    const selected = this.auth.selectedGame();
    const list = this.platforms;
    const capped = Math.max(1, Math.min(count, list.length));

    if (capped >= list.length) {
      return { visible: list, overflow: [] };
    }

    const selectedIdx = Math.max(
      0,
      list.findIndex((p) => p.id === selected),
    );

    const visibleIdx = new Set<number>();
    visibleIdx.add(selectedIdx);

    for (let i = 0; i < list.length && visibleIdx.size < capped; i++) {
      visibleIdx.add(i);
    }

    const visible = list.filter((_, i) => visibleIdx.has(i));
    const overflow = list.filter((_, i) => !visibleIdx.has(i));
    return { visible, overflow };
  }

  private queueRecalc(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.recalculate();
    });
  }

  private recalculate(): void {
    const host = this.gamesHost?.nativeElement;
    const measure = this.measureHost?.nativeElement;
    if (!host || !measure) return;

    const available = host.clientWidth;
    if (available <= 0) return;

    const items = Array.from(
      measure.querySelectorAll<HTMLElement>(':scope > .sg-games-bar__item'),
    );
    const moreBtn = measure.querySelector<HTMLElement>(':scope > .sg-games-bar__more-btn');
    if (!items.length) return;

    const widths = items.map((el) => el.getBoundingClientRect().width);
    const gap = 2.4;
    const moreWidth = (moreBtn?.getBoundingClientRect().width ?? 72) + gap;

    const totalAll = widths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0);
    if (totalAll <= available + 0.5) {
      this.visibleCount.set(this.platforms.length);
      return;
    }

    const budget = available - moreWidth;
    let best = 1;

    for (let count = 1; count < this.platforms.length; count++) {
      const { visible } = this.splitPlatforms(count);
      let used = 0;
      visible.forEach((platform, i) => {
        const idx = this.platforms.findIndex((p) => p.id === platform.id);
        used += widths[idx] + (i > 0 ? gap : 0);
      });
      if (used <= budget + 0.5) {
        best = count;
      } else {
        break;
      }
    }

    this.visibleCount.set(best);
  }
}
