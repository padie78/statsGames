import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { NeonBadgeComponent } from '../../ui';

interface TeamMember {
  gamerTag: string;
  role: string;
  kd: number;
  winRate: number;
  resilience: number;
  minutes: number;
}

const MOCK_TEAM: TeamMember[] = [
  { gamerTag: 'CapLead', role: 'IGL', kd: 1.18, winRate: 53, resilience: 81, minutes: 920 },
  { gamerTag: 'EntryOne', role: 'Entry', kd: 1.44, winRate: 51, resilience: 73, minutes: 880 },
  { gamerTag: 'FlexWire', role: 'Flex', kd: 1.27, winRate: 55, resilience: 79, minutes: 910 },
  { gamerTag: 'AnchorX', role: 'Support', kd: 1.05, winRate: 52, resilience: 86, minutes: 870 },
];

@Component({
  standalone: true,
  selector: 'app-team-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, RouterLink, NeonBadgeComponent],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-5 u-py-4">
        <header class="sg-page-header">
          <sg-neon-badge tone="lime">Scout · {{ game().label }}</sg-neon-badge>
          <h1 class="sg-page-header__title u-mt-2">Gestión de Equipo</h1>
          <p class="sg-page-header__subtitle">
            Comparación paralela de métricas del club o universidad.
          </p>
        </header>

        <section class="sg-portal-card">
          <div class="sg-portal-card__head">
            <h2 class="sg-portal-card__title">Roster activo</h2>
            <span class="sg-portal-card__meta">{{ members().length }} jugadores</span>
          </div>
          <div class="sg-talent-table sg-talent-table--team">
            <div class="sg-talent-table__row sg-talent-table__row--head">
              <span>Jugador</span>
              <span>Rol</span>
              <span>K/D</span>
              <span>Win%</span>
              <span>Resiliencia</span>
              <span>Min</span>
              <span></span>
            </div>
            @for (m of members(); track m.gamerTag) {
              <div class="sg-talent-table__row">
                <span><strong>{{ m.gamerTag }}</strong></span>
                <span>{{ m.role }}</span>
                <span>{{ m.kd.toFixed(2) }}</span>
                <span>{{ m.winRate }}%</span>
                <span>{{ m.resilience }}</span>
                <span>{{ m.minutes }}</span>
                <a [routerLink]="['/player', m.gamerTag]" class="u-btn u-btn--ghost">Comparar</a>
              </div>
            }
          </div>
        </section>
      </div>
    </ion-content>
  `,
})
export class TeamPageComponent {
  private readonly auth = inject(AuthService);
  readonly members = signal(MOCK_TEAM);
  readonly game = computed(() => {
    const id = this.auth.selectedGame();
    return id ? gamePlatformMeta(id) : gamePlatformMeta('fortnite');
  });
}
