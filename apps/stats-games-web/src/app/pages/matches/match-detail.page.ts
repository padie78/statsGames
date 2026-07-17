import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';
import { resolveMatchHistory } from '../../data/match-mock.data';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchAiService, type MatchAiReportView } from '../../services/match-ai.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { FortniteOfficialMediaService } from '../../services/fortnite-official-media.service';
import { MatchNotificationsStore } from '../../stores/match-notifications.store';
import { MatchAnalysisPanelComponent, MatchMapPanelComponent, MatchStatCardComponent } from '../../ui';
import {
  buildMatchAnalysisReport,
  formatMatchDetailMeta,
  matchAiReportToAnalysisReport,
} from '../../utils/match-analysis.util';
import { resolveMatchMapTelemetry } from '../../utils/match-map-telemetry.mock';
import { toMatchCardStats, mergeMatchStats } from '../../utils/match-stats.util';

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
              Stats al instante. El reporte IA se completa cuando el análisis termina.
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
          @if (aiPending()) {
            <section class="u-surface-card u-p-5 sg-match-detail__ai-pending">
              <p class="sg-match-detail__ai-pending-title u-m-0">Análisis IA en proceso…</p>
              <p class="u-hint u-m-0">
                Ya podés revisar las estadísticas. El reporte se actualiza solo cuando la IA termine.
              </p>
            </section>
          } @else if (aiFailed()) {
            <section class="u-surface-card u-p-5 sg-match-detail__ai-pending">
              <p class="sg-match-detail__ai-pending-title u-m-0">Análisis IA no disponible</p>
              <p class="u-hint u-m-0">
                Las stats de la partida siguen disponibles. Podés volver a intentar más tarde.
              </p>
            </section>
          }

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

          @if (!aiPending()) {
            <sg-match-analysis-panel [report]="report()" (ctaClick)="goToMatches()" />
          }

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
  private readonly matchAi = inject(MatchAiService);
  private readonly fortniteOfficial = inject(FortniteOfficialMediaService);
  private readonly realtime = inject(AppSyncRealtimeService);
  private readonly notifications = inject(MatchNotificationsStore);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly match = signal<MatchUpdateView | null>(null);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly aiReport = signal<MatchAiReportView | null>(null);

  readonly cardStats = computed(() => toMatchCardStats(this.match()?.stats));

  readonly notificationAiStatus = computed(() => {
    const current = this.match();
    if (!current) return null;
    return this.notifications.getByMatchId(current.matchId)?.aiStatus ?? null;
  });

  readonly aiPending = computed(() => {
    const current = this.match();
    if (!current) return false;
    if (this.aiReport()?.status === 'ready' || this.aiReport()?.status === 'failed') {
      return false;
    }
    return this.notificationAiStatus() === 'pending';
  });

  readonly aiFailed = computed(() => {
    if (this.aiReport()?.status === 'failed') return true;
    return this.notificationAiStatus() === 'failed';
  });

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

    const bedrock = this.aiReport();
    if (bedrock && bedrock.status !== 'failed') {
      return matchAiReportToAnalysisReport(bedrock, current, this.recentMatches());
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

  constructor() {
    effect(() => {
      const status = this.notificationAiStatus();
      const current = this.match();
      const userId = this.auth.userId();
      if (!current || !userId) return;
      if (status !== 'ready' && status !== 'failed') return;
      if (this.aiReport()?.status === 'ready' || this.aiReport()?.status === 'failed') return;
      void this.refreshAiReport(userId, current.matchId);
    });

    effect(
      () => {
        const current = this.match();
        if (!current) return;

        const live = this.realtime.liveMatches().find((m) => m.matchId === current.matchId);
        const notified = this.notifications.getByMatchId(current.matchId)?.match;
        const patch = live ?? notified;
        if (!patch) return;

        const mergedStats = mergeMatchStats(current.stats, patch.stats);
        const sameStats = JSON.stringify(current.stats ?? {}) === JSON.stringify(mergedStats ?? {});
        const sameSummary = (patch.summary || current.summary) === current.summary;
        if (sameStats && sameSummary) return;

        this.match.set({
          ...current,
          ...patch,
          summary: patch.summary || current.summary,
          stats: mergedStats,
        });
      },
      { allowSignalWrites: true },
    );
  }

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

  private async refreshAiReport(userId: string, matchId: string): Promise<void> {
    try {
      const ai = await this.matchAi.getMatchAiReport(userId, matchId);
      this.aiReport.set(ai);
    } catch {
      // Mantener stats; el panel local / failed cubre el vacío.
    }
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

      const fromLive =
        this.realtime.liveMatches().find((m) => m.matchId === matchId) ??
        this.notifications.getByMatchId(matchId)?.match ??
        null;

      const found =
        resolved.find((m) => m.matchId === matchId) ??
        rows.find((m) => m.matchId === matchId) ??
        fromLive;

      if (!found) {
        this.error.set('No encontramos esta partida en tu historial.');
        return;
      }

      this.match.set(found);

      try {
        const ai = await this.matchAi.getMatchAiReport(userId, matchId);
        this.aiReport.set(ai);
      } catch {
        this.aiReport.set(null);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error cargando la partida');
    } finally {
      this.loading.set(false);
    }
  }
}
