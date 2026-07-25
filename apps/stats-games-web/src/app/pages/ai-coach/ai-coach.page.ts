import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AnalysisRangeService } from '../../core/analysis/analysis-range.service';
import {
  analysisRangeNoun,
  analysisRangeWeekSpan,
  isoInAnalysisRange,
  type AnalysisRangeId,
} from '../../core/analysis/analysis-range';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { lolChampionSplashUrl, lolCoachBannerSplashUrl } from '../../core/game/lol-ddragon.util';
import {
  valorantAgentSplashUrl,
  valorantCoachBannerSplashUrl,
} from '../../core/game/valorant-assets.util';
import {
  matchBackendPlatform,
  selectedGameFromBackend,
  type SelectedGame,
} from '../../core/game/selected-game';
import { MatchAiService, type MatchAiReportView } from '../../services/match-ai.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  isoWeeklyPeriodIdForDay,
  listRecentWeeklyPeriodIds,
  type LeaderboardEntryView,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import { MOCK_COMMUNITY_BENCHMARKS } from '../../data/community-mock.data';
import type { CommunityBenchmarks } from '../../data/community-mock.data';
import {
  buildMockMatchHistory,
  filterMockMatchesByPlatform,
} from '../../data/match-mock.data';
import {
  AnalysisFiltersPanelComponent,
  NeonBadgeComponent,
  WeekHeroBrandComponent,
  WeeklyAiCoachPanelComponent,
} from '../../ui';
import { matchDetailRoute } from '../../utils/match-analysis.util';
import {
  aggregateMatchStats,
  filterMatchesByAnalysisRange,
  formatMatchRelativeTime,
} from '../../utils/match-stats.util';
import { aggregatePlatformMatchStats } from '../../utils/platform-stats.util';
import { mapCommunityBenchmarksFromApi } from '../../utils/community-stats.util';
import { buildWeeklyAiCoachSummary } from '../../utils/weekly-ai-summary.util';
import {
  buildWeeklyCommunityRankView,
  mergeLeaderboardsAcrossPeriods,
} from '../../utils/weekly-community-rank.util';

@Component({
  standalone: true,
  selector: 'app-ai-coach-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    RouterLink,
    NeonBadgeComponent,
    WeekHeroBrandComponent,
    WeeklyAiCoachPanelComponent,
    AnalysisFiltersPanelComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <div
        class="sg-coach-page"
        [class.sg-coach-page--loading]="loading()"
        [attr.data-game]="activePlatform()"
      >
        <section
          class="sg-dashboard__week sg-coach__hero"
          [attr.data-game]="activePlatform()"
          aria-label="Coach IA"
        >
          <img
            class="sg-dashboard__week-art sg-coach__hero-art"
            [src]="heroArtSrc()"
            [alt]="platformMeta().label + ' art'"
            (error)="onHeroArtError()"
          />
          <div class="sg-dashboard__week-veil" aria-hidden="true"></div>

          <div class="sg-dashboard__week-inner">
            <sg-week-hero-brand [platform]="activePlatform()" />
            <div class="sg-dashboard__week-main">
              <p class="sg-dashboard__week-eyebrow">
                {{ platformMeta().label }} · Bandeja IA
                @if (!loading()) {
                  <span>· {{ reports().length }} reportes</span>
                }
              </p>
              <h1 class="sg-dashboard__week-title">Coach IA</h1>
              <p class="sg-dashboard__week-lede u-m-0">
                Bandeja de análisis Bedrock por partida. El detalle técnico vive en cada match; el
                informe macro de progreso está en Evolución.
              </p>

              <div class="sg-dashboard__week-kpis" [attr.aria-label]="'KPIs · ' + rangeNoun()">
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().winRate }}</span>
                  <span class="sg-dashboard__week-kpi-label">Win rate</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().kd }}</span>
                  <span class="sg-dashboard__week-kpi-label">{{ kdLabel() }}</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().wins }}</span>
                  <span class="sg-dashboard__week-kpi-label">Victorias</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().reports }}</span>
                  <span class="sg-dashboard__week-kpi-label">Reportes</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="sg-coach__body page-shell page-shell--fluid">
          <section class="sg-dashboard__block" aria-labelledby="coach-filters">
            <div class="sg-dashboard__block-head">
              <div>
                <h2 id="coach-filters" class="sg-dashboard__block-title">Filtros</h2>
                <p class="sg-dashboard__block-desc">
                  Mismo período que Inicio, Partidas y Evolución.
                </p>
              </div>
            </div>
            <sg-analysis-filters-panel
              title="Período de análisis"
              [subtitle]="'Activo: ' + rangeMeta().label"
              [value]="analysisRange.range()"
              [selectedDayIso]="analysisRange.selectedDayIso()"
              (rangeChange)="onAnalysisRangeChange($event)"
              (dayChange)="onAnalysisDayChange($event)"
            />
          </section>

          @if (loading()) {
            <div
              class="sg-coach__loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label="Cargando Coach IA"
            >
              <span class="sg-dashboard__loading-dots" aria-hidden="true">
                <i></i><i></i><i></i>
              </span>
            </div>
          } @else {
            @if (error()) {
              <p class="u-error u-m-0">{{ error() }}</p>
            }

            <section class="sg-dashboard__block" aria-labelledby="coach-reports">
              <div class="sg-dashboard__block-head">
                <div>
                  <h2 id="coach-reports" class="sg-dashboard__block-title">
                    Análisis por partida
                  </h2>
                  <p class="sg-dashboard__block-desc">
                    Reportes Bedrock listos: grade, headline y primer foco. Tocá uno para el
                    detalle.
                  </p>
                </div>
                <a routerLink="/tabs/matches" class="sg-dashboard__block-link">Partidas →</a>
              </div>

              @if (error() && reports().length === 0) {
                <p class="u-error u-m-0">{{ error() }}</p>
              } @else if (reports().length === 0) {
                <section class="u-surface-card u-p-5">
                  <sg-neon-badge tone="muted">Sin reportes aún</sg-neon-badge>
                  <p class="u-hint u-mt-3 u-mb-0">
                    Esta bandeja lista análisis por partida generados por Bedrock. Todavía no hay
                    filas porque el analyzer no generó reportes, o las partidas del juego activo no
                    están encoladas.
                  </p>
                  <ul class="u-hint u-mt-3" style="padding-left: 1.1rem; margin: 0">
                    <li>Vinculá la cuenta del juego en Integraciones</li>
                    <li>Jugá / enviá un match (poller o send-match)</li>
                    <li>Esperá a que match_ai_analyzer marque el reporte como ready</li>
                  </ul>
                  <div class="u-flex u-gap-2 u-mt-4" style="flex-wrap: wrap">
                    <a routerLink="/tabs/integrations" class="u-btn u-btn--ghost-gold">
                      Ir a Integraciones
                    </a>
                    <a routerLink="/tabs/matches" class="u-btn u-btn--gold">Ver Partidas</a>
                  </div>
                </section>
              } @else {
                <div class="sg-coach-cards">
                  @for (card of reportCards(); track card.matchId) {
                    <a
                      class="sg-coach-card"
                      [class.sg-coach-card--ready]="card.status === 'ready'"
                      [routerLink]="detailLink(card.matchId)"
                    >
                      @if (card.artUrl) {
                        <div class="sg-coach-card__art-wrap" aria-hidden="true">
                          <img
                            class="sg-coach-card__art"
                            [src]="card.artUrl"
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                          <span class="sg-coach-card__veil"></span>
                        </div>
                      }
                      <div class="sg-coach-card__body">
                        <div class="sg-coach-card__top">
                          <div class="sg-coach-card__grade">
                            <span class="sg-coach-card__grade-letter">{{ card.gradeLabel || '—' }}</span>
                            <span class="sg-coach-card__grade-score">
                              {{ card.performanceScore != null ? card.performanceScore : '—' }}
                              <small>/100</small>
                            </span>
                          </div>
                          <span class="sg-coach-card__time">{{ card.relativeTime }}</span>
                        </div>
                        <p class="sg-coach-card__identity u-m-0">{{ card.identity }}</p>
                        <h3 class="sg-coach-card__title">{{ card.headline }}</h3>
                        <p class="sg-coach-card__summary u-m-0">{{ card.summary }}</p>
                        @if (card.focus) {
                          <p class="sg-coach-card__focus u-m-0">
                            <strong>Foco</strong> {{ card.focus }}
                          </p>
                        }
                        <span class="sg-coach-card__cta">Ver análisis →</span>
                      </div>
                    </a>
                  }
                </div>
              }
            </section>

            @if (hasWeekData()) {
              <section class="sg-dashboard__block sg-coach__weekly-slim" aria-labelledby="coach-weekly">
                <div class="sg-dashboard__block-head">
                  <div>
                    <h2 id="coach-weekly" class="sg-dashboard__block-title">
                      Resumen · {{ rangeMeta().label }}
                    </h2>
                    <p class="sg-dashboard__block-desc">
                      Lectura local del rango elegido. El informe IA macro está en Evolución.
                    </p>
                  </div>
                  <a routerLink="/tabs/analytics" class="sg-dashboard__block-link">
                    Evolución →
                  </a>
                </div>
                <sg-weekly-ai-coach-panel
                  [summary]="weeklyCoach()"
                  [communityRank]="weeklyCommunityRank()"
                  badgeLabel="Local"
                  [emphasizeAi]="false"
                  ctaLabel="Ver Evolución"
                  (ctaClick)="goToEvolution()"
                />
              </section>
            }
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: [],
})
export class AiCoachPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
  readonly analysisRange = inject(AnalysisRangeService);
  private readonly matchAi = inject(MatchAiService);
  private readonly matchService = inject(MatchService);
  private readonly playerService = inject(PlayerService);
  private readonly statsService = inject(StatsService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly reports = signal<MatchAiReportView[]>([]);
  readonly profile = signal<PlayerProfileView | null>(null);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly weekly = signal<PlayerStatsRollupView | null>(null);
  readonly communityBenchmarksApi = signal<CommunityBenchmarks | null>(null);
  readonly communityLeaderboardApi = signal<LeaderboardEntryView[]>([]);
  readonly latestAiReport = signal<MatchAiReportView | null>(null);
  private readonly heroArtFailed = signal(false);

  readonly activePlatform = computed<SelectedGame>(() => {
    const g = this.gameContext.activeGame();
    if (g) return g;
    return selectedGameFromBackend(this.profile()?.primaryPlatform) ?? 'fortnite';
  });

  readonly platformMeta = computed(() => gamePlatformMeta(this.activePlatform()));
  readonly rangeMeta = computed(() => this.analysisRange.meta());
  readonly rangeNoun = computed(() =>
    analysisRangeNoun(this.analysisRange.range(), this.analysisRange.selectedDayIso()),
  );

  readonly heroArtSrc = computed(() => {
    const meta = this.platformMeta();
    if (this.heroArtFailed()) {
      return meta.portraitFallbackUrl || meta.artUrl;
    }
    const seed = (this.profile()?.gamerTag ?? this.auth.userId() ?? 'coach-hero').length + 23;
    if (this.activePlatform() === 'league_of_legends') {
      return lolCoachBannerSplashUrl(seed);
    }
    if (this.activePlatform() === 'valorant') {
      return valorantCoachBannerSplashUrl(seed);
    }
    return meta.portraitUrl || meta.artUrl;
  });

  readonly kdLabel = computed(() => {
    const platform = this.activePlatform();
    return platform === 'valorant' ||
      platform === 'league_of_legends' ||
      platform === 'dota2' ||
      platform === 'overwatch2'
      ? 'KDA'
      : 'K/D';
  });

  readonly effectiveRecentMatches = computed(() => {
    const userId = this.auth.userId() ?? 'mock-user-demo';
    const platform = this.activePlatform();
    const api = this.recentMatches();
    const source = api.length > 0 ? api : buildMockMatchHistory(userId);
    return filterMockMatchesByPlatform(source, platform);
  });

  readonly weekMatches = computed(() =>
    filterMatchesByAnalysisRange(
      this.effectiveRecentMatches(),
      this.analysisRange.range(),
      this.analysisRange.selectedDayIso(),
    ),
  );

  readonly weekSummary = computed(() => aggregateMatchStats(this.weekMatches()));

  readonly platformWeekSummary = computed(() =>
    aggregatePlatformMatchStats(this.weekMatches()),
  );

  readonly heroKpis = computed(() => {
    const s = this.platformWeekSummary();
    const useKda = this.kdLabel() === 'KDA';
    const rangeReports = this.reportsInRange().length;
    return {
      winRate: s.matchCount ? s.winRate : '—',
      kd: s.matchCount ? (useKda ? s.kda : s.kd) : '—',
      wins: s.winCount,
      reports: rangeReports,
    };
  });

  readonly hasWeekData = computed(() => this.weekMatches().length > 0);

  readonly reportsInRange = computed(() => {
    const range = this.analysisRange.range();
    const day = this.analysisRange.selectedDayIso();
    const matchIds = new Set(this.weekMatches().map((m) => m.matchId));
    return this.reports().filter((report) => {
      if (matchIds.has(report.matchId)) return true;
      return isoInAnalysisRange(report.createdAt, range, day);
    });
  });

  readonly reportCards = computed(() => {
    const matchesById = new Map(
      this.effectiveRecentMatches().map((m) => [m.matchId, m] as const),
    );
    const platform = this.activePlatform();

    return this.reportsInRange().map((report) => {
      const match = matchesById.get(report.matchId);
      const stats = match?.stats;
      const identity =
        stats?.agent?.trim() ||
        stats?.champion?.trim() ||
        stats?.mode?.trim() ||
        gamePlatformMeta(platform).shortLabel;
      const artUrl =
        platform === 'valorant'
          ? valorantAgentSplashUrl(stats?.agent) ?? gamePlatformMeta('valorant').artUrl
          : platform === 'league_of_legends'
            ? lolChampionSplashUrl(stats?.champion) ??
              gamePlatformMeta('league_of_legends').artUrl
            : gamePlatformMeta(platform).artUrl;

      return {
        matchId: report.matchId,
        status: report.status,
        gradeLabel: report.gradeLabel,
        performanceScore: report.performanceScore,
        headline: report.headline || 'Análisis de partida',
        summary: report.summary,
        focus: report.actionPlan?.[0] ?? '',
        identity,
        artUrl,
        relativeTime: formatMatchRelativeTime(report.createdAt),
      };
    });
  });

  readonly weeklyCoach = computed(() => {
    const platform = this.activePlatform();
    return buildWeeklyAiCoachSummary({
      platform,
      weekMatches: this.weekMatches(),
      latestAiReport: this.latestAiReport(),
      communityBenchmarks:
        this.communityBenchmarksApi() ?? MOCK_COMMUNITY_BENCHMARKS[platform],
      kdLabel: this.kdLabel(),
    });
  });

  readonly weeklyCommunityRank = computed(() => {
    const summary = this.weekSummary();
    const kd =
      summary.totalDeaths > 0
        ? summary.totalKills / summary.totalDeaths
        : summary.totalKills;
    const winRate =
      summary.matchCount > 0 ? (summary.winCount / summary.matchCount) * 100 : 0;
    return buildWeeklyCommunityRankView({
      platform: this.activePlatform(),
      userId: this.auth.userId(),
      apiRows: this.communityLeaderboardApi(),
      sampleSize: this.communityBenchmarksApi()?.sampleSize ?? null,
      radius: 14,
      self: {
        gamerTag: this.profile()?.gamerTag || 'Vos',
        avatarUrl: this.profile()?.avatarUrl ?? undefined,
        kd,
        winRate,
        kills: summary.totalKills,
        deaths: summary.totalDeaths,
        assists: summary.totalAssists,
        matches: summary.matchCount,
        winCount: summary.winCount,
      },
    });
  });

  ngOnInit(): void {
    void this.load();
  }

  constructor() {
    effect(
      () => {
        this.activePlatform();
        this.heroArtFailed.set(false);
      },
      { allowSignalWrites: true },
    );
    effect(() => {
      if (this.gameContext.refreshTick() === 0) return;
      void this.load();
    });
  }

  onHeroArtError(): void {
    this.heroArtFailed.set(true);
  }

  onAnalysisRangeChange(id: AnalysisRangeId): void {
    this.analysisRange.setRange(id);
    void this.refreshRangeLeaderboard();
  }

  onAnalysisDayChange(dayIso: string): void {
    this.analysisRange.setDay(dayIso);
    void this.refreshRangeLeaderboard();
  }

  detailLink(matchId: string): string {
    return matchDetailRoute(matchId);
  }

  goToMatches(): void {
    void this.router.navigateByUrl('/tabs/matches');
  }

  goToEvolution(): void {
    void this.router.navigateByUrl('/tabs/analytics');
  }

  private async refreshRangeLeaderboard(): Promise<void> {
    const platform = matchBackendPlatform(this.activePlatform());
    this.communityLeaderboardApi.set(await this.loadRangeLeaderboard(platform));
  }

  private async loadRangeLeaderboard(
    platform: ReturnType<typeof matchBackendPlatform>,
  ): Promise<LeaderboardEntryView[]> {
    const range = this.rangeMeta();
    const boardPlatform = platform ?? 'fortnite';
    const periodIds = range.isSingleDay
      ? [isoWeeklyPeriodIdForDay(this.analysisRange.selectedDayIso())]
      : listRecentWeeklyPeriodIds(analysisRangeWeekSpan(range.id));
    const boards = await Promise.all(
      periodIds.map((id) =>
        firstValueFrom(
          this.statsService.listWeeklyLeaderboard(boardPlatform, id, 40),
        ).catch(() => [] as LeaderboardEntryView[]),
      ),
    );
    return mergeLeaderboardsAcrossPeriods(boards);
  }

  private async load(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) {
      this.loading.set(false);
      this.error.set('Iniciá sesión para ver el Coach IA.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const profile = await this.playerService.getPlayerProfileOrNull(userId).catch(() => null);
      this.profile.set(profile);

      const uiGame: SelectedGame =
        this.gameContext.activeGame() ??
        selectedGameFromBackend(profile?.primaryPlatform) ??
        'fortnite';
      const platform = matchBackendPlatform(uiGame);
      const periodId = currentWeeklyPeriodIdForStats();
      const range = this.rangeMeta();
      const matchLimit =
        range.id === 'all' ? 150 : Math.min(150, Math.max(50, range.days + 40));

      const [reports, matches, weeklyRows, community, leaderboard] = await Promise.all([
        this.matchAi
          .listMatchAiReportsOnce(userId, { platform: platform ?? undefined, limit: 30 })
          .catch(() => [] as MatchAiReportView[]),
        this.matchService
          .listPlayerMatchesOnce(userId, { platform: platform ?? undefined, limit: matchLimit })
          .catch(() => [] as MatchUpdateView[]),
        firstValueFrom(
          this.statsService.listPlayerStatsRollups(userId, 'WEEKLY', periodId, platform),
        ).catch(() => [] as PlayerStatsRollupView[]),
        firstValueFrom(
          this.statsService.getCommunityBenchmarks(platform ?? 'fortnite', periodId),
        ).catch(() => null),
        this.loadRangeLeaderboard(platform),
      ]);

      this.recentMatches.set(matches);
      this.weekly.set(weeklyRows[0] ?? null);
      this.communityLeaderboardApi.set(leaderboard);

      const readyOrFailed = reports.filter(
        (row) => row.status === 'ready' || row.status === 'failed',
      );
      this.reports.set(readyOrFailed);
      this.latestAiReport.set(
        reports.find((row) => row.status === 'ready') ?? reports[0] ?? null,
      );

      if (community && community.sampleSize > 0) {
        this.communityBenchmarksApi.set(
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
      } else {
        this.communityBenchmarksApi.set(null);
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error cargando reportes IA');
    } finally {
      this.loading.set(false);
    }
  }
}
