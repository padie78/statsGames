import {
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { matchBackendPlatform, type SelectedGame } from '../../core/game/selected-game';
import {
  ObjectivesService,
  type ObjectiveEvolutionView,
} from '../../services/objectives.service';
import { ObjectivesPlanPanelComponent, WeekHeroBrandComponent } from '../../ui';

@Component({
  standalone: true,
  selector: 'app-objectives-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, WeekHeroBrandComponent, ObjectivesPlanPanelComponent],
  template: `
    <ion-content class="sg-page-content">
      <div class="sg-objectives-page" [attr.data-game]="activePlatform()">
        <section
          class="sg-dashboard__week sg-objectives__hero"
          [attr.data-game]="activePlatform()"
          aria-label="Objetivos"
        >
          <div class="sg-dashboard__week-veil" aria-hidden="true"></div>
          <div class="sg-dashboard__week-inner">
            <sg-week-hero-brand [platform]="activePlatform()" />
            <div class="sg-dashboard__week-main">
              <p class="sg-dashboard__week-eyebrow">{{ platformMeta().label }} · Metas</p>
              <h1 class="sg-dashboard__week-title">Objetivos</h1>
              <p class="sg-dashboard__week-lede u-m-0">
                Armá el programa, registrá la realidad y medí el cumplimiento.
              </p>

              <div class="sg-dashboard__week-kpis" aria-label="KPIs del programa de objetivos">
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">
                    {{ heroKpis().compliance }}
                  </span>
                  <span class="sg-dashboard__week-kpi-label">Cumplimiento</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().aligned }}</span>
                  <span class="sg-dashboard__week-kpi-label">Metas alineadas</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().critical }}</span>
                  <span class="sg-dashboard__week-kpi-label">Desvíos críticos</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().metrics }}</span>
                  <span class="sg-dashboard__week-kpi-label">Métricas activas</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="page-shell page-shell--fluid sg-objectives__body">
          @if (auth.userId(); as userId) {
            <sg-objectives-plan-panel
              [userId]="userId"
              [platform]="backendPlatform()"
              (dataChanged)="refreshKpis()"
            />
          } @else {
            <p class="u-error">Iniciá sesión para gestionar tu programa.</p>
          }
        </div>
      </div>
    </ion-content>
  `,
})
export class ObjectivesPageComponent {
  readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
  private readonly objectives = inject(ObjectivesService);
  private readonly evolution = signal<ObjectiveEvolutionView | null>(null);

  readonly activePlatform = computed(
    (): SelectedGame => this.gameContext.activeGame() ?? 'fortnite',
  );
  readonly platformMeta = computed(() => gamePlatformMeta(this.activePlatform()));
  readonly backendPlatform = computed(
    () => matchBackendPlatform(this.activePlatform()) ?? null,
  );

  readonly heroKpis = computed(() => {
    const evolution = this.evolution();
    return {
      compliance:
        evolution?.globalCompliancePct == null
          ? '—'
          : `${Math.round(evolution.globalCompliancePct)}%`,
      aligned: evolution?.alignedCount ?? 0,
      critical: evolution?.criticalCount ?? 0,
      metrics: evolution?.byMetric.length ?? 0,
    };
  });

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      if (userId) void this.loadKpis(userId);
    });
  }

  refreshKpis(): void {
    const userId = this.auth.userId();
    if (userId) void this.loadKpis(userId);
  }

  private async loadKpis(userId: string): Promise<void> {
    try {
      this.evolution.set(await this.objectives.getEvolutionOnce(userId));
    } catch {
      this.evolution.set(null);
    }
  }
}
