import { Component, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { PlayerService } from '../../services/player.service';
import { NeonBadgeComponent, ShareLinkButtonComponent } from '../../ui';

@Component({
  standalone: true,
  selector: 'app-profile-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, RouterLink, NeonBadgeComponent, ShareLinkButtonComponent],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-5 u-py-4">
        <header class="sg-page-header">
          <h1 class="sg-page-header__title">Mi Perfil Público</h1>
          <p class="sg-page-header__subtitle">
            Vista previa de tu ficha para reclutadores. Editá biografía e identidad en Configuración.
          </p>
        </header>

        <section class="sg-portal-card sg-profile-preview" [attr.data-game]="game().id">
          <div class="sg-profile-preview__head">
            <div class="sg-profile-preview__avatar">{{ initials() }}</div>
            <div class="u-min-w-0">
              <sg-neon-badge tone="lime">{{ game().label }}</sg-neon-badge>
              <h2 class="sg-profile-preview__name">{{ gamerTag() || 'Sin gamer tag' }}</h2>
              <p class="sg-profile-preview__meta u-m-0">{{ game().badge }}</p>
            </div>
          </div>

          <p class="sg-profile-preview__bio">
            {{ bio() }}
          </p>

          <div class="sg-profile-preview__actions">
            @if (gamerTag(); as tag) {
              <a class="u-btn u-btn--ghost" [routerLink]="['/player', tag]">Ver ficha pública</a>
              <sg-share-link-button [gamerTag]="tag" />
            }
            <a class="u-btn u-btn--primary" routerLink="/tabs/settings">Editar perfil</a>
          </div>
        </section>
      </div>
    </ion-content>
  `,
})
export class ProfilePageComponent {
  private readonly auth = inject(AuthService);
  private readonly player = inject(PlayerService);

  readonly gamerTag = signal<string | null>(null);
  readonly game = computed(() => {
    const id = this.auth.selectedGame();
    return id ? gamePlatformMeta(id) : gamePlatformMeta('fortnite');
  });
  readonly initials = computed(() => {
    const tag = this.gamerTag();
    if (tag) return tag.slice(0, 2).toUpperCase();
    return 'SG';
  });
  readonly bio = computed(
    () =>
      `Jugador de ${this.game().label}. ${this.game().tagline} Actualizá tu biografía desde Configuración para destacar ante scouts.`,
  );

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      if (!userId) {
        this.gamerTag.set(null);
        return;
      }
      void this.player
        .getPlayerProfileOrNull(userId)
        .then((p) => this.gamerTag.set(p?.gamerTag ?? null))
        .catch(() => this.gamerTag.set(null));
    });
  }
}
