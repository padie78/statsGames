import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import {
  MOCK_COMMUNITY_BENCHMARKS,
  buildCommunityRankNeighborhood,
  mockLeaderboardForPlatform,
} from '../../data/community-mock.data';
import {
  buildMockMatchHistory,
  filterMockMatchesByPlatform,
} from '../../data/match-mock.data';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import {
  matchBackendPlatform,
  selectedGameFromBackend,
  type SelectedGame,
} from '../../core/game/selected-game';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService } from '../../services/player.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  previousWeeklyPeriodIdForStats,
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
  LeaderboardMiniComponent,
  MatchTrendsPanelComponent,
  PercentileGaugesComponent,
  PlatformPageBannerComponent,
  StatValueComponent,
  StatsComparisonChartComponent,
  StatsRadarChartComponent,
  TrendChartComponent,
  WeekComparisonPanelComponent,
  type DailyStatsTableRow,
  type LeaderboardEntry,
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
} from '../../utils/match-stats.util';
import { aggregatePlatformMatchStats } from '../../utils/platform-stats.util';
import {
  buildCommunityComparison,
  formatCommunitySampleSize,
  mapCommunityBenchmarksFromApi,
  parsePlayerKdForCommunity,
  parsePlayerWinRateForCommunity,
} from '../../utils/community-stats.util';
import { extractGraphqlErrorMessage } from '../../utils/graphql-error.util';

@Component({
  standalone: true,
  selector: 'app-analytics-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    PlatformPageBannerComponent,
    StatValueComponent,
    TrendChartComponent,
    StatsRadarChartComponent,
    WeekComparisonPanelComponent,
    CommunityComparisonPanelComponent,
    CommunityRankTableComponent,
    PercentileGaugesComponent,
    StatsComparisonChartComponent,
    DailyStatsTableComponent,
    MatchTrendsPanelComponent,
    LeaderboardMiniComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid sg-analytics u-flex u-flex-col u-gap-6">
        <sg-platform-page-banner
          [platform]="activePlatform()"
          title="Evolución"
          subtitle="Tendencias, forma semanal y percentiles vs comunidad — no el historial de partidas."
        />

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

        <section class="sg-analytics__section" aria-labelledby="analytics-overview">
          <header class="sg-analytics__section-header">
            <h2 id="analytics-overview" class="sg-analytics__section-title">Resumen semanal</h2>
            <p class="sg-analytics__section-desc">
              {{ platformMeta().shortLabel }} · últimos 7 días
              @if (communityUsesMock()) {
                <span class="sg-analytics__badge">preview</span>
              }
            </p>
          </header>

          <div class="u-surface-card u-p-5">
            <div class="u-grid-stats sg-analytics__kpi-grid">
              <sg-stat-value label="Partidas" [value]="weekMatchCount()" />
              <sg-stat-value label="Win rate" [value]="platformWeekSummary().winRate" accent="lime" />
              <sg-stat-value label="Victorias" [value]="platformWeekSummary().winCount" accent="lime" />
              <sg-stat-value label="KDA" [value]="platformWeekSummary().kda" accent="purple" />
              <sg-stat-value label="K/D" [value]="platformWeekSummary().kd" accent="cyan" />
              <sg-stat-value [label]="analyticsKillLabel()" [value]="platformWeekSummary().totalKills" accent="cyan" />
              @if (showValCs2Extras()) {
                <sg-stat-value label="HS%" [value]="platformWeekSummary().avgHeadshotPct" accent="lime" />
              }
              @if (showValorantExtras()) {
                <sg-stat-value label="ACS" [value]="platformWeekSummary().avgScore" accent="cyan" />
              }
              @if (showLolExtras()) {
                <sg-stat-value label="CS medio" [value]="platformWeekSummary().avgCs" accent="cyan" />
                <sg-stat-value label="Visión" [value]="platformWeekSummary().avgVision" accent="purple" />
              }
              @if (showCs2Extras()) {
                <sg-stat-value label="ADR" [value]="platformWeekSummary().avgAdr" accent="cyan" />
              }
              @if (showRlExtras()) {
                <sg-stat-value label="Saves" [value]="platformWeekSummary().totalSaves" accent="cyan" />
                <sg-stat-value label="Shot %" [value]="platformWeekSummary().avgShotPct" />
              }
              @if (showFortniteExtras()) {
                <sg-stat-value label="Placement medio" [value]="avgPlacementLabel()" />
              }
              <sg-stat-value label="Racha días" [value]="playStreak()" accent="cyan" />
            </div>
          </div>
        </section>

        <section class="sg-analytics__section" aria-labelledby="analytics-compare-week">
          <header class="sg-analytics__section-header">
            <h2 id="analytics-compare-week" class="sg-analytics__section-title">Comparaciones</h2>
            <p class="sg-analytics__section-desc">
              Semana actual vs anterior, y vos vs el promedio de la comunidad.
            </p>
          </header>

          <div class="sg-analytics__compare-grid">
            <sg-week-comparison-panel
              title="Vs semana pasada"
              subtitle="Delta de KPIs clave respecto a los 7 días anteriores."
              [items]="weekComparison()"
            />

            <sg-stats-comparison-chart
              title="Vos vs comunidad"
              subtitle="Valores semanales frente al promedio de la muestra."
              [rows]="communityChartRows()"
            />
          </div>

          <sg-percentile-gauges
            title="Percentiles de un vistazo"
            subtitle="Qué tanto de la comunidad superás en cada KPI."
            [items]="communityComparison()"
          />
        </section>

        <section class="sg-analytics__section" aria-labelledby="analytics-trends">
          <header class="sg-analytics__section-header">
            <h2 id="analytics-trends" class="sg-analytics__section-title">Tendencias</h2>
            <p class="sg-analytics__section-desc">
              Actividad diaria, K/D acumulado y perfil normalizado.
            </p>
          </header>

          <div class="sg-analytics-charts">
            <sg-trend-chart
              title="Kills por día"
              unit="kills"
              variant="area"
              color="#b8ff3c"
              areaColor="rgba(184, 255, 60, 0.22)"
              [points]="killsTrend()"
            />
            <sg-trend-chart
              title="Partidas por día"
              unit="matches"
              variant="bar"
              color="#3de0f5"
              areaColor="rgba(61, 224, 245, 0.28)"
              [points]="matchesTrend()"
            />
            <sg-trend-chart
              title="K/D acumulado"
              unit="ratio"
              variant="line"
              color="#f5d075"
              areaColor="rgba(245, 208, 117, 0.2)"
              [points]="kdTrend()"
            />
            <sg-trend-chart
              title="Placement medio"
              unit="puesto"
              variant="area"
              color="#ff4d9a"
              areaColor="rgba(255, 77, 154, 0.18)"
              [points]="placementTrend()"
            />
            <div class="sg-analytics-charts__radar">
              <sg-stats-radar-chart
                title="Perfil de rendimiento"
                subtitle="Normalizado 0–100 vs objetivos semanales."
                [weekly]="weeklyForCharts()"
                [dailyTrend]="chartDailyTrend()"
              />
            </div>
          </div>

          <sg-match-trends-panel
            [killsTrend]="killsTrend()"
            [matchesTrend]="matchesTrend()"
            [placementTrend]="placementTrend()"
          />
        </section>

        <section class="sg-analytics__section" aria-labelledby="analytics-table">
          <header class="sg-analytics__section-header">
            <h2 id="analytics-table" class="sg-analytics__section-title">Detalle diario</h2>
            <p class="sg-analytics__section-desc">
              Tabla día a día para revisar consistencia y picos.
            </p>
          </header>

          <sg-daily-stats-table
            title="Desglose por día"
            subtitle="Partidas, kills, K/D y placement de cada día."
            [footnote]="dailyTableFootnote()"
            [rows]="dailyTableRows()"
            [totals]="dailyTableTotals()"
          />
        </section>

        <section class="sg-analytics__section" aria-labelledby="analytics-community">
          <header class="sg-analytics__section-header">
            <h2 id="analytics-community" class="sg-analytics__section-title">Vs comunidad</h2>
            <p class="sg-analytics__section-desc">
              Ranking semanal, percentiles y top del leaderboard.
            </p>
          </header>

          <div class="sg-analytics__community-stack">
            <sg-community-rank-table
              title="Tu vecindario en el ranking"
              [platform]="activePlatform()"
              [rows]="communityRank().rows"
              [yourRank]="communityRank().yourRank"
              [totalPlayers]="communityRank().totalPlayers"
              [sampleLabel]="communitySampleLabel()"
              [subtitle]="communityRankSubtitle()"
            />

            <div class="sg-analytics__community-row">
              <sg-community-comparison-panel
                title="Tus percentiles"
                subtitle="Top %, cuántos jugadores superás y dónde está la media."
                [items]="communityComparison()"
                [sampleLabel]="communitySampleLabel()"
                [disclaimer]="communityDisclaimer()"
              />

              <sg-leaderboard-mini
                title="Top semanal"
                [subtitle]="platformMeta().shortLabel"
                [entries]="leaderboardEntries()"
                [highlightGamerTag]="gamerTag()"
              />
            </div>
          </div>
        </section>
      </div>
    </ion-content>
  `,
})
export class AnalyticsPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
  private readonly statsService = inject(StatsService);
  private readonly matchService = inject(MatchService);
  private readonly playerService = inject(PlayerService);

  readonly weekly = signal<PlayerStatsRollupView | null>(null);
  readonly previousWeekly = signal<PlayerStatsRollupView | null>(null);
  readonly dailyTrend = signal<PlayerStatsRollupView[]>([]);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly gamerTag = signal('');
  readonly communityBenchmarksApi = signal<CommunityBenchmarks | null>(null);
  readonly leaderboardApi = signal<LeaderboardEntry[] | null>(null);
  readonly communityUsesMock = signal(true);
  readonly error = signal<string | null>(null);

  readonly activePlatform = computed((): SelectedGame => this.gameContext.activeGame() ?? 'fortnite');

  readonly platformMeta = computed(() => gamePlatformMeta(this.activePlatform()));

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
    const matchCount = weekly?.matchCount || summary.matchCount;
    const kills = weekly?.totalKills || summary.totalKills;
    const useKda = platform === 'valorant' || platform === 'league_of_legends';
    const kd = useKda ? platformSummary.kda : this.weeklyKd();

    return buildCommunityComparison({
      benchmarks,
      winRate: platformSummary.winRate,
      winRateNumeric: parsePlayerWinRateForCommunity(platformSummary.winRate),
      kd,
      kdNumeric: parsePlayerKdForCommunity(kd),
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
        label: 'Partidas',
        you: this.weekMatchCount(),
        benchmark: Math.round(benchmarks.avgMatchesPerWeek),
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

  readonly communityRank = computed(() => {
    const platform = this.activePlatform();
    const summary = this.weekSummary();
    const weekly = this.weeklyForCharts();
    const kd = parsePlayerKdForCommunity(this.weeklyKd()) ?? 1.0;
    const winRate = parsePlayerWinRateForCommunity(summary.winRate) ?? 25;
    const kills = weekly?.totalKills || summary.totalKills || 0;
    const matches = weekly?.matchCount || summary.matchCount || 0;

    return buildCommunityRankNeighborhood({
      platform,
      gamerTag: this.gamerTag() || 'Vos',
      kd,
      winRate,
      kills,
      matches,
      radius: 3,
    });
  });

  readonly communityRankSubtitle = computed(() => {
    const label = gamePlatformMeta(this.activePlatform()).label;
    const you = this.communityRank().yourRank;
    return this.communityUsesMock()
      ? `${label} · puesto #${you} (preview mock)`
      : `${label} · tu puesto #${you} esta semana`;
  });

  readonly leaderboardEntries = computed<LeaderboardEntry[]>(() => {
    const api = this.leaderboardApi();
    if (api?.length) return api;
    return mockLeaderboardForPlatform(this.activePlatform());
  });

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
    effect(() => {
      if (this.gameContext.refreshTick() === 0) return;
      void this.loadStats();
    });
  }

  ngOnInit(): void {
    void this.loadStats();
  }

  private async loadStats(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    this.error.set(null);

    try {
      const uiGame = this.activePlatform();
      const platform = matchBackendPlatform(uiGame);
      const periodId = currentWeeklyPeriodIdForStats();

      const [profile, matches, weeklyRows, previousWeeklyRows, daily, community, leaderboard] =
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
            this.statsService.listWeeklyLeaderboard(platform ?? 'fortnite', periodId, 5),
          ).catch(() => null),
        ]);

      this.gamerTag.set(profile?.gamerTag ?? '');
      this.recentMatches.set(matches);
      this.weekly.set(weeklyRows[0] ?? null);
      this.previousWeekly.set(previousWeeklyRows[0] ?? null);
      this.dailyTrend.set(daily);

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

      if (leaderboard && leaderboard.length > 0) {
        this.leaderboardApi.set(
          leaderboard.map((entry) => ({
            rank: entry.rank,
            gamerTag: entry.gamerTag,
            platform: selectedGameFromBackend(entry.platform, uiGame),
            score: entry.score,
            delta: entry.delta,
            trend: (entry.trend as 'up' | 'down' | 'flat') ?? 'flat',
          })),
        );
      } else {
        this.leaderboardApi.set(null);
      }
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
