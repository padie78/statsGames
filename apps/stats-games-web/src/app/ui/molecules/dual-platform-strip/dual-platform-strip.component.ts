import { Component, Input, ViewEncapsulation } from '@angular/core';
import { GAME_PLATFORM_LIST } from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

@Component({
  standalone: true,
  selector: 'sg-dual-platform-strip',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-dual-platform" aria-label="Plataformas vinculadas">
      @for (p of platforms; track p.id) {
        <article
          class="sg-dual-platform__card"
          [class.sg-dual-platform__card--active]="activePlatform === p.id"
          [class.sg-dual-platform__card--roblox]="p.id === 'roblox'"
          [class.sg-dual-platform__card--fortnite]="p.id === 'fortnite'"
        >
          <img class="sg-dual-platform__art" [src]="p.artUrl" [alt]="p.label" aria-hidden="true" />
          <div class="sg-dual-platform__overlay" aria-hidden="true"></div>
          <div class="sg-dual-platform__body">
            <img class="sg-dual-platform__icon" [src]="p.iconUrl" [alt]="p.label" />
            <div class="sg-dual-platform__info">
              <h3 class="sg-dual-platform__name">{{ p.label }}</h3>
              <p class="sg-dual-platform__hint">{{ p.statsHint }}</p>
            </div>
            <sg-neon-badge
              [tone]="isConnected(p.id) ? 'lime' : 'muted'"
              [pulse]="activePlatform === p.id"
            >
              {{ activePlatform === p.id ? 'ACTIVA' : isConnected(p.id) ? 'LINKED' : 'OFF' }}
            </sg-neon-badge>
          </div>
        </article>
      }
    </section>
  `,
})
export class DualPlatformStripComponent {
  @Input() activePlatform: SelectedGame = 'fortnite';
  @Input() fortniteConnected = false;
  @Input() robloxConnected = false;

  readonly platforms = GAME_PLATFORM_LIST;

  isConnected(platform: SelectedGame): boolean {
    return platform === 'fortnite' ? this.fortniteConnected : this.robloxConnected;
  }
}
