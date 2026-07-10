import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GAME_PLATFORMS } from '../../../core/game/game-platform.config';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

@Component({
  standalone: true,
  selector: 'sg-integration-status-card',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
    <section class="sg-integration-status u-surface-card u-p-4">
      <header class="sg-panel-header">
        <h2 class="sg-panel-header__title">Conexiones</h2>
        <a routerLink="/tabs/integrations" class="sg-panel-header__link">Gestionar</a>
      </header>

      <div class="sg-integration-status__rows">
        <div class="sg-integration-status__row">
          <div class="sg-integration-status__brand">
            <img
              class="sg-integration-status__icon"
              [src]="fortniteMeta.iconUrl"
              alt="Fortnite"
            />
            <span>Fortnite</span>
          </div>
          <sg-neon-badge [tone]="fortniteConnected ? 'lime' : 'muted'">
            {{ fortniteConnected ? 'Conectado' : 'Pendiente' }}
          </sg-neon-badge>
        </div>
        <div class="sg-integration-status__row">
          <div class="sg-integration-status__brand">
            <img
              class="sg-integration-status__icon"
              [src]="robloxMeta.iconUrl"
              alt="Roblox"
            />
            <span>Roblox</span>
          </div>
          <sg-neon-badge [tone]="robloxConnected ? 'lime' : 'muted'">
            {{ robloxConnected ? 'Conectado' : 'Pendiente' }}
          </sg-neon-badge>
        </div>
        <div class="sg-integration-status__row">
          <span>Live feed</span>
          <sg-neon-badge [tone]="liveActive ? 'cyan' : 'muted'" [pulse]="liveActive">
            {{ liveActive ? 'Activo' : 'Idle' }}
          </sg-neon-badge>
        </div>
      </div>
    </section>
  `,
})
export class IntegrationStatusCardComponent {
  @Input() fortniteConnected = false;
  @Input() robloxConnected = false;
  @Input() liveActive = false;

  readonly fortniteMeta = GAME_PLATFORMS['fortnite'];
  readonly robloxMeta = GAME_PLATFORMS['roblox'];
}
