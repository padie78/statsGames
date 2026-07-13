import {
  Component,
  HostListener,
  OnInit,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';
import { defaultHomeRouteForRole } from '../../core/auth/user-role';
import { GameContextService } from '../../core/game/game-context.service';
import {
  GAME_PLATFORM_LIST,
  gamePlatformMeta,
} from '../../core/game/game-platform.config';
import type { SelectedGame } from '../../core/game/selected-game';
import { HOME_FEATURES, HOME_STATS } from '../../data/home.data';
import { MOCK_LEADERBOARD, MOCK_TICKER } from '../../data/dashboard-mock.data';
import { coachTipsForPlatform } from '../../data/coach-video-tips.data';
import { FortniteOfficialMediaService } from '../../services/fortnite-official-media.service';
import { RobloxExperiencesService } from '../../services/roblox-experiences.service';
import {
  LeaderboardMiniComponent,
  LiveTickerComponent,
  NeonBadgeComponent,
  OfficialNewsRailComponent,
  RobloxExperiencesRailComponent,
  YoutubeTipCardComponent,
} from '../../ui';

@Component({
  standalone: true,
  selector: 'app-home-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    RouterLink,
    IonContent,
    NeonBadgeComponent,
    LiveTickerComponent,
    LeaderboardMiniComponent,
    OfficialNewsRailComponent,
    RobloxExperiencesRailComponent,
    YoutubeTipCardComponent,
  ],
  template: `
    <ion-content class="sg-home-content">
      <div class="sg-home">
        <header class="sg-home-header">
          <a routerLink="/" class="sg-home-header__brand">
            <span class="sg-home-header__logo">SG</span>
            <span class="sg-home-header__name">StatsGames</span>
          </a>

          <nav class="sg-home-header__nav" aria-label="Principal">
            <a href="#features" class="sg-home-header__link">Features</a>
            <a href="#platforms" class="sg-home-header__link">Juegos</a>
            <a href="#media" class="sg-home-header__link">Media</a>
            <a href="#leaderboard" class="sg-home-header__link">Leaderboard</a>
          </nav>

          <div class="sg-home-header__actions sg-home-header__actions--desktop">
            @if (isAuthenticated()) {
              <button type="button" class="u-btn u-btn--primary" (click)="focusGamePicker()">
                Elegí tu juego
              </button>
            } @else {
              <a routerLink="/login" class="u-btn u-btn--ghost">Ingresar</a>
              <a routerLink="/register" class="u-btn u-btn--primary">Empezar gratis</a>
            }
          </div>

          <button
            type="button"
            class="sg-home-header__menu-btn"
            [class.sg-home-header__menu-btn--open]="mobileMenuOpen()"
            [attr.aria-expanded]="mobileMenuOpen()"
            aria-controls="sg-home-mobile-panel"
            aria-label="Abrir menú"
            (click)="toggleMobileMenu()"
          >
            <span class="sg-topbar__menu-icon" aria-hidden="true"></span>
          </button>
        </header>

        @if (mobileMenuOpen()) {
          <button
            type="button"
            class="sg-home-header__backdrop"
            aria-label="Cerrar menú"
            (click)="closeMobileMenu()"
          ></button>
        }

        <div
          id="sg-home-mobile-panel"
          class="sg-home-header__mobile-panel"
          [class.sg-home-header__mobile-panel--open]="mobileMenuOpen()"
        >
          <nav class="sg-home-header__mobile-nav" aria-label="Principal móvil">
            <a href="#features" class="sg-home-header__mobile-link" (click)="closeMobileMenu()">Features</a>
            <a href="#platforms" class="sg-home-header__mobile-link" (click)="closeMobileMenu()">Juegos</a>
            <a href="#media" class="sg-home-header__mobile-link" (click)="closeMobileMenu()">Media</a>
            <a href="#leaderboard" class="sg-home-header__mobile-link" (click)="closeMobileMenu()">Leaderboard</a>
          </nav>

          <div class="sg-home-header__mobile-actions">
            @if (isAuthenticated()) {
              <button
                type="button"
                class="u-btn u-btn--primary"
                (click)="focusGamePicker(); closeMobileMenu()"
              >
                Elegí tu juego
              </button>
            } @else {
              <a routerLink="/register" class="u-btn u-btn--primary" (click)="closeMobileMenu()">Empezar gratis</a>
              <a routerLink="/login" class="u-btn u-btn--ghost" (click)="closeMobileMenu()">Ingresar</a>
            }
          </div>
        </div>

        <div class="sg-home-ticker">
          <sg-live-ticker [items]="tickerItems" [live]="true" />
        </div>

        <section class="sg-home-hero">
          <div class="sg-home-hero__copy">
            <sg-neon-badge tone="muted">Multi-juego · AI Coach</sg-neon-badge>
            <h1 class="sg-home-hero__title">
              Stats, partidas y coach<br />
              <span class="sg-home-hero__accent">en todos tus títulos</span>
            </h1>
            <p class="sg-home-hero__subtitle">
              Valorant, League of Legends, CS2, Rocket League, Fortnite y Roblox (Blox Fruits,
              Adopt Me!, Brookhaven). Un gamer tag. Switcher por juego. Analytics en vivo.
            </p>

            <div class="sg-home-hero__cta">
              @if (isAuthenticated()) {
                <button
                  type="button"
                  class="u-btn u-btn--primary u-btn--lg"
                  (click)="focusGamePicker()"
                >
                  Elegí tu juego
                </button>
                @if (activeGameLabel(); as label) {
                  <button
                    type="button"
                    class="u-btn u-btn--ghost u-btn--lg"
                    [disabled]="entering()"
                    (click)="enterPortal(activeGame()!)"
                  >
                    Continuar en {{ label }}
                  </button>
                }
              } @else {
                <a routerLink="/register" class="u-btn u-btn--primary u-btn--lg">Crear cuenta</a>
                <a routerLink="/login" class="u-btn u-btn--ghost u-btn--lg">Ya tengo cuenta</a>
              }
            </div>

            @if (isAuthenticated()) {
              <p class="sg-home-hero__pick-hint">
                Tocá una carta para abrir el portal de ese juego.
              </p>
            } @else {
              <p class="sg-home-hero__pick-hint">
                Tocá un juego para crear tu cuenta y entrar a ese portal.
              </p>
            }

            @if (enterError()) {
              <p class="u-error u-mt-3">{{ enterError() }}</p>
            }

            <div class="sg-home-hero__stats">
              @for (stat of homeStats; track stat.label) {
                <div class="sg-home-hero__stat">
                  <span class="sg-home-hero__stat-value">{{ stat.value }}</span>
                  <span class="sg-home-hero__stat-label">{{ stat.label }}</span>
                </div>
              }
            </div>
          </div>

          <div
            id="game-pick"
            class="sg-home-hero__visual"
            [class.sg-home-hero__visual--pulse]="pickerPulse()"
          >
            <div class="sg-home-hero__picker" role="list" aria-label="Elegí un juego">
              @for (platform of platforms; track platform.id) {
                <button
                  type="button"
                  class="sg-home-hero__card"
                  role="listitem"
                  [class.sg-home-hero__card--active]="activeGame() === platform.id"
                  [attr.data-game]="platform.id"
                  [attr.aria-label]="
                    (isAuthenticated() ? 'Abrir portal de ' : 'Empezar con ') + platform.label
                  "
                  [disabled]="entering()"
                  (click)="pickGame(platform.id)"
                >
                  <img
                    class="sg-home-hero__card-art"
                    [src]="platform.portraitUrl"
                    [attr.data-fallback]="platform.portraitFallbackUrl"
                    alt=""
                    width="160"
                    height="240"
                    loading="lazy"
                    (error)="onPortraitError($event)"
                  />
                  <span class="sg-home-hero__card-caption">{{ platform.label }}</span>
                </button>
              }
            </div>
          </div>
        </section>
        <section id="features" class="sg-home-section">
          <header class="sg-home-section__header">
            <h2 class="sg-home-section__title">Herramientas para subir de rank</h2>
            <p class="sg-home-section__subtitle">
              Feed live, historial, perfiles públicos y AI Coach — todo filtrado por el juego
              que tengas activo en el switcher.
            </p>
          </header>

          <div class="sg-home-features">
            @for (feature of features; track feature.id) {
              <article class="sg-home-feature u-surface-card">
                <span class="sg-home-feature__icon" [class]="'sg-home-feature__icon--' + feature.tone">
                  {{ feature.icon }}
                </span>
                <h3 class="sg-home-feature__title">{{ feature.title }}</h3>
                <p class="sg-home-feature__desc">{{ feature.description }}</p>
              </article>
            }
          </div>
        </section>

        <section id="platforms" class="sg-home-section sg-home-platforms">
          <header class="sg-home-section__header">
            <h2 class="sg-home-section__title">Ocho títulos. Un hub.</h2>
            <p class="sg-home-section__subtitle">
              Tocá un título para entrar a su portal. Dashboard, partidas y coach se adaptan a ese juego.
            </p>
          </header>

          <div class="sg-home-platforms__grid">
            @for (platform of platforms; track platform.id) {
              <button
                type="button"
                class="sg-home-platforms__item sg-home-platforms__item--action"
                [attr.data-game]="platform.id"
                [disabled]="entering()"
                (click)="pickGame(platform.id)"
              >
                <img
                  class="sg-home-platforms__icon"
                  [src]="platform.iconUrl"
                  [alt]=""
                  width="40"
                  height="40"
                />
                <div class="sg-home-platforms__copy">
                  <h3 class="sg-home-platforms__name">{{ platform.label }}</h3>
                  <p class="sg-home-platforms__tagline">{{ platform.tagline }}</p>
                </div>
              </button>
            }
          </div>
        </section>
        <section id="media" class="sg-home-section sg-home-media">
          <header class="sg-home-section__header">
            <h2 class="sg-home-section__title">Media oficial</h2>
            <p class="sg-home-section__subtitle">
              News Fortnite, experiences Roblox y trailers oficiales vía API / YouTube —
              sin scrapear wikis.
            </p>
          </header>

          <div class="sg-home-media__grid">
            <sg-official-news-rail
              [items]="fortniteNews()"
              [bannerUrl]="fortniteNewsBanner()"
              [loading]="fortniteMediaLoading()"
            />
            <div class="u-flex u-flex-col u-gap-5">
              <sg-roblox-experiences-rail
                [items]="robloxExperiences()"
                [loading]="robloxMediaLoading()"
              />
              @if (homeTrailer(); as tip) {
                <sg-youtube-tip-card
                  [videoId]="tip.videoId"
                  [title]="tip.title"
                  [subtitle]="tip.subtitle"
                  [creatorName]="tip.creatorName"
                  badgeLabel="Oficial"
                />
              }
            </div>
          </div>
        </section>

        <section id="leaderboard" class="sg-home-section sg-home-leaderboard-wrap">
          <div class="sg-home-leaderboard__copy">
            <sg-neon-badge tone="muted">Community</sg-neon-badge>
            <h2 class="sg-home-section__title">Leaderboard de la comunidad</h2>
            <p class="sg-home-section__subtitle u-mb-4">
              Ranking por título. Perfiles públicos, búsqueda por gamer tag y stats para
              compartir.
            </p>
            <a routerLink="/player/NeoFragger" class="u-btn u-btn--ghost">Ver perfil de ejemplo</a>
          </div>
          <sg-leaderboard-mini title="Top players" [entries]="leaderboard" />
        </section>

        <section class="sg-home-cta u-surface-card">
          <div class="sg-home-cta__glow" aria-hidden="true"></div>
          <div class="sg-home-cta__content">
            <h2 class="sg-home-cta__title">¿Listo para la próxima ranked?</h2>
            <p class="sg-home-cta__subtitle">
              Primero elegí el juego. Después vinculá Riot, Steam, Epic o Roblox y abrí
              dashboard, historial y AI Coach.
            </p>
            <div class="sg-home-cta__actions">
              @if (isAuthenticated()) {
                <button
                  type="button"
                  class="u-btn u-btn--primary u-btn--lg"
                  (click)="focusGamePicker()"
                >
                  Elegí tu juego
                </button>
                <a routerLink="/tabs/integrations" class="u-btn u-btn--ghost u-btn--lg">Conectar cuentas</a>
              } @else {
                <a routerLink="/register" class="u-btn u-btn--primary u-btn--lg">Crear cuenta gratis</a>
                <a routerLink="/login" class="u-btn u-btn--ghost u-btn--lg">Ingresar</a>
              }
            </div>
          </div>
        </section>

        <footer class="sg-home-footer">
          <span class="sg-home-footer__brand">StatsGames</span>
          <span class="sg-home-footer__meta">8 títulos · analytics en vivo · AWS Serverless</span>
        </footer>
      </div>
    </ion-content>
  `,
})
export class HomePageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
  private readonly router = inject(Router);
  private readonly fortniteOfficial = inject(FortniteOfficialMediaService);
  private readonly robloxExperiencesSvc = inject(RobloxExperiencesService);

  readonly platforms = GAME_PLATFORM_LIST;
  readonly features = HOME_FEATURES;
  readonly homeStats = HOME_STATS;
  readonly leaderboard = MOCK_LEADERBOARD;
  readonly tickerItems = MOCK_TICKER;
  readonly mobileMenuOpen = signal(false);
  readonly pickerPulse = signal(false);
  readonly entering = signal(false);
  readonly enterError = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());
  readonly activeGame = computed(() => this.auth.selectedGame());
  readonly activeGameLabel = computed(() => {
    const game = this.activeGame();
    return game ? gamePlatformMeta(game).label : null;
  });
  readonly fortniteNews = computed(() => this.fortniteOfficial.news().slice(0, 4));
  readonly fortniteNewsBanner = computed(() => this.fortniteOfficial.newsBannerUrl());
  readonly fortniteMediaLoading = computed(() => this.fortniteOfficial.loading());
  readonly robloxExperiences = computed(() => this.robloxExperiencesSvc.items());
  readonly robloxMediaLoading = computed(() => this.robloxExperiencesSvc.loading());
  readonly homeTrailer = computed(() => coachTipsForPlatform('fortnite')[0] ?? null);

  constructor() {
    effect(() => {
      document.body.classList.toggle('sg-nav-lock', this.mobileMenuOpen());
    });
  }

  ngOnInit(): void {
    void this.fortniteOfficial.hydrate({ newsLimit: 6, featuredLimit: 4 });
    void this.robloxExperiencesSvc.load(8);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMobileMenu();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  focusGamePicker(): void {
    this.enterError.set(null);
    this.pickerPulse.set(true);
    document.getElementById('game-pick')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => this.pickerPulse.set(false), 1200);
  }

  async pickGame(game: SelectedGame): Promise<void> {
    if (this.entering()) return;

    if (!this.isAuthenticated()) {
      await this.router.navigate(['/register'], { queryParams: { game } });
      return;
    }

    await this.enterPortal(game);
  }

  async enterPortal(game: SelectedGame): Promise<void> {
    if (this.entering()) return;

    this.entering.set(true);
    this.enterError.set(null);

    try {
      await this.gameContext.switchPlatform(game);
      const role = this.auth.userRole();
      await this.router.navigateByUrl(defaultHomeRouteForRole(role));
    } catch (err) {
      this.enterError.set(
        err instanceof Error ? err.message : 'No se pudo abrir el portal de ese juego',
      );
    } finally {
      this.entering.set(false);
    }
  }

  onPortraitError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = img.getAttribute('data-fallback');
    if (fallback && img.src !== fallback) {
      img.src = fallback;
    }
  }
}
