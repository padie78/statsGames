import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { NeonBadgeComponent } from '../../ui';

interface ScoutReport {
  id: string;
  subject: string;
  acquiredAt: string;
  focus: string;
  score: number;
}

const MOCK_REPORTS: ScoutReport[] = [
  {
    id: 'rpt-041',
    subject: 'DriftKernel',
    acquiredAt: '2026-07-10',
    focus: 'Ficha Macro · clutch + resiliencia',
    score: 82,
  },
  {
    id: 'rpt-038',
    subject: 'QuietStorm',
    acquiredAt: '2026-07-04',
    focus: 'Ficha Macro · decision speed',
    score: 76,
  },
  {
    id: 'rpt-033',
    subject: 'NovaPulse',
    acquiredAt: '2026-06-28',
    focus: 'Ficha Macro · consistencia semanal',
    score: 71,
  },
];

@Component({
  standalone: true,
  selector: 'app-reports-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, NeonBadgeComponent],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-5 u-py-4">
        <header class="sg-page-header">
          <sg-neon-badge tone="purple">Scout · {{ game().label }}</sg-neon-badge>
          <h1 class="sg-page-header__title u-mt-2">Reportes Generados</h1>
          <p class="sg-page-header__subtitle">
            Historial de Fichas Técnicas Macro adquiridas en el periodo.
          </p>
        </header>

        <section class="sg-portal-card">
          <div class="sg-portal-card__head">
            <h2 class="sg-portal-card__title">Este mes</h2>
            <span class="sg-portal-card__meta">{{ reports().length }} fichas</span>
          </div>
          <ul class="sg-reports-list">
            @for (report of reports(); track report.id) {
              <li class="sg-reports-list__item">
                <div>
                  <strong>{{ report.subject }}</strong>
                  <p class="u-m-0 u-text-secondary u-text-sm">{{ report.focus }}</p>
                </div>
                <div class="sg-reports-list__side">
                  <span class="sg-reports-list__score">{{ report.score }}</span>
                  <time>{{ report.acquiredAt }}</time>
                </div>
              </li>
            }
          </ul>
        </section>
      </div>
    </ion-content>
  `,
})
export class ReportsPageComponent {
  private readonly auth = inject(AuthService);
  readonly reports = signal(MOCK_REPORTS);
  readonly game = computed(() => {
    const id = this.auth.selectedGame();
    return id ? gamePlatformMeta(id) : gamePlatformMeta('fortnite');
  });
}
