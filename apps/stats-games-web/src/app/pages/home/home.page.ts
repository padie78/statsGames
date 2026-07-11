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
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';
import { GAME_PLATFORM_LIST } from '../../core/game/game-platform.config';
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
            <a href="#platforms" class="sg-home-header__link">Plataformas</a>
            <a href="#media" class="sg-home-header__link">Media</a>
            <a href="#leaderboard" class="sg-home-header__link">Leaderboard</a>
          </nav>

          <div class="sg-home-header__actions sg-home-header__actions--desktop">
            @if (isAuthenticated()) {
              <a routerLink="/tabs/dashboard" class="u-btn u-btn--primary">Ir al dashboard</a>
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
            <a href="#platforms" class="sg-home-header__mobile-link" (click)="closeMobileMenu()">Plataformas</a>
            <a href="#media" class="sg-home-header__mobile-link" (click)="closeMobileMenu()">Media</a>
            <a href="#leaderboard" class="sg-home-header__mobile-link" (click)="closeMobileMenu()">Leaderboard</a>
          </nav>

          <div class="sg-home-header__mobile-actions">
            @if (isAuthenticated()) {
              <a routerLink="/tabs/dashboard" class="u-btn u-btn--primary" (click)="closeMobileMenu()">Ir al dashboard</a>
              <a routerLink="/tabs/matches" class="u-btn u-btn--ghost" (click)="closeMobileMenu()">Ver partidas</a>
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
            <sg-neon-badge tone="muted">Gaming analytics</sg-neon-badge>
            <h1 class="sg-home-hero__title">
              El companion definitivo<br />
              <span class="sg-home-hero__accent">para gamers competitivos</span>
            </h1>
            <p class="sg-home-hero__subtitle">
              Telemetría en vivo, estadísticas avanzadas y coaching inteligente para
              Fortnite y Roblox. Un solo perfil, dos arenas.
            </p>

            <div class="sg-home-hero__cta">
              @if (isAuthenticated()) {
                <a routerLink="/tabs/dashboard" class="u-btn u-btn--primary u-btn--lg">Abrir dashboard</a>
                <a routerLink="/tabs/matches" class="u-btn u-btn--ghost u-btn--lg">Ver partidas</a>
              } @else {
                <a routerLink="/register" class="u-btn u-btn--primary u-btn--lg">Crear cuenta</a>
                <a routerLink="/login" class="u-btn u-btn--ghost u-btn--lg">Ya tengo cuenta</a>
              }
            </div>

            <div class="sg-home-hero__stats">
              @for (stat of homeStats; track stat.label) {
                <div class="sg-home-hero__stat">
                  <span class="sg-home-hero__stat-value">{{ stat.value }}</span>
                  <span class="sg-home-hero__stat-label">{{ stat.label }}</span>
                </div>
              }
            </div>
          </div>

          <div class="sg-home-hero__visual" aria-hidden="true">
            @for (platform of platforms; track platform.id) {
              <article
                class="sg-home-hero__platform-card"
                [class.sg-home-hero__platform-card--roblox]="platform.id === 'roblox'"
                [class.sg-home-hero__platform-card--fortnite]="platform.id === 'fortnite'"
              >
                <img class="sg-home-hero__platform-art" [src]="platform.artUrl" [alt]="platform.label" />
                <div class="sg-home-hero__platform-overlay"></div>
                <div class="sg-home-hero__platform-body">
                  <img class="sg-home-hero__platform-icon" [src]="platform.iconUrl" [alt]="platform.label" />
                  <span class="sg-home-hero__platform-name">{{ platform.label }}</span>
                  <span class="sg-home-hero__platform-hint">{{ platform.statsHint }}</span>
                </div>
              </article>
            }
          </div>
        </section>

        <section id="features" class="sg-home-section">
          <header class="sg-home-section__header">
            <h2 class="sg-home-section__title">Todo lo que necesitás para subir de nivel</h2>
            <p class="sg-home-section__subtitle">
              Paridad TRN con feed en vivo, perfiles públicos, historial de partidas y analytics por plataforma.
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
            <h2 class="sg-home-section__title">Dos plataformas, un perfil</h2>
            <p class="sg-home-section__subtitle">
              Cambiá entre Roblox y Fortnite desde el topbar. Stats, partidas y dashboard se adaptan al contexto activo.
            </p>
          </header>

          <div class="sg-home-platforms__grid">
            @for (platform of platforms; track platform.id) {
              <article
                class="sg-home-platforms__card"
                [class.sg-home-platforms__card--roblox]="platform.id === 'roblox'"
                [class.sg-home-platforms__card--fortnite]="platform.id === 'fortnite'"
              >
                <img class="sg-home-platforms__art" [src]="platform.artUrl" [alt]="platform.label" />
                <div class="sg-home-platforms__overlay"></div>
                <div class="sg-home-platforms__body">
                  <img class="sg-home-platforms__icon" [src]="platform.iconUrl" [alt]="platform.label" />
                  <div>
                    <h3 class="sg-home-platforms__name">{{ platform.label }}</h3>
                    <p class="sg-home-platforms__badge">{{ platform.badge }}</p>
                    <p class="sg-home-platforms__tagline">{{ platform.tagline }}</p>
                  </div>
                </div>
              </article>
            }
          </div>
        </section>

        <section id="media" class="sg-home-section sg-home-media">
          <header class="sg-home-section__header">
            <h2 class="sg-home-section__title">Media oficial</h2>
            <p class="sg-home-section__subtitle">
              News MOTD, icons de experiences y trailers oficiales vía APIs / YouTube — sin scrapear wikis.
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
            <h2 class="sg-home-section__title">Leaderboard global</h2>
            <p class="sg-home-section__subtitle u-mb-4">
              Mirá quién lidera la comunidad. Perfiles públicos, búsqueda por gamer tag y stats compartibles.
            </p>
            <a routerLink="/player/NeoFragger" class="u-btn u-btn--ghost">Ver perfil de ejemplo</a>
          </div>
          <sg-leaderboard-mini title="Top players" [entries]="leaderboard" />
        </section>

        <section class="sg-home-cta u-surface-card">
          <div class="sg-home-cta__glow" aria-hidden="true"></div>
          <div class="sg-home-cta__content">
            <h2 class="sg-home-cta__title">Listo para trackear tu próxima partida?</h2>
            <p class="sg-home-cta__subtitle">
              Conectá Fortnite o Roblox, cargá mock data para probar, y desbloqueá el dashboard completo.
            </p>
            <div class="sg-home-cta__actions">
              @if (isAuthenticated()) {
                <a routerLink="/tabs/dashboard" class="u-btn u-btn--primary u-btn--lg">Ir al dashboard</a>
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
          <span class="sg-home-footer__meta">Fortnite + Roblox Analytics · AWS Serverless</span>
        </footer>
      </div>
    </ion-content>
  `,
})
export class HomePageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly fortniteOfficial = inject(FortniteOfficialMediaService);
  private readonly robloxExperiencesSvc = inject(RobloxExperiencesService);

  readonly platforms = GAME_PLATFORM_LIST;
  readonly features = HOME_FEATURES;
  readonly homeStats = HOME_STATS;
  readonly leaderboard = MOCK_LEADERBOARD;
  readonly tickerItems = MOCK_TICKER;
  readonly mobileMenuOpen = signal(false);

  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());
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
}
