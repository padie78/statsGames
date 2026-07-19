import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import {
  matchBackendPlatform,
  selectedGameFromBackend,
  type SelectedGame,
} from '../../../core/game/selected-game';
import {
  MOCK_COMMUNITY_BENCHMARKS,
  type CommunityBenchmarks,
} from '../../../data/community-mock.data';
import { resolveMatchHistory } from '../../../data/match-mock.data';
import { AppSyncRealtimeService } from '../../../services/appsync-realtime.service';
import { MatchAiService, type MatchAiReportView } from '../../../services/match-ai.service';
import { MatchService, type MatchUpdateView } from '../../../services/match.service';
import { FortniteOfficialMediaService } from '../../../services/fortnite-official-media.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
} from '../../../services/stats.service';
import { MatchNotificationsStore } from '../../../stores/match-notifications.store';
import {
  buildMatchAnalysisReport,
  formatMatchDetailMeta,
  matchAiReportToAnalysisReport,
  withCommunityBenchmarks,
} from '../../../utils/match-analysis.util';
import { mapCommunityBenchmarksFromApi } from '../../../utils/community-stats.util';
import { resolveMatchMapTelemetry } from '../../../utils/match-map-lol.util';
import { toMatchCardStats, mergeMatchStats } from '../../../utils/match-stats.util';
import { MatchAnalysisPanelComponent } from '../../molecules/match-analysis-panel/match-analysis-panel.component';
import { MatchMapPanelComponent } from '../../molecules/match-map-panel/match-map-panel.component';
import { MatchStatCardComponent } from '../../molecules/match-stat-card/match-stat-card.component';

@Component({
  standalone: true,
  selector: 'sg-match-analysis-view',
  encapsulation: ViewEncapsulation.None,
  imports: [MatchStatCardComponent, MatchMapPanelComponent, MatchAnalysisPanelComponent],
  template: `
    <div class="sg-match-analysis-view u-flex u-flex-col u-gap-5">
      @if (loading()) {
        <section class="u-surface-card u-p-5">
          <p class="u-hint u-m-0">Cargando partida…</p>
        </section>
      } @else if (error()) {
        <section class="u-surface-card u-p-5">
          <p class="u-error u-m-0">{{ error() }}</p>
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
          [hero]="true"
          [clickable]="false"
        />

        @if (mapTelemetry(); as map) {
          <sg-match-map-panel [telemetry]="map" />
        }

        @if (!aiPending()) {
          <sg-match-analysis-panel [report]="report()" (ctaClick)="ctaClick.emit()" />
        }

        <p class="sg-match-detail__meta u-hint u-m-0">{{ formatMeta() }}</p>
      }
    </div>
  `,
})
export class MatchAnalysisViewComponent implements OnChanges {
  private readonly auth = inject(AuthService);
  private readonly matchService = inject(MatchService);
  private readonly matchAi = inject(MatchAiService);
  private readonly statsService = inject(StatsService);
  private readonly fortniteOfficial = inject(FortniteOfficialMediaService);
  private readonly realtime = inject(AppSyncRealtimeService);
  private readonly notifications = inject(MatchNotificationsStore);

  @Input() matchId: string | null = null;
  @Output() readonly ctaClick = new EventEmitter<void>();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly match = signal<MatchUpdateView | null>(null);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly aiReport = signal<MatchAiReportView | null>(null);
  readonly communityBenchmarks = signal<CommunityBenchmarks | null>(null);

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
    const recent = this.recentMatches();
    const benchmarks = this.communityBenchmarks();

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
    const base =
      bedrock && bedrock.status !== 'failed'
        ? matchAiReportToAnalysisReport(bedrock, current, recent)
        : buildMatchAnalysisReport({
            match: current,
            recentMatches: recent,
          });

    return withCommunityBenchmarks(base, current, recent, benchmarks);
  });

  readonly mapTelemetry = computed(() => {
    const current = this.match();
    if (!current) return null;
    const base = resolveMatchMapTelemetry(current);
    if (!base) return null;
    if (base.platform.toLowerCase().includes('fortnite') || base.source === 'fortnite_preview') {
      const official = this.fortniteOfficial.map();
      const mapAssetUrl = official?.poisUrl || official?.blankUrl || base.mapAssetUrl;
      return { ...base, mapAssetUrl };
    }
    return base;
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['matchId']) {
      void this.loadMatch();
    }
  }

  formatMeta(): string {
    const current = this.match();
    return current ? formatMatchDetailMeta(current) : '';
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
    const matchId = (this.matchId ?? '').trim();
    if (!matchId) {
      this.match.set(null);
      this.error.set(null);
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
    this.match.set(null);
    this.aiReport.set(null);

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
      await this.loadCommunityBenchmarks(found.platform);

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

  private async loadCommunityBenchmarks(platformRaw: string): Promise<void> {
    const uiGame: SelectedGame = selectedGameFromBackend(platformRaw);
    const backendPlatform = matchBackendPlatform(uiGame);
    const periodId = currentWeeklyPeriodIdForStats();

    try {
      const community = await firstValueFrom(
        this.statsService.getCommunityBenchmarks(backendPlatform ?? 'fortnite', periodId),
      );

      if (community && community.sampleSize > 0) {
        this.communityBenchmarks.set(
          mapCommunityBenchmarksFromApi({
            platform: selectedGameFromBackend(community.platform, uiGame),
            sampleSize: community.sampleSize,
            avgWinRate: community.avgWinRate,
            avgKd: community.avgKd,
            avgKillsPerWeek: community.avgKillsPerWeek,
            avgMatchesPerWeek: community.avgMatchesPerWeek,
            winRateStd: community.winRateStd,
            kdStd: community.kdStd,
            killsStd: community.killsStd,
          }),
        );
        return;
      }
    } catch {
      // Fallback a mock local si no hay rollups comunitarios.
    }

    this.communityBenchmarks.set(MOCK_COMMUNITY_BENCHMARKS[uiGame] ?? null);
  }
}
