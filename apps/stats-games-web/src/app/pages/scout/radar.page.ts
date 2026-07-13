import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { NeonBadgeComponent } from '../../ui';

interface RadarPlayer {
  gamerTag: string;
  trend: 'up' | 'flat' | 'down';
  note: string;
  lastSeen: string;
  stressResilience: number;
}

const MOCK_RADAR: RadarPlayer[] = [
  {
    gamerTag: 'DriftKernel',
    trend: 'up',
    note: 'Mejora sostenida en clutch rate (últimas 3 semanas).',
    lastSeen: 'hace 2 h',
    stressResilience: 84,
  },
  {
    gamerTag: 'QuietStorm',
    trend: 'flat',
    note: 'K/D estable; caída leve en decision speed en overtime.',
    lastSeen: 'hace 6 h',
    stressResilience: 69,
  },
  {
    gamerTag: 'NovaPulse',
    trend: 'down',
    note: 'Consistencia bajo presión en descenso tras racha negativa.',
    lastSeen: 'ayer',
    stressResilience: 78,
  },
];

@Component({
  standalone: true,
  selector: 'app-radar-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, RouterLink, NeonBadgeComponent],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-5 u-py-4">
        <header class="sg-page-header">
          <sg-neon-badge tone="cyan">Scout · {{ game().label }}</sg-neon-badge>
          <h1 class="sg-page-header__title u-mt-2">Mi Radar</h1>
          <p class="sg-page-header__subtitle">
            Monitoreo de favoritos: evolución, resiliencia y señales de alerta.
          </p>
        </header>

        <div class="sg-radar-grid">
          @for (player of players(); track player.gamerTag) {
            <article class="sg-portal-card sg-radar-card" [attr.data-trend]="player.trend">
              <div class="sg-radar-card__top">
                <h2 class="sg-radar-card__name">{{ player.gamerTag }}</h2>
                <sg-neon-badge [tone]="trendTone(player.trend)">{{ trendLabel(player.trend) }}</sg-neon-badge>
              </div>
              <p class="sg-radar-card__note">{{ player.note }}</p>
              <dl class="sg-radar-card__meta">
                <div>
                  <dt>Resiliencia</dt>
                  <dd>{{ player.stressResilience }}</dd>
                </div>
                <div>
                  <dt>Última señal</dt>
                  <dd>{{ player.lastSeen }}</dd>
                </div>
              </dl>
              <a class="u-btn u-btn--ghost" [routerLink]="['/player', player.gamerTag]">Abrir ficha</a>
            </article>
          }
        </div>
      </div>
    </ion-content>
  `,
})
export class RadarPageComponent {
  private readonly auth = inject(AuthService);
  readonly players = signal(MOCK_RADAR);
  readonly game = computed(() => {
    const id = this.auth.selectedGame();
    return id ? gamePlatformMeta(id) : gamePlatformMeta('fortnite');
  });

  trendLabel(trend: RadarPlayer['trend']): string {
    if (trend === 'up') return 'Alcista';
    if (trend === 'down') return 'Bajista';
    return 'Estable';
  }

  trendTone(trend: RadarPlayer['trend']): 'lime' | 'purple' | 'muted' {
    if (trend === 'up') return 'lime';
    if (trend === 'down') return 'purple';
    return 'muted';
  }
}
