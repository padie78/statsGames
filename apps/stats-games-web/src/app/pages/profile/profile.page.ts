import { Component, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { lolProfileBannerSplashUrl } from '../../core/game/lol-ddragon.util';
import type { SelectedGame } from '../../core/game/selected-game';
import { PlayerService } from '../../services/player.service';
import {
  NeonBadgeComponent,
  ShareLinkButtonComponent,
  WeekHeroBrandComponent,
} from '../../ui';

@Component({
  standalone: true,
  selector: 'app-profile-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    RouterLink,
    NeonBadgeComponent,
    ShareLinkButtonComponent,
    WeekHeroBrandComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <div class="sg-profile-page" [attr.data-game]="activeGame()">
        <section
          class="sg-dashboard__week sg-profile__hero"
          [attr.data-game]="activeGame()"
          aria-label="Mi Perfil Público"
        >
          <img
            class="sg-dashboard__week-art sg-profile__hero-art"
            [src]="heroArtSrc()"
            [alt]="game().label + ' art'"
            (error)="onHeroArtError()"
          />
          <div class="sg-dashboard__week-veil" aria-hidden="true"></div>

          <div class="sg-dashboard__week-inner">
            <sg-week-hero-brand [platform]="activeGame()" />
            <div class="sg-dashboard__week-main">
              <p class="sg-dashboard__week-eyebrow">
                {{ game().label }} · Ficha pública
              </p>
              <h1 class="sg-dashboard__week-title">
                {{ gamerTag() || 'Mi Perfil' }}
              </h1>
              <p class="sg-dashboard__week-lede u-m-0">
                Vista previa de tu ficha para reclutadores. Editá biografía e identidad en
                Configuración.
              </p>

              <div class="sg-dashboard__week-kpis" aria-label="Identidad">
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ initials() }}</span>
                  <span class="sg-dashboard__week-kpi-label">Tag</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ game().shortLabel }}</span>
                  <span class="sg-dashboard__week-kpi-label">Juego</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ publicReady() }}</span>
                  <span class="sg-dashboard__week-kpi-label">Público</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="sg-profile__body page-shell page-shell--fluid u-flex u-flex-col u-gap-6">
          <section class="sg-dashboard__block" aria-labelledby="profile-preview">
            <div class="sg-dashboard__block-head">
              <div>
                <h2 id="profile-preview" class="sg-dashboard__block-title">Vista previa</h2>
                <p class="sg-dashboard__block-desc">
                  Así te ven scouts cuando abren tu ficha pública.
                </p>
              </div>
            </div>

            <section class="sg-portal-card sg-profile-preview" [attr.data-game]="game().id">
              <div class="sg-profile-preview__head">
                <div class="sg-profile-preview__avatar">{{ initials() }}</div>
                <div class="u-min-w-0">
                  <sg-neon-badge tone="lime">{{ game().label }}</sg-neon-badge>
                  <h3 class="sg-profile-preview__name">{{ gamerTag() || 'Sin gamer tag' }}</h3>
                  <p class="sg-profile-preview__meta u-m-0">{{ game().badge }}</p>
                </div>
              </div>

              <p class="sg-profile-preview__bio">
                {{ bio() }}
              </p>

              <div class="sg-profile-preview__actions">
                @if (gamerTag(); as tag) {
                  <a class="u-btn u-btn--ghost-gold" [routerLink]="['/player', tag]">
                    Ver ficha pública
                  </a>
                  <sg-share-link-button [gamerTag]="tag" />
                }
                <a class="u-btn u-btn--gold" routerLink="/tabs/settings">Editar perfil</a>
              </div>
            </section>
          </section>
        </div>
      </div>
    </ion-content>
  `,
})
export class ProfilePageComponent {
  private readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
  private readonly player = inject(PlayerService);

  readonly gamerTag = signal<string | null>(null);
  private readonly heroArtFailed = signal(false);

  readonly activeGame = computed((): SelectedGame => {
    return this.gameContext.activeGame() ?? this.auth.selectedGame() ?? 'fortnite';
  });

  readonly game = computed(() => gamePlatformMeta(this.activeGame()));

  readonly initials = computed(() => {
    const tag = this.gamerTag();
    if (tag) return tag.slice(0, 2).toUpperCase();
    return 'SG';
  });

  readonly publicReady = computed(() => (this.gamerTag() ? 'Sí' : 'No'));

  readonly bio = computed(
    () =>
      `Jugador de ${this.game().label}. ${this.game().tagline} Actualizá tu biografía desde Configuración para destacar ante scouts.`,
  );

  readonly heroArtSrc = computed(() => {
    const meta = this.game();
    if (this.heroArtFailed()) {
      return meta.portraitFallbackUrl || meta.artUrl;
    }
    if (this.activeGame() === 'league_of_legends') {
      const seed = (this.gamerTag() || this.auth.userId() || 'lol-profile').length + 31;
      return lolProfileBannerSplashUrl(seed);
    }
    return meta.portraitUrl || meta.artUrl;
  });

  constructor() {
    effect(
      () => {
        this.activeGame();
        this.heroArtFailed.set(false);
      },
      { allowSignalWrites: true },
    );
    effect(
      () => {
        const userId = this.auth.userId();
        if (!userId) {
          this.gamerTag.set(null);
          return;
        }
        void this.player
          .getPlayerProfileOrNull(userId)
          .then((p) => this.gamerTag.set(p?.gamerTag ?? null))
          .catch(() => this.gamerTag.set(null));
      },
      { allowSignalWrites: true },
    );
  }

  onHeroArtError(): void {
    this.heroArtFailed.set(true);
  }
}
