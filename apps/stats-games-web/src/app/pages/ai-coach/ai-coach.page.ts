import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';
import { matchBackendPlatform } from '../../core/game/selected-game';
import { MatchAiService, type MatchAiReportView } from '../../services/match-ai.service';
import { NeonBadgeComponent } from '../../ui';
import { matchDetailRoute } from '../../utils/match-analysis.util';
import { formatMatchRelativeTime } from '../../utils/match-stats.util';

@Component({
  standalone: true,
  selector: 'app-ai-coach-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, RouterLink, NeonBadgeComponent],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-5">
        <header class="sg-page-header">
          <h1 class="sg-page-header__title">AI Coach</h1>
          <p class="sg-page-header__subtitle">
            Análisis Bedrock post-partida (Valorant). Abrí el detalle para el reporte completo.
          </p>
        </header>

        @if (loading()) {
          <p class="u-hint u-m-0">Cargando reportes…</p>
        } @else if (error()) {
          <p class="u-error u-m-0">{{ error() }}</p>
        } @else if (reports().length === 0) {
          <section class="u-surface-card u-p-5">
            <sg-neon-badge tone="muted">Sin reportes aún</sg-neon-badge>
            <p class="u-hint u-mt-3 u-mb-0">
              Vinculá tu Riot ID en Integraciones y jugá una partida. Al cerrar, el poller encola el
              match y Bedrock genera el coaching.
            </p>
            <a routerLink="/tabs/integrations" class="u-btn u-btn--ghost u-mt-4">Ir a Integraciones</a>
          </section>
        } @else {
          <div class="u-flex u-flex-col u-gap-3">
            @for (report of reports(); track report.matchId) {
              <a
                class="u-surface-card u-p-4 sg-ai-coach-row"
                [routerLink]="detailLink(report.matchId)"
              >
                <div class="u-flex u-items-start u-justify-between u-gap-3">
                  <div>
                    <div class="u-flex u-gap-2 u-items-center u-mb-1">
                      <sg-neon-badge [tone]="report.status === 'ready' ? 'purple' : 'muted'">
                        {{ report.gradeLabel }} · {{ report.performanceScore }}/100
                      </sg-neon-badge>
                      <sg-neon-badge tone="cyan">{{ report.platform }}</sg-neon-badge>
                    </div>
                    <h2 class="u-text-md u-m-0">{{ report.headline }}</h2>
                    <p class="u-hint u-m-0 u-mt-1">{{ report.summary }}</p>
                  </div>
                  <span class="u-hint u-text-xs">{{ relative(report.createdAt) }}</span>
                </div>
              </a>
            }
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      .sg-ai-coach-row {
        display: block;
        text-decoration: none;
        color: inherit;
        transition: border-color 160ms ease, transform 160ms ease;
      }
      .sg-ai-coach-row:hover {
        transform: translateY(-1px);
      }
    `,
  ],
})
export class AiCoachPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly matchAi = inject(MatchAiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly reports = signal<MatchAiReportView[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  detailLink(matchId: string): string {
    return matchDetailRoute(matchId);
  }

  relative(iso: string): string {
    return formatMatchRelativeTime(iso);
  }

  private async load(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) {
      this.loading.set(false);
      this.error.set('Iniciá sesión para ver el AI Coach.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const platform = matchBackendPlatform(this.auth.selectedGame());
      const rows = await this.matchAi.listMatchAiReportsOnce(userId, {
        platform: platform === 'valorant' ? 'valorant' : undefined,
        limit: 30,
      });
      this.reports.set(rows);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error cargando reportes IA');
    } finally {
      this.loading.set(false);
    }
  }
}
