import { Component, OnDestroy, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { Subscription, firstValueFrom } from 'rxjs';
import {
  MOCK_COMMUNITY_BENCHMARKS,
  type CommunityRankTableView,
} from '../../data/community-mock.data';
import {
  buildMockMatchHistory,
  filterMockMatchesByPlatform,
} from '../../data/match-mock.data';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { lolEvolutionBannerSplashUrl } from '../../core/game/lol-ddragon.util';
import {
  matchBackendPlatform,
  selectedGameFromBackend,
  type SelectedGame,
} from '../../core/game/selected-game';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService } from '../../services/player.service';
import {
  EvolutionAiService,
  type EvolutionAiReportView,
} from '../../services/evolution-ai.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  previousWeeklyPeriodIdForStats,
  type LeaderboardEntryView,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import type { CommunityBenchmarks } from '../../data/community-mock.data';
import {
  buildDailyTrendFromMatches,
  buildKdCumulativeTrend,
  buildPlacementTrend,
} from '../../core/charts/stats-chart.util';
import {
  CommunityComparisonPanelComponent,
  CommunityRankTableComponent,
  DailyStatsTableComponent,
  EvolutionAiReportPanelComponent,
  PeerBenchmarkPanelComponent,
  StatValueComponent,
  WeekHeroBrandComponent,
  StatsComparisonChartComponent,
  StatsRadarChartComponent,
  TrendChartComponent,
  WeekComparisonPanelComponent,
  type DailyStatsTableRow,
  type LeaderboardEntry,
  type PeerBenchmarkPoint,
  type StatsComparisonRow,
  type TrendChartPoint,
} from '../../ui';
import {
  aggregateMatchStats,
  buildWeekComparison,
  computeKdRatio,
  computePlayStreakFromDailyTrend,
  filterMatchesInDayRange,
  filterMatchesWithinDays,
  isMatchWin,
} from '../../utils/match-stats.util';
import { aggregatePlatformMatchStats } from '../../utils/platform-stats.util';
import {
  buildCommunityComparison,
  formatCommunitySampleSize,
  mapCommunityBenchmarksFromApi,
  parsePlayerKdForCommunity,
  parsePlayerWinRateForCommunity,
  summarizeCommunityComparison,
} from '../../utils/community-stats.util';
import { extractGraphqlErrorMessage } from '../../utils/graphql-error.util';
import { buildWeeklyCommunityRankView } from '../../utils/weekly-community-rank.util';

@Component({
  standalone: true,
  selector: 'app-analytics-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    StatValueComponent,
    WeekHeroBrandComponent,
    TrendChartComponent,
    StatsRadarChartComponent,
    WeekComparisonPanelComponent,
    CommunityComparisonPanelComponent,
    CommunityRankTableComponent,
    StatsComparisonChartComponent,
    PeerBenchmarkPanelComponent,
    EvolutionAiReportPanelComponent,
    DailyStatsTableComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <div class="sg-analytics-page" [attr.data-game]="activePlatform()">
        <section
          class="sg-dashboard__week sg-analytics__hero"
          [attr.data-game]="activePlatform()"
          aria-label="Evolución"
        >
          <img
            class="sg-dashboard__week-art sg-analytics__hero-art"
            [src]="heroArtSrc()"
            [alt]="platformMeta().label + ' art'"
            (error)="onHeroArtError()"
          />
          <div class="sg-dashboard__week-veil" aria-hidden="true"></div>

          <div class="sg-dashboard__week-inner">
            <sg-week-hero-brand [platform]="activePlatform()" />
            <div class="sg-dashboard__week-main">
              <p class="sg-dashboard__week-eyebrow">
                {{ platformMeta().label }} · Tendencias
                @if (communityUsesMock()) {
                  <span>· preview</span>
                }
              </p>
              <h1 class="sg-dashboard__week-title">Evolución</h1>
              <p class="sg-dashboard__week-lede u-m-0">
                Cómo cambió tu forma esta semana: KPIs, curvas diarias y tu lugar entre jugadores
                reales. El historial de partidas está en Partidas.
              </p>

              <div class="sg-dashboard__week-kpis" aria-label="KPIs semanales">
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ platformWeekSummary().winRate }}</span>
                  <span class="sg-dashboard__week-kpi-label">Win rate</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKd() }}</span>
                  <span class="sg-dashboard__week-kpi-label">{{ kdLabel() }}</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ platformWeekSummary().winCount }}</span>
                  <span class="sg-dashboard__week-kpi-label">Victorias</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ weekMatchCount() }}</span>
                  <span class="sg-dashboard__week-kpi-label">Partidas</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ killsPerGameLabel() }}</span>
                  <span class="sg-dashboard__week-kpi-label">{{ analyticsKillLabel() }}/p</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ communityOverallTop() }}</span>
                  <span class="sg-dashboard__week-kpi-label">Vs comunidad</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="sg-analytics__body page-shell page-shell--fluid sg-analytics u-flex u-flex-col u-gap-6">
        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        @if (showEmptyHint()) {
          <section class="u-surface-card u-p-5">
            <p class="u-hint u-m-0">
              Sin estadísticas todavía. Cargá mock data con tu User ID (Config):
              <code class="sg-code-block u-mt-2">npm run seed:mock -- --user-id TU_USER_ID</code>
            </p>
          </section>
        }

        <section class="sg-dashboard__block" aria-label="Informe IA de evolución">
          <sg-evolution-ai-report-panel
            title="Informe IA de la semana"
            [subtitle]="evolutionAiSubtitle()"
            [report]="evolutionAiReport()"
            [loading]="evolutionAiLoading()"
            (generate)="onRequestEvolutionAi(false)"
            (regenerate)="onRequestEvolutionAi(true)"
          />
        </section>

        <section class="sg-dashboard__block" aria-labelledby="analytics-overview">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-overview" class="sg-dashboard__block-title">Números de la semana</h2>
              <p class="sg-dashboard__block-desc">
                Totales de los últimos 7 días en {{ platformMeta().shortLabel }}. El hero arriba
                muestra el resumen rápido; acá está el desglose completo.
                @if (communityUsesMock()) {
                  <span class="sg-analytics__badge">preview</span>
                }
              </p>
            </div>
          </div>

          <div class="u-surface-card u-p-5 sg-analytics__kpi-card">
            <div class="u-grid-stats sg-analytics__kpi-grid">
              <sg-stat-value label="Partidas" [value]="weekMatchCount()" accent="lime" />
              <sg-stat-value label="Win rate" [value]="platformWeekSummary().winRate" accent="lime" />
              <sg-stat-value label="Victorias" [value]="platformWeekSummary().winCount" accent="lime" />
              <sg-stat-value [label]="kdLabel()" [value]="heroKd()" accent="lime" />
              <sg-stat-value label="K/D" [value]="platformWeekSummary().kd" accent="lime" />
              <sg-stat-value [label]="analyticsKillLabel()" [value]="platformWeekSummary().totalKills" accent="lime" />
              <sg-stat-value label="Muertes" [value]="platformWeekSummary().totalDeaths" accent="lime" />
              <sg-stat-value label="Asistencias" [value]="platformWeekSummary().totalAssists" accent="lime" />
              <sg-stat-value [label]="analyticsKillLabel() + '/partida'" [value]="killsPerGameLabel()" accent="lime" />
              <sg-stat-value label="Mejor que %" [value]="communityOverallPct()" accent="lime" />
              <sg-stat-value label="Puesto muestra" [value]="communityRankLabel()" accent="gold" />
              @if (showValCs2Extras()) {
                <sg-stat-value label="HS%" [value]="platformWeekSummary().avgHeadshotPct" accent="lime" />
              }
              @if (showValorantExtras()) {
                <sg-stat-value label="ACS" [value]="platformWeekSummary().avgScore" accent="lime" />
              }
              @if (showLolExtras()) {
                <sg-stat-value label="CS medio" [value]="platformWeekSummary().avgCs" accent="lime" />
                <sg-stat-value label="Visión" [value]="platformWeekSummary().avgVision" accent="lime" />
              }
              @if (showCs2Extras()) {
                <sg-stat-value label="ADR" [value]="platformWeekSummary().avgAdr" accent="lime" />
              }
              @if (showRlExtras()) {
                <sg-stat-value label="Saves" [value]="platformWeekSummary().totalSaves" accent="lime" />
                <sg-stat-value label="Shot %" [value]="platformWeekSummary().avgShotPct" accent="lime" />
              }
              @if (showFortniteExtras()) {
                <sg-stat-value label="Placement medio" [value]="avgPlacementLabel()" accent="lime" />
              }
              <sg-stat-value label="Racha días" [value]="playStreak()" accent="lime" />
            </div>
          </div>
        </section>

        <section class="sg-dashboard__block sg-analytics__section" aria-labelledby="analytics-compare-week">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-compare-week" class="sg-dashboard__block-title">Compará tu semana</h2>
              <p class="sg-dashboard__block-desc">
                Izquierda: subiste o bajaste vs la semana pasada. Derecha: tus KPIs frente al
                promedio de la muestra (no percentiles).
              </p>
            </div>
          </div>

          <div class="sg-analytics__compare-grid">
            <sg-week-comparison-panel
              title="Esta semana vs la anterior"
              subtitle="Delta de partidas, kills y resultados respecto a los 7 días previos."
              [items]="weekComparison()"
            />

            <sg-stats-comparison-chart
              title="Vos vs promedio de la muestra"
              subtitle="Barras: tu valor semanal (oro) frente a la media de la comunidad (gris)."
              [rows]="communityChartRows()"
            />
          </div>
        </section>

        <section class="sg-dashboard__block" aria-labelledby="analytics-trends">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-trends" class="sg-dashboard__block-title">Curvas diarias</h2>
              <p class="sg-dashboard__block-desc">
                Cada gráfico muestra un KPI por día de la semana. Sirve para ver picos,
                rachas y días flojos — no es el ranking de jugadores.
              </p>
            </div>
          </div>

          <div class="sg-analytics-charts">
            <sg-trend-chart
              [title]="analyticsKillLabel() + ' por día'"
              subtitle="Volumen ofensivo diario."
              unit="kills"
              variant="area"
              color="#f0d060"
              areaColor="rgba(240, 208, 96, 0.22)"
              [points]="killsTrend()"
            />
            <sg-trend-chart
              title="Partidas por día"
              subtitle="Cuántas partidas jugaste cada día."
              unit="matches"
              variant="bar"
              color="#c89b3c"
              areaColor="rgba(200, 155, 60, 0.28)"
              [points]="matchesTrend()"
            />
            <sg-trend-chart
              title="Muertes por día"
              subtitle="Cuántas veces caíste; menos suele ser mejor."
              unit="deaths"
              variant="bar"
              color="#e8a0b0"
              areaColor="rgba(232, 160, 176, 0.22)"
              [points]="deathsTrend()"
            />
            <sg-trend-chart
              title="Victorias por día"
              subtitle="Wins diarias en la ventana semanal."
              unit="wins"
              variant="bar"
              color="#f0d060"
              areaColor="rgba(240, 208, 96, 0.2)"
              [points]="winsTrend()"
            />
            <sg-trend-chart
              title="Win rate diario"
              subtitle="% de partidas ganadas ese día."
              unit="%"
              variant="line"
              color="#f0d060"
              areaColor="rgba(240, 208, 96, 0.18)"
              [points]="winRateTrend()"
            />
            <sg-trend-chart
              title="Asistencias por día"
              subtitle="Impacto de apoyo / teamfight por día."
              unit="assists"
              variant="area"
              color="#c89b3c"
              areaColor="rgba(200, 155, 60, 0.22)"
              [points]="assistsTrend()"
            />
            <sg-trend-chart
              [title]="kdLabel() + ' acumulado'"
              subtitle="Ratio acumulado a lo largo de la semana."
              unit="ratio"
              variant="line"
              color="#f5d075"
              areaColor="rgba(245, 208, 117, 0.2)"
              [points]="kdTrend()"
            />
            @if (showFortniteExtras()) {
              <sg-trend-chart
                title="Placement medio"
                subtitle="Puesto medio por día (más bajo = mejor)."
                unit="puesto"
                variant="area"
                color="#e8a0b0"
                areaColor="rgba(232, 160, 176, 0.18)"
                [points]="placementTrend()"
              />
            }
            <div class="sg-analytics-charts__radar">
              <sg-stats-radar-chart
                title="Perfil semanal (radar)"
                subtitle="Forma normalizada 0–100 frente a objetivos de la semana. Más área = mejor balance."
                [weekly]="weeklyForCharts()"
                [dailyTrend]="chartDailyTrend()"
              />
            </div>
          </div>
        </section>

        <section class="sg-dashboard__block" aria-labelledby="analytics-table">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-table" class="sg-dashboard__block-title">Tabla día a día</h2>
              <p class="sg-dashboard__block-desc">
                Los mismos datos de las curvas, en números. Útil para contrastar un día puntual.
              </p>
            </div>
          </div>

          <sg-daily-stats-table
            title="Desglose numérico por día"
            subtitle="Partidas, kills, muertes y ratio de cada día con actividad."
            [footnote]="dailyTableFootnote()"
            [rows]="dailyTableRows()"
            [totals]="dailyTableTotals()"
          />
        </section>

        <section class="sg-dashboard__block" aria-labelledby="analytics-community">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-community" class="sg-dashboard__block-title">Tu lugar en la comunidad</h2>
              <p class="sg-dashboard__block-desc">
                Jugadores reales de la muestra semanal: tabla de puestos, gráficos vs peers y
                percentiles (qué % de la muestra superás).
              </p>
            </div>
          </div>

          <div class="sg-analytics__community-stack">
            @if (communityRank(); as rank) {
              <sg-community-rank-table
                variant="deep"
                title="Tabla de jugadores de la muestra"
                [deepLink]="null"
                [platform]="activePlatform()"
                [rows]="rank.rows"
                [yourRank]="rank.yourRank"
                [totalPlayers]="rank.totalPlayers"
                [sampleLabel]="communitySampleLabel()"
                [subtitle]="communityRankSubtitle()"
              />
            } @else {
              <aside class="sg-weekly-coach__empty-rank" role="status">
                <p class="sg-weekly-coach__empty-rank-title u-m-0">
                  Todavía no hay peers reales esta semana
                </p>
                <p class="sg-weekly-coach__empty-rank-body u-m-0">
                  Sin leaderboard semanal no hay rivales inventados: la tabla y los gráficos
                  aparecen cuando hay jugadores reales en la muestra.
                </p>
              </aside>
            }

            <sg-peer-benchmark-panel
              title="Vos entre peers (gráficos)"
              subtitle="Misma muestra que la tabla: mapa WR×KDA y barras de score. No es el promedio abstracto de arriba."
              [sampleLabel]="communitySampleLabel()"
              [peers]="peerBenchmarkPoints()"
            />

            <sg-community-comparison-panel
              title="Tus percentiles por métrica"
              subtitle="Por cada KPI: top %, cuánto de la muestra superás y dónde queda el promedio."
              [items]="communityComparison()"
              [sampleLabel]="communitySampleLabel()"
              [disclaimer]="communityDisclaimer()"
            />
          </div>
        </section>
        </div>
      </div>
    </ion-content>
  `,
})
export class AnalyticsPageComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
  private readonly statsService = inject(StatsService);
  private readonly matchService = inject(MatchService);
  private readonly playerService = inject(PlayerService);
  private readonly evolutionAi = inject(EvolutionAiService);
  private evolutionReadySub: Subscription | null = null;

  readonly weekly = signal<PlayerStatsRollupView | null>(null);
  readonly previousWeekly = signal<PlayerStatsRollupView | null>(null);
  readonly dailyTrend = signal<PlayerStatsRollupView[]>([]);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly gamerTag = signal('');
  readonly avatarUrl = signal<string | undefined>(undefined);
  readonly communityBenchmarksApi = signal<CommunityBenchmarks | null>(null);
  readonly leaderboardApi = signal<LeaderboardEntryView[]>([]);
  readonly communityUsesMock = signal(true);
  readonly evolutionAiReport = signal<EvolutionAiReportView | null>(null);
  readonly evolutionAiLoading = signal(false);
  readonly error = signal<string | null>(null);
  private readonly heroArtFailed = signal(false);

  readonly activePlatform = computed((): SelectedGame => this.gameContext.activeGame() ?? 'fortnite');

  readonly platformMeta = computed(() => gamePlatformMeta(this.activePlatform()));

  readonly evolutionAiSubtitle = computed(() => {
    const periodId = currentWeeklyPeriodIdForStats();
    return `${this.platformMeta().label} · ${periodId} · lectura macro de tu progreso (guardada en historial)`;
  });

  readonly heroArtSrc = computed(() => {
    const meta = this.platformMeta();
    if (this.heroArtFailed()) {
      return meta.portraitFallbackUrl || meta.artUrl;
    }
    if (this.activePlatform() === 'league_of_legends') {
      const seed = (this.gamerTag() || this.auth.userId() || 'lol-evo').length + 17;
      return lolEvolutionBannerSplashUrl(seed);
    }
    return meta.portraitUrl || meta.artUrl;
  });

  readonly kdLabel = computed(() => {
    const p = this.activePlatform();
    return p === 'valorant' ||
      p === 'league_of_legends' ||
      p === 'dota2' ||
      p === 'overwatch2'
      ? 'KDA'
      : 'K/D';
  });

  /** KDA real en LoL-like; K/D en el resto. */
  readonly heroKd = computed(() => {
    const s = this.platformWeekSummary();
    if (!s.matchCount) return '—';
    return this.kdLabel() === 'KDA' ? s.kda : s.kd;
  });

  onHeroArtError(): void {
    this.heroArtFailed.set(true);
  }

  readonly effectiveRecentMatches = computed(() => {
    const userId = this.auth.userId() ?? 'mock-user-demo';
    const platform = this.activePlatform();
    const api = this.recentMatches();
    const source = api.length > 0 ? api : buildMockMatchHistory(userId);
    return filterMockMatchesByPlatform(source, platform);
  });

  readonly weekMatches = computed(() =>
    filterMatchesWithinDays(this.effectiveRecentMatches(), 7),
  );

  readonly previousWeekMatches = computed(() =>
    filterMatchesInDayRange(this.effectiveRecentMatches(), 7, 14),
  );

  readonly weekSummary = computed(() => aggregateMatchStats(this.weekMatches()));

  readonly platformWeekSummary = computed(() =>
    aggregatePlatformMatchStats(this.weekMatches()),
  );

  readonly previousWeekSummary = computed(() =>
    aggregateMatchStats(this.previousWeekMatches()),
  );

  analyticsKillLabel(): string {
    return this.activePlatform() === 'rocket_league' ? 'Goles' : 'Kills';
  }

  showValorantExtras(): boolean {
    return this.activePlatform() === 'valorant';
  }

  showLolExtras(): boolean {
    return this.activePlatform() === 'league_of_legends';
  }

  showCs2Extras(): boolean {
    return this.activePlatform() === 'cs2';
  }

  showValCs2Extras(): boolean {
    const p = this.activePlatform();
    return p === 'valorant' || p === 'cs2';
  }

  showRlExtras(): boolean {
    return this.activePlatform() === 'rocket_league';
  }

  showFortniteExtras(): boolean {
    return this.activePlatform() === 'fortnite';
  }

  readonly chartDailyTrend = computed(() => {
    const api = this.dailyTrend();
    const hasSignal = api.some((day) => day.matchCount > 0 || day.totalKills > 0);
    if (hasSignal) return api;
    const userId = this.auth.userId() ?? 'mock-user-demo';
    return buildDailyTrendFromMatches(this.weekMatches(), userId, this.activePlatform(), 7);
  });

  readonly weeklyForCharts = computed(() => {
    const w = this.weekly();
    if (w && w.matchCount > 0) return w;
    const summary = this.weekSummary();
    if (summary.matchCount === 0) return w;
    const avgPlacement = Number.parseFloat(summary.avgPlacement);
    return {
      userId: this.auth.userId() ?? '',
      platform: this.activePlatform(),
      granularity: 'WEEKLY',
      periodId: 'derived',
      matchCount: summary.matchCount,
      totalKills: summary.totalKills,
      totalDeaths: summary.totalDeaths,
      avgPlacement: Number.isFinite(avgPlacement) ? avgPlacement : 0,
      lastUpdatedIso: '',
    } satisfies PlayerStatsRollupView;
  });

  readonly weeklyKd = computed(() => {
    const w = this.weekly();
    if (w && w.matchCount > 0) {
      return computeKdRatio(w.totalKills, w.totalDeaths);
    }
    const summary = this.weekSummary();
    if (summary.matchCount > 0) {
      return computeKdRatio(summary.totalKills, summary.totalDeaths);
    }
    return '—';
  });

  readonly weekKills = computed(() => this.weekly()?.totalKills ?? this.weekSummary().totalKills);

  readonly weekDeaths = computed(
    () => this.weekly()?.totalDeaths ?? this.weekSummary().totalDeaths,
  );

  readonly weekMatchCount = computed(
    () => this.weekly()?.matchCount ?? this.weekSummary().matchCount,
  );

  readonly avgPlacementLabel = computed(() => {
    const fromWeekly = this.weekly()?.avgPlacement;
    if (fromWeekly && fromWeekly > 0) return fromWeekly.toFixed(1);
    const fromSummary = this.weekSummary().avgPlacement;
    return fromSummary && fromSummary !== '—' ? fromSummary : '—';
  });

  readonly playStreak = computed(() =>
    computePlayStreakFromDailyTrend(this.chartDailyTrend()),
  );

  readonly weekComparison = computed(() =>
    buildWeekComparison({
      currentWeekly: this.weeklyForCharts(),
      previousWeekly: this.previousWeekly() ?? {
        matchCount: this.previousWeekSummary().matchCount,
        totalKills: this.previousWeekSummary().totalKills,
        totalDeaths: this.previousWeekSummary().totalDeaths,
      },
      currentWins: this.weekSummary().winCount,
      previousWins: this.previousWeekSummary().winCount,
    }),
  );

  readonly communityComparison = computed(() => {
    const platform = this.activePlatform();
    const benchmarks =
      this.communityBenchmarksApi() ?? MOCK_COMMUNITY_BENCHMARKS[platform];
    const summary = this.weekSummary();
    const platformSummary = this.platformWeekSummary();
    const weekly = this.weeklyForCharts();
    const matchCount =
      weekly?.matchCount || summary.matchCount || platformSummary.matchCount;
    const kills = weekly?.totalKills || summary.totalKills || platformSummary.totalKills;
    const useKda =
      platform === 'valorant' ||
      platform === 'league_of_legends' ||
      platform === 'dota2';
    const kd = useKda ? platformSummary.kda : this.weeklyKd();
    const winRate = platformSummary.winRate || summary.winRate;
    const winRateNumeric =
      parsePlayerWinRateForCommunity(winRate) ??
      (matchCount > 0
        ? Math.round((platformSummary.winCount / matchCount) * 100)
        : null);
    const kdNumeric =
      parsePlayerKdForCommunity(kd) ??
      (matchCount > 0
        ? Number(
            (
              platformSummary.totalKills /
              Math.max(platformSummary.totalDeaths, 1)
            ).toFixed(2),
          )
        : null);

    return buildCommunityComparison({
      benchmarks,
      winRate,
      winRateNumeric,
      kd,
      kdNumeric,
      kills,
      matchCount,
      kdLabel: useKda ? 'KDA' : 'K/D',
      killsLabel:
        platform === 'rocket_league'
          ? 'Goles / semana'
          : platform === 'fortnite'
            ? 'Elims / semana'
            : 'Kills / semana',
    });
  });

  readonly communityChartRows = computed<StatsComparisonRow[]>(() => {
    const platform = this.activePlatform();
    const benchmarks =
      this.communityBenchmarksApi() ?? MOCK_COMMUNITY_BENCHMARKS[platform];
    const useKda = platform === 'valorant' || platform === 'league_of_legends';
    const kdRaw = useKda
      ? parsePlayerKdForCommunity(this.platformWeekSummary().kda)
      : parsePlayerKdForCommunity(this.weeklyKd());
    const kd = kdRaw ?? 0;
    const wr = parsePlayerWinRateForCommunity(this.platformWeekSummary().winRate) ?? 0;
    const kdLabel = useKda ? 'KDA' : 'K/D';
    const killsLabel =
      platform === 'rocket_league' ? 'Goles' : platform === 'fortnite' ? 'Elims' : 'Kills';

    const matches = this.weekMatchCount();
    const killsPerGame = matches > 0 ? this.weekKills() / matches : 0;
    const benchKpg =
      benchmarks.avgMatchesPerWeek > 0
        ? benchmarks.avgKillsPerWeek / benchmarks.avgMatchesPerWeek
        : 0;
    const summary = this.platformWeekSummary();

    return [
      { label: kdLabel, you: Number(kd.toFixed(2)), benchmark: Number(benchmarks.avgKd.toFixed(2)) },
      {
        label: 'Win rate %',
        you: Number(wr.toFixed(1)),
        benchmark: Number(benchmarks.avgWinRate.toFixed(1)),
      },
      {
        label: killsLabel,
        you: this.weekKills(),
        benchmark: Math.round(benchmarks.avgKillsPerWeek),
      },
      {
        label: `${killsLabel}/p`,
        you: Number(killsPerGame.toFixed(1)),
        benchmark: Number(benchKpg.toFixed(1)),
      },
      {
        label: 'Partidas',
        you: matches,
        benchmark: Math.round(benchmarks.avgMatchesPerWeek),
      },
      {
        label: 'Muertes',
        you: summary.totalDeaths,
        benchmark: Math.round(
          Math.max(1, benchmarks.avgKillsPerWeek / Math.max(benchmarks.avgKd, 0.5)),
        ),
      },
      {
        label: 'Asistencias',
        you: summary.totalAssists,
        benchmark: Math.round(benchmarks.avgKillsPerWeek * 0.85),
      },
    ];
  });

  readonly communitySampleLabel = computed(() => {
    const platform = this.activePlatform();
    const benchmarks =
      this.communityBenchmarksApi() ?? MOCK_COMMUNITY_BENCHMARKS[platform];
    const label = gamePlatformMeta(platform).label;
    return `${label} · ${formatCommunitySampleSize(benchmarks.sampleSize)} jugadores`;
  });

  readonly communityDisclaimer = computed(() =>
    this.communityUsesMock()
      ? 'Datos de comunidad en preview (mock). Ejecutá seed:mock y desplegá el backend para datos reales.'
      : 'Percentiles calculados vs jugadores activos de tu plataforma esta semana.',
  );

  readonly communityRank = computed<CommunityRankTableView | null>(() => {
    const summary = this.weekSummary();
    const weekly = this.weeklyForCharts();
    const kd = parsePlayerKdForCommunity(this.weeklyKd()) ?? 1.0;
    const winRate = parsePlayerWinRateForCommunity(summary.winRate) ?? 0;
    const kills = weekly?.totalKills || summary.totalKills || 0;
    const matches = weekly?.matchCount || summary.matchCount || 0;

    return buildWeeklyCommunityRankView({
      platform: this.activePlatform(),
      userId: this.auth.userId(),
      apiRows: this.leaderboardApi(),
      sampleSize: this.communityBenchmarksApi()?.sampleSize ?? null,
      radius: 14,
      self: {
        gamerTag: this.gamerTag() || 'Vos',
        avatarUrl: this.avatarUrl(),
        kd,
        winRate,
        kills,
        matches,
        winCount: summary.winCount,
      },
    });
  });

  readonly communityRankSubtitle = computed(() => {
    const rank = this.communityRank();
    const label = gamePlatformMeta(this.activePlatform()).label;
    if (!rank) return `${label} · sin peers reales esta semana`;
    return `${label} · estás #${rank.yourRank} de ${rank.totalPlayers}. Columnas: ratio, WR, K/D/A, score justo y cambio de puesto.`;
  });

  readonly leaderboardEntries = computed<LeaderboardEntry[]>(() =>
    this.leaderboardApi().map((entry) => ({
      rank: entry.rank,
      gamerTag:
        entry.gamerTag && entry.gamerTag !== entry.userId
          ? entry.gamerTag
          : `Jugador ${entry.rank}`,
      platform: selectedGameFromBackend(entry.platform, this.activePlatform()),
      score: entry.score,
      delta: entry.delta,
      trend:
        entry.trend === 'up' || entry.trend === 'down'
          ? entry.trend
          : 'flat',
    })),
  );

  readonly killsTrend = computed<TrendChartPoint[]>(() =>
    this.chartDailyTrend().map((d) => ({
      label: d.periodId.slice(5),
      value: d.totalKills,
    })),
  );

  readonly matchesTrend = computed<TrendChartPoint[]>(() =>
    this.chartDailyTrend().map((d) => ({
      label: d.periodId.slice(5),
      value: d.matchCount,
    })),
  );

  readonly kdTrend = computed<TrendChartPoint[]>(() =>
    buildKdCumulativeTrend(this.chartDailyTrend()),
  );

  readonly placementTrend = computed<TrendChartPoint[]>(() =>
    buildPlacementTrend(this.chartDailyTrend()),
  );

  readonly deathsTrend = computed<TrendChartPoint[]>(() =>
    this.chartDailyTrend().map((d) => ({
      label: d.periodId.slice(5),
      value: d.totalDeaths,
    })),
  );

  /** Agrega wins/assists/WR desde partidas reales alineadas al daily trend. */
  private readonly matchDayBuckets = computed(() => {
    const days = this.chartDailyTrend();
    const buckets = new Map<
      string,
      { wins: number; assists: number; matches: number }
    >();
    for (const day of days) {
      buckets.set(day.periodId, { wins: 0, assists: 0, matches: 0 });
    }
    for (const match of this.weekMatches()) {
      const stamp = new Date(match.updatedAt);
      if (Number.isNaN(stamp.getTime())) continue;
      const y = stamp.getFullYear();
      const m = String(stamp.getMonth() + 1).padStart(2, '0');
      const d = String(stamp.getDate()).padStart(2, '0');
      const periodId = `${y}-${m}-${d}`;
      const bucket = buckets.get(periodId);
      if (!bucket) continue;
      bucket.matches += 1;
      bucket.assists += match.stats?.assists ?? 0;
      if (isMatchWin(match.stats)) bucket.wins += 1;
    }
    return buckets;
  });

  readonly winsTrend = computed<TrendChartPoint[]>(() => {
    const buckets = this.matchDayBuckets();
    return this.chartDailyTrend().map((day) => ({
      label: day.periodId.slice(5),
      value: buckets.get(day.periodId)?.wins ?? 0,
    }));
  });

  readonly assistsTrend = computed<TrendChartPoint[]>(() => {
    const buckets = this.matchDayBuckets();
    return this.chartDailyTrend().map((day) => ({
      label: day.periodId.slice(5),
      value: buckets.get(day.periodId)?.assists ?? 0,
    }));
  });

  readonly winRateTrend = computed<TrendChartPoint[]>(() => {
    const buckets = this.matchDayBuckets();
    return this.chartDailyTrend().map((day) => {
      const bucket = buckets.get(day.periodId);
      const matches = bucket?.matches ?? day.matchCount;
      const wins = bucket?.wins ?? 0;
      return {
        label: day.periodId.slice(5),
        value: matches > 0 ? Math.round((wins / matches) * 100) : 0,
      };
    });
  });

  readonly killsPerGameLabel = computed(() => {
    const matches = this.weekMatchCount();
    if (matches <= 0) return '—';
    return (this.weekKills() / matches).toFixed(1);
  });

  readonly communityOverallSummary = computed(() =>
    summarizeCommunityComparison(this.communityComparison()),
  );

  readonly communityOverallTop = computed(
    () => this.communityOverallSummary()?.overallTopLabel ?? '—',
  );

  readonly communityOverallPct = computed(() => {
    const pct = this.communityOverallSummary()?.overallBetterThanPct;
    return pct == null ? '—' : `${pct}%`;
  });

  readonly communityRankLabel = computed(() => {
    const rank = this.communityRank();
    if (!rank?.yourRank) return '—';
    return `#${rank.yourRank}`;
  });

  readonly peerBenchmarkPoints = computed<PeerBenchmarkPoint[]>(() => {
    const userId = this.auth.userId();
    const youTag = this.gamerTag() || 'Vos';
    return this.leaderboardApi().map((entry) => {
      const isYou = entry.userId === userId;
      return {
        gamerTag: isYou
          ? youTag
          : entry.gamerTag && entry.gamerTag !== entry.userId
            ? entry.gamerTag
            : `Jugador ${entry.rank}`,
        kd: entry.kd,
        winRate: entry.winRate,
        score: entry.score,
        isYou,
      };
    });
  });

  readonly dailyTableRows = computed<DailyStatsTableRow[]>(() =>
    this.chartDailyTrend().map((day) => toDailyRow(day)),
  );

  readonly dailyTableTotals = computed<DailyStatsTableRow | null>(() => {
    const days = this.chartDailyTrend();
    if (!days.length) return null;
    const matchCount = days.reduce((sum, d) => sum + d.matchCount, 0);
    const kills = days.reduce((sum, d) => sum + d.totalKills, 0);
    const deaths = days.reduce((sum, d) => sum + d.totalDeaths, 0);
    const placementDays = days.filter((d) => d.avgPlacement > 0);
    const avgPlacement =
      placementDays.length > 0
        ? placementDays.reduce((sum, d) => sum + d.avgPlacement, 0) / placementDays.length
        : 0;

    return {
      periodId: 'total',
      label: 'Total',
      matchCount,
      kills,
      deaths,
      kd: computeKdRatio(kills, deaths),
      avgPlacement: avgPlacement > 0 ? avgPlacement.toFixed(1) : '—',
      killsPerMatch: matchCount > 0 ? (kills / matchCount).toFixed(1) : '—',
    };
  });

  readonly dailyTableFootnote = computed(() => {
    const active = this.chartDailyTrend().filter((d) => d.matchCount > 0).length;
    return `${active} día${active === 1 ? '' : 's'} con actividad · ${this.weekMatchCount()} partidas`;
  });

  readonly showEmptyHint = computed(
    () =>
      !this.error() &&
      this.weekMatchCount() === 0 &&
      this.chartDailyTrend().every((d) => d.matchCount === 0),
  );

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
      void this.loadStats();
    });
  }

  ngOnInit(): void {
    void this.loadStats();
  }

  ngOnDestroy(): void {
    this.evolutionReadySub?.unsubscribe();
  }

  async onRequestEvolutionAi(force: boolean): Promise<void> {
    const userId = this.auth.userId();
    const platform = matchBackendPlatform(this.activePlatform());
    if (!userId || !platform) return;
    this.evolutionAiLoading.set(true);
    try {
      const report = await this.evolutionAi.requestEvolutionAiReport({
        userId,
        platform,
        periodId: currentWeeklyPeriodIdForStats(),
        force,
      });
      this.evolutionAiReport.set(report);
      this.bindEvolutionReady(userId, platform, currentWeeklyPeriodIdForStats());
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err) ?? 'No se pudo pedir el informe IA.');
    } finally {
      this.evolutionAiLoading.set(false);
    }
  }

  private bindEvolutionReady(
    userId: string,
    platform: NonNullable<ReturnType<typeof matchBackendPlatform>>,
    periodId: string,
  ): void {
    this.evolutionReadySub?.unsubscribe();
    this.evolutionReadySub = this.evolutionAi.onEvolutionAiReady(userId).subscribe({
      next: (event) => {
        if (event.platform !== platform || event.periodId !== periodId) return;
        void this.evolutionAi
          .getEvolutionAiReport(userId, platform, periodId)
          .then((report) => this.evolutionAiReport.set(report))
          .catch(() => undefined);
      },
      error: () => undefined,
    });
  }

  private async loadStats(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    this.error.set(null);

    try {
      const uiGame = this.activePlatform();
      const platform = matchBackendPlatform(uiGame);
      const periodId = currentWeeklyPeriodIdForStats();

      const [profile, matches, weeklyRows, previousWeeklyRows, daily, community, leaderboard, evoReport] =
        await Promise.all([
          this.playerService.getPlayerProfileOrNull(userId).catch(() => null),
          this.matchService.listPlayerMatchesOnce(userId, { limit: 50 }).catch(() => [] as MatchUpdateView[]),
          firstValueFrom(
            this.statsService.listPlayerStatsRollups(userId, 'WEEKLY', periodId, platform),
          ),
          firstValueFrom(
            this.statsService.listPlayerStatsRollups(
              userId,
              'WEEKLY',
              previousWeeklyPeriodIdForStats(),
              platform,
            ),
          ),
          firstValueFrom(this.statsService.listPlayerDailyTrend(userId, platform, 7)),
          firstValueFrom(
            this.statsService.getCommunityBenchmarks(platform ?? 'fortnite', periodId),
          ).catch(() => null),
          firstValueFrom(
            this.statsService.listWeeklyLeaderboard(platform ?? 'fortnite', periodId, 40),
          ).catch(() => [] as LeaderboardEntryView[]),
          platform
            ? this.evolutionAi
                .getEvolutionAiReport(userId, platform, periodId)
                .catch(() => null)
            : Promise.resolve(null),
        ]);

      this.gamerTag.set(profile?.gamerTag ?? '');
      this.avatarUrl.set(profile?.avatarUrl ?? undefined);
      this.recentMatches.set(matches);
      this.weekly.set(weeklyRows[0] ?? null);
      this.previousWeekly.set(previousWeeklyRows[0] ?? null);
      this.dailyTrend.set(daily);
      this.evolutionAiReport.set(evoReport);

      if (platform) {
        if (!evoReport) {
          void this.onRequestEvolutionAi(false);
        } else if (evoReport.status === 'pending') {
          this.bindEvolutionReady(userId, platform, periodId);
        }
      }

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
        this.communityUsesMock.set(false);
      } else {
        this.communityBenchmarksApi.set(null);
        this.communityUsesMock.set(true);
      }

      this.leaderboardApi.set(leaderboard ?? []);
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err, 'Error cargando estadísticas'));
    }
  }
}

function toDailyRow(day: PlayerStatsRollupView): DailyStatsTableRow {
  return {
    periodId: day.periodId,
    label: day.periodId.slice(5),
    matchCount: day.matchCount,
    kills: day.totalKills,
    deaths: day.totalDeaths,
    kd: computeKdRatio(day.totalKills, day.totalDeaths),
    avgPlacement: day.avgPlacement > 0 ? day.avgPlacement.toFixed(1) : '—',
    killsPerMatch:
      day.matchCount > 0 ? (day.totalKills / day.matchCount).toFixed(1) : '—',
  };
}
