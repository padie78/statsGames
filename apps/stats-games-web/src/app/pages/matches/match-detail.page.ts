import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';
import { resolveMatchHistory } from '../../data/match-mock.data';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { FortniteOfficialMediaService } from '../../services/fortnite-official-media.service';
import { MatchAnalysisPanelComponent, MatchMapPanelComponent, MatchStatCardComponent } from '../../ui';
import {
  buildMatchAnalysisReport,
  formatMatchDetailMeta,
} from '../../utils/match-analysis.util';
import { resolveMatchMapTelemetry } from '../../utils/match-map-telemetry.mock';
import { toMatchCardStats } from '../../utils/match-stats.util';

@Component({
  standalone: true,
  selector: 'app-match-detail-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    RouterLink,
    MatchStatCardComponent,
    MatchMapPanelComponent,
    MatchAnalysisPanelComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid sg-match-detail u-flex u-flex-col u-gap-5">
        <header class="sg-match-detail__header">
          <a routerLink="/tabs/matches" class="sg-match-detail__back u-btn u-btn--ghost">
            ← Partidas
          </a>
          <div class="sg-match-detail__heading">
            <h1 class="sg-page-header__title">Análisis de partida</h1>
            <p class="sg-page-header__subtitle">
              Reporte completo con gráficos, pros/contras y plan de mejora.
            </p>
          </div>
        </header>

        @if (loading()) {
          <section class="u-surface-card u-p-5">
            <p class="u-hint u-m-0">Cargando partida…</p>
          </section>
        } @else if (error()) {
          <section class="u-surface-card u-p-5">
            <p class="u-error u-m-0">{{ error() }}</p>
            <a routerLink="/tabs/matches" class="u-btn u-btn--ghost u-mt-3">Volver al historial</a>
          </section>
        } @else if (match()) {
          <sg-match-stat-card
            [matchId]="match()!.matchId"
            [platform]="match()!.platform"
            [summary]="match()!.summary"
            [updatedAt]="match()!.updatedAt"
            [stats]="cardStats()"
            [detailed]="true"
          />

          @if (mapTelemetry(); as map) {
            <sg-match-map-panel [telemetry]="map" />
          }

          <sg-match-analysis-panel [report]="report()" (ctaClick)="goToMatches()" />

          <p class="sg-match-detail__meta u-hint u-m-0">{{ formatMeta() }}</p>
        }
      </div>
    </ion-content>
  `,
})
export class MatchDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly matchService = inject(MatchService);
  private readonly fortniteOfficial = inject(FortniteOfficialMediaService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly match = signal<MatchUpdateView | null>(null);
  readonly recentMatches = signal<MatchUpdateView[]>([]);

  readonly cardStats = computed(() => toMatchCardStats(this.match()?.stats));

  readonly report = computed(() => {
    const current = this.match();
    if (!current) {
      return buildMatchAnalysisReport({
        match: {
          userId: '',
          matchId: '',
          platform: 'fortnite',
          summary: '',
          updatedAt: new Date().toISOString(),
        },
      });
    }
    return buildMatchAnalysisReport({
      match: current,
      recentMatches: this.recentMatches(),
    });
  });

  readonly mapTelemetry = computed(() => {
    const current = this.match();
    if (!current) return null;
    const base = resolveMatchMapTelemetry(current);
    if (!base) return null;
    const official = this.fortniteOfficial.map();
    const mapAssetUrl = official?.poisUrl || official?.blankUrl || base.mapAssetUrl;
    return { ...base, mapAssetUrl };
  });

  ngOnInit(): void {
    void this.loadMatch();
  }

  formatMeta(): string {
    const current = this.match();
    return current ? formatMatchDetailMeta(current) : '';
  }

  goToMatches(): void {
    void this.router.navigateByUrl('/tabs/matches');
  }

  private async loadMatch(): Promise<void> {
    const matchId = decodeURIComponent(this.route.snapshot.paramMap.get('matchId') ?? '');
    if (!matchId) {
      this.error.set('Partida no encontrada.');
      this.loading.set(false);
      return;
    }

    const userId = this.auth.userId();
    if (!userId) {
      this.error.set('Iniciá sesión para ver el análisis.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      void this.fortniteOfficial.loadMap();

      const rows = await this.matchService.listPlayerMatchesOnce(userId, { limit: 100 });
      const resolved = resolveMatchHistory(rows, userId, null);
      this.recentMatches.set(resolved);

      const found =
        resolved.find((m) => m.matchId === matchId) ??
        rows.find((m) => m.matchId === matchId) ??
        null;

      if (!found) {
        this.error.set('No encontramos esta partida en tu historial.');
        return;
      }

      this.match.set(found);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error cargando la partida');
    } finally {
      this.loading.set(false);
    }
  }
}
