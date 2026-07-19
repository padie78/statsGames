import { Component, OnDestroy, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  listRecentWeeklyPeriodIds,
  previousWeeklyPeriodIdForStats,
  type LeaderboardEntryView,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import type { CommunityBenchmarks } from '../../data/community-mock.data';
import {
  buildDailyTrendFromMatches,
  buildKdCumulativeTrend,
  buildWeeklyFormFromMatches,
} from '../../core/charts/stats-chart.util';
import {
  CommunityComparisonPanelComponent,
  CommunityRankTableComponent,
  EvolutionAiReportPanelComponent,
  PeerBenchmarkPanelComponent,
  WeekHeroBrandComponent,
  StatsComparisonChartComponent,
  TrendChartComponent,
  WeekComparisonPanelComponent,
  WeeklyFormChartComponent,
  type PeerBenchmarkPoint,
  type StatsComparisonRow,
  type TrendChartPoint,
} from '../../ui';
import {
  aggregateMatchStats,
  buildWeekComparison,
  computeKdRatio,
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
} from '../../utils/community-stats.util';
import { extractGraphqlErrorMessage } from '../../utils/graphql-error.util';
import {
  persistLolRoutingPlatform,
  resolveLolRegionLabel,
} from '../../utils/lol-region.util';
import {
  buildWeeklyCommunityRankView,
  computeFairCommunityScore,
} from '../../utils/weekly-community-rank.util';

@Component({
  standalone: true,
  selector: 'app-analytics-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    RouterLink,
    WeekHeroBrandComponent,
    TrendChartComponent,
    WeekComparisonPanelComponent,
    CommunityComparisonPanelComponent,
    CommunityRankTableComponent,
    StatsComparisonChartComponent,
    PeerBenchmarkPanelComponent,
    EvolutionAiReportPanelComponent,
    WeeklyFormChartComponent,
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
              <p class="sg-dashboard__week-lede u-m-0">{{ heroLede() }}</p>

              <div class="sg-dashboard__week-kpis" aria-label="KPIs clave de la semana">
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
              </div>
            </div>
          </div>
        </section>

        <div class="sg-analytics__body page-shell page-shell--fluid sg-analytics">
        @if (pageLoading()) {
          <div
            class="sg-analytics__skeleton"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Cargando Evolución"
          >
            <span class="sg-dashboard__loading-dots" aria-hidden="true">
              <i></i><i></i><i></i>
            </span>
            <p class="sg-analytics__skeleton-text u-m-0">Cargando forma y muestra…</p>
          </div>
        }

        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        @if (showEmptyHint()) {
          <aside class="sg-analytics__empty" role="status">
            <p class="sg-analytics__empty-title u-m-0">Todavía no hay forma para mostrar</p>
            <p class="sg-analytics__empty-body u-m-0">
              Conectá tu cuenta del juego o jugá partidas rankeds: Evolución se arma sola.
            </p>
            <div class="sg-analytics__empty-actions">
              <a routerLink="/tabs/integrations" class="sg-evo-ai__plan-link sg-evo-ai__plan-link--accent">
                Conectar cuenta
              </a>
              <a routerLink="/tabs/matches" class="sg-evo-ai__plan-link">Ver Partidas</a>
            </div>
          </aside>
        }

        <section class="sg-dashboard__block" aria-labelledby="analytics-ai-report">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-ai-report" class="sg-dashboard__block-title">
                Informe IA de la semana
              </h2>
              <p class="sg-dashboard__block-desc">
                {{ evolutionAiSubtitle() }}
              </p>
            </div>
            @if (evolutionAiReport()?.status === 'ready' || evolutionAiStaleReady()) {
              <button
                type="button"
                class="sg-dashboard__block-link"
                [disabled]="evolutionAiRegenerating()"
                (click)="onRequestEvolutionAi(true)"
              >
                Regenerar →
              </button>
            }
          </div>
          <sg-evolution-ai-report-panel
            title="Informe IA de la semana"
            [subtitle]="evolutionAiSubtitle()"
            [report]="evolutionAiReport()"
            [staleReady]="evolutionAiStaleReady()"
            [regenerating]="evolutionAiRegenerating()"
            [loading]="evolutionAiLoading()"
            (generate)="onRequestEvolutionAi(false)"
            (regenerate)="onRequestEvolutionAi(true)"
          />
        </section>

        <section class="sg-dashboard__block sg-analytics__section" aria-labelledby="analytics-compare-week">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-compare-week" class="sg-dashboard__block-title">Esta semana vs anterior</h2>
              <p class="sg-dashboard__block-desc">
                Delta vs la semana pasada y tus KPIs frente al promedio de la muestra.
              </p>
            </div>
            @if (gameExtraChips().length) {
              <ul class="sg-analytics__extras-chips" [attr.aria-label]="'Extras ' + platformMeta().shortLabel">
                @for (chip of gameExtraChips(); track chip.label) {
                  <li class="sg-analytics__extra-chip">
                    <span class="sg-analytics__extra-chip-label">{{ chip.label }}</span>
                    <strong class="sg-analytics__extra-chip-value">{{ chip.value }}</strong>
                    @if (chip.delta) {
                      <span
                        class="sg-analytics__extra-chip-delta"
                        [class.sg-analytics__extra-chip-delta--up]="chip.deltaTrend === 'up'"
                        [class.sg-analytics__extra-chip-delta--down]="chip.deltaTrend === 'down'"
                      >
                        {{ chip.delta }}
                      </span>
                    }
                  </li>
                }
              </ul>
            }
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

        <section class="sg-dashboard__block" aria-labelledby="analytics-form">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-form" class="sg-dashboard__block-title">Forma en el tiempo</h2>
              <p class="sg-dashboard__block-desc">
                Últimas {{ formWeeks() }} semanas: WR + {{ kdLabel() }} y score justo vs mediana
                de peers. Gaps = sin partidas. Semana actual resaltada.
              </p>
            </div>
            <div class="sg-analytics__weeks-toggle" role="group" aria-label="Ventana de semanas">
              <button
                type="button"
                class="sg-analytics__weeks-btn"
                [class.sg-analytics__weeks-btn--active]="formWeeks() === 4"
                (click)="setFormWeeks(4)"
              >
                4 sem
              </button>
              <button
                type="button"
                class="sg-analytics__weeks-btn"
                [class.sg-analytics__weeks-btn--active]="formWeeks() === 8"
                (click)="setFormWeeks(8)"
              >
                8 sem
              </button>
            </div>
          </div>

          <div class="sg-analytics__form-grid">
            <sg-weekly-form-chart
              [title]="'WR y ' + kdLabel() + ' por semana'"
              subtitle="Cada punto es una semana ISO. Tooltip: partidas de esa semana."
              variant="wr-kd"
              [kdLabel]="kdLabel()"
              [points]="weeklyFormPoints()"
            />
            <sg-weekly-form-chart
              title="Score justo por semana"
              subtitle="Tu score vs mediana de la muestra (cuando hay historial de peers)."
              variant="fair-score"
              [points]="weeklyFormPoints()"
              [peerMedian]="peerMedianByWeek()"
            />
          </div>
        </section>

        <section class="sg-dashboard__block" aria-labelledby="analytics-trends">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-trends" class="sg-dashboard__block-title">Curvas diarias</h2>
              <p class="sg-dashboard__block-desc">
                Cuatro KPIs de esta semana por día. Días sin partidas quedan en gap (no en 0).
              </p>
            </div>
          </div>

          <div class="sg-analytics-charts">
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
              title="Partidas por día"
              subtitle="Volumen de juego diario."
              unit="matches"
              variant="bar"
              color="#c89b3c"
              areaColor="rgba(200, 155, 60, 0.28)"
              [points]="matchesTrend()"
            />
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
              [title]="kdLabel() + ' acumulado'"
              subtitle="Ratio acumulado a lo largo de la semana."
              unit="ratio"
              variant="line"
              color="#f5d075"
              areaColor="rgba(245, 208, 117, 0.2)"
              [points]="kdTrend()"
            />
          </div>
        </section>

        <section class="sg-dashboard__block" aria-labelledby="analytics-community">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-community" class="sg-dashboard__block-title">Tu lugar en la comunidad</h2>
              <p class="sg-dashboard__block-desc">
                Tabla de la muestra, mapa WR×KDA y percentiles. El score justo prioriza ratios
                (ventana ≥5 games).
              </p>
            </div>
            <span class="sg-analytics__sample-badge" [attr.title]="communityContextBadge()">
              {{ communityContextBadge() }}
            </span>
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
                [sampleLabel]="communityContextBadge()"
                [subtitle]="communityRankSubtitle()"
              />
            } @else {
              <aside class="sg-analytics__empty sg-analytics__empty--inline" role="status">
                <p class="sg-analytics__empty-title u-m-0">Sin peers reales esta semana</p>
                <p class="sg-analytics__empty-body u-m-0">
                  {{
                    communityUsesMock()
                      ? 'La muestra está en preview. Cuando haya leaderboard real, aparece tu puesto acá.'
                      : 'Aún no hay rivales en la ventana semanal. Volvé cuando haya más actividad.'
                  }}
                </p>
                @if (communityUsesMock()) {
                  <div class="sg-analytics__empty-actions">
                    <a routerLink="/tabs/integrations" class="sg-evo-ai__plan-link sg-evo-ai__plan-link--accent">
                      Revisar integraciones
                    </a>
                  </div>
                }
              </aside>
            }

            @if (communityRank(); as rankPeers) {
              <sg-peer-benchmark-panel
                title="Mapa WR × KDA entre peers"
                subtitle="Misma muestra que la tabla: eje X = win rate, eje Y = KDA. Tamaño = score. Oro = vos."
                visualMode="scatter"
                [sampleLabel]="communityContextBadge()"
                [peers]="peerBenchmarkPoints()"
              />

              <sg-community-comparison-panel
                title="Tus percentiles por métrica"
                subtitle="Por cada KPI: top %, cuánto de la muestra superás y dónde queda el promedio."
                [items]="communityComparison()"
                [sampleLabel]="communityContextBadge()"
                [disclaimer]="communityDisclaimer()"
              />
            }
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
  private evolutionPollTimer: ReturnType<typeof setInterval> | null = null;

  readonly weekly = signal<PlayerStatsRollupView | null>(null);
  readonly previousWeekly = signal<PlayerStatsRollupView | null>(null);
  readonly dailyTrend = signal<PlayerStatsRollupView[]>([]);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly gamerTag = signal('');
  readonly avatarUrl = signal<string | undefined>(undefined);
  readonly communityBenchmarksApi = signal<CommunityBenchmarks | null>(null);
  readonly leaderboardApi = signal<LeaderboardEntryView[]>([]);
  /** Medianas de score justo por periodId (historial de leaderboard). */
  readonly peerMedianByPeriod = signal<Record<string, number | null>>({});
  readonly communityUsesMock = signal(true);
  readonly evolutionAiReport = signal<EvolutionAiReportView | null>(null);
  readonly evolutionAiStaleReady = signal<EvolutionAiReportView | null>(null);
  readonly evolutionAiRegenerating = signal(false);
  readonly evolutionAiLoading = signal(false);
  readonly pageLoading = signal(true);
  readonly formWeeks = signal<4 | 8>(4);
  readonly error = signal<string | null>(null);
  private readonly heroArtFailed = signal(false);

  readonly activePlatform = computed((): SelectedGame => this.gameContext.activeGame() ?? 'fortnite');

  readonly platformMeta = computed(() => gamePlatformMeta(this.activePlatform()));

  /** Micro-copy A/B estable por userId. */
  readonly heroLede = computed(() => {
    const userId = this.auth.userId() ?? 'guest';
    const variant = userId.length % 2;
    if (variant === 0) {
      return 'Tu forma de la semana, la curva multi-semana y tu puesto en la muestra. El detalle de cada partida vive en Partidas.';
    }
    return 'Mirá si subís o bajás: KPIs de la semana, tendencia de score y peers reales. Historial completo en Partidas.';
  });

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

  readonly previousPlatformWeekSummary = computed(() =>
    aggregatePlatformMatchStats(this.previousWeekMatches()),
  );

  /** Extras del juego como chips densos + delta vs semana anterior. */
  readonly gameExtraChips = computed((): Array<{
    label: string;
    value: string;
    delta?: string;
    deltaTrend?: 'up' | 'down' | 'flat';
  }> => {
    const s = this.platformWeekSummary();
    const prev = this.previousPlatformWeekSummary();
    const chips: Array<{
      label: string;
      value: string;
      delta?: string;
      deltaTrend?: 'up' | 'down' | 'flat';
    }> = [];
    const push = (
      label: string,
      raw: string | number | null | undefined,
      prevRaw?: string | number | null | undefined,
      invert = false,
    ) => {
      if (raw == null || raw === '' || raw === '—') return;
      const deltaInfo = formatExtraChipDelta(raw, prevRaw, invert);
      chips.push({ label, value: String(raw), ...deltaInfo });
    };

    if (this.showValCs2Extras()) push('HS%', s.avgHeadshotPct, prev.avgHeadshotPct);
    if (this.showValorantExtras()) push('ACS', s.avgScore, prev.avgScore);
    if (this.showLolExtras()) {
      push('CS medio', s.avgCs, prev.avgCs);
      push('Visión', s.avgVision, prev.avgVision);
    }
    if (this.showCs2Extras()) push('ADR', s.avgAdr, prev.avgAdr);
    if (this.showRlExtras()) {
      push('Saves', s.totalSaves, prev.totalSaves);
      push('Shot %', s.avgShotPct, prev.avgShotPct);
    }
    if (this.showFortniteExtras()) {
      push('Placement', this.avgPlacementLabel(), prev.avgPlacement || undefined, true);
    }
    return chips;
  });

  readonly usesKdaRatio = computed(() => {
    const p = this.activePlatform();
    return (
      p === 'valorant' ||
      p === 'league_of_legends' ||
      p === 'dota2' ||
      p === 'overwatch2'
    );
  });

  readonly weeklyFormPoints = computed(() =>
    buildWeeklyFormFromMatches(this.effectiveRecentMatches(), {
      weeks: this.formWeeks(),
      useKda: this.usesKdaRatio(),
    }),
  );

  readonly peerMedianByWeek = computed(() => {
    const map = this.peerMedianByPeriod();
    return this.weeklyFormPoints().map((p) => map[p.periodId] ?? null);
  });

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

  readonly weekMatchCount = computed(
    () => this.weekly()?.matchCount ?? this.weekSummary().matchCount,
  );

  readonly avgPlacementLabel = computed(() => {
    const fromWeekly = this.weekly()?.avgPlacement;
    if (fromWeekly && fromWeekly > 0) return fromWeekly.toFixed(1);
    const fromSummary = this.weekSummary().avgPlacement;
    return fromSummary && fromSummary !== '—' ? fromSummary : '—';
  });

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

  /**
   * Badge de muestra: plataforma · (tier/LP si hay) · #puesto · N peers · ventana 5 games.
   * Evita malinterpretar el ranking sin contexto de muestra.
   */
  readonly communityContextBadge = computed(() => {
    const platform = this.activePlatform();
    const benchmarks =
      this.communityBenchmarksApi() ?? MOCK_COMMUNITY_BENCHMARKS[platform];
    const rank = this.communityRank();
    const peers =
      rank?.totalPlayers ?? this.leaderboardApi().length ?? benchmarks.sampleSize;
    const short = gamePlatformMeta(platform).shortLabel;
    const parts: string[] = [short];

    if (this.communityUsesMock()) {
      parts.push('preview');
    } else if (platform === 'league_of_legends') {
      const region = resolveLolRegionLabel('la1');
      const tier = this.communitySampleTierLabel();
      if (region && tier) parts.push(`${region} ${tier}`);
      else if (tier) parts.push(tier);
      else if (region) parts.push(region);
    } else {
      const sampleTier = this.communitySampleTierLabel();
      if (sampleTier) parts.push(sampleTier);
    }

    const selfLp = this.selfLeaguePoints();
    if (selfLp != null) parts.push(`${selfLp} LP`);
    if (rank?.yourRank) parts.push(`#${rank.yourRank}`);
    parts.push(`${formatCommunitySampleSize(peers)} peers`);
    parts.push('ventana 5 games');
    return parts.join(' · ');
  });

  /** Inferencia liviana de tier de muestra (ej. Challenger) vía LP del leaderboard. */
  private communitySampleTierLabel(): string | null {
    if (this.activePlatform() !== 'league_of_legends') return null;
    const lps = this.leaderboardApi()
      .map((e) => e.leaguePoints)
      .filter((lp): lp is number => typeof lp === 'number' && lp > 0);
    if (lps.length < 3) return null;
    const sorted = [...lps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    if (median >= 500) {
      persistLolRoutingPlatform('la1');
      return 'Challenger';
    }
    if (median >= 100) return 'Alto elo';
    return null;
  }

  private selfLeaguePoints(): number | null {
    const userId = this.auth.userId();
    if (!userId) return null;
    const self = this.leaderboardApi().find((e) => e.userId === userId);
    const lp = self?.leaguePoints;
    return typeof lp === 'number' && lp > 0 ? Math.round(lp) : null;
  }

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

  readonly killsTrend = computed<TrendChartPoint[]>(() =>
    this.chartDailyTrend().map((d) => ({
      label: d.periodId.slice(5),
      value: d.matchCount > 0 ? d.totalKills : null,
    })),
  );

  readonly matchesTrend = computed<TrendChartPoint[]>(() =>
    this.chartDailyTrend().map((d) => ({
      label: d.periodId.slice(5),
      value: d.matchCount > 0 ? d.matchCount : null,
    })),
  );

  readonly kdTrend = computed<TrendChartPoint[]>(() => {
    const days = this.chartDailyTrend();
    const cumulative = buildKdCumulativeTrend(days);
    return days.map((d, index) => ({
      label: d.periodId.slice(5),
      value: d.matchCount > 0 ? (cumulative[index]?.value ?? null) : null,
    }));
  });

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

  readonly winRateTrend = computed<TrendChartPoint[]>(() => {
    const buckets = this.matchDayBuckets();
    return this.chartDailyTrend().map((day) => {
      const bucket = buckets.get(day.periodId);
      const matches = bucket?.matches ?? day.matchCount;
      const wins = bucket?.wins ?? 0;
      return {
        label: day.periodId.slice(5),
        value: matches > 0 ? Math.round((wins / matches) * 100) : null,
      };
    });
  });

  readonly peerBenchmarkPoints = computed<PeerBenchmarkPoint[]>(() => {
    const userId = this.auth.userId();
    const youTag = this.gamerTag() || 'Vos';
    const fromApi = this.leaderboardApi().map((entry) => {
      const isYou = Boolean(userId) && entry.userId === userId;
      return {
        gamerTag: isYou
          ? youTag
          : entry.gamerTag && entry.gamerTag !== entry.userId
            ? entry.gamerTag
            : `Jugador ${entry.rank}`,
        kd: Number(entry.kd) || 0,
        winRate: Number(entry.winRate) || 0,
        score: Number(entry.score) || 0,
        isYou,
      };
    });
    if (fromApi.length) return fromApi;

    // Fallback: misma muestra que la tabla de ranking (si el API vino vacío en un reload parcial).
    const rank = this.communityRank();
    if (!rank?.rows.length) return [];
    return rank.rows.map((row) => ({
      gamerTag: row.isYou ? youTag : row.gamerTag,
      kd: Number(row.kd) || 0,
      winRate: Number(row.winRate) || 0,
      score: Number(row.score) || 0,
      isYou: Boolean(row.isYou),
    }));
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
    this.clearEvolutionPoll();
  }

  setFormWeeks(weeks: 4 | 8): void {
    if (this.formWeeks() === weeks) return;
    this.formWeeks.set(weeks);
    void this.reloadPeerMedianHistory();
  }

  private async reloadPeerMedianHistory(): Promise<void> {
    const platform = matchBackendPlatform(this.activePlatform()) ?? 'fortnite';
    const historyPeriodIds = listRecentWeeklyPeriodIds(this.formWeeks());
    const historyBoards = await Promise.all(
      historyPeriodIds.map((id) =>
        firstValueFrom(this.statsService.listWeeklyLeaderboard(platform, id, 40)).catch(
          () => [] as LeaderboardEntryView[],
        ),
      ),
    );
    this.peerMedianByPeriod.set(buildPeerMedianByPeriod(historyPeriodIds, historyBoards));
  }

  async onRequestEvolutionAi(force: boolean): Promise<void> {
    const userId = this.auth.userId();
    const platform = matchBackendPlatform(this.activePlatform());
    if (!userId || !platform) return;

    const current = this.evolutionAiReport();
    if (current?.status === 'ready') {
      this.evolutionAiStaleReady.set(current);
    }
    this.evolutionAiRegenerating.set(Boolean(force || current?.status === 'ready'));
    this.evolutionAiLoading.set(!this.evolutionAiStaleReady());

    try {
      const report = await this.evolutionAi.requestEvolutionAiReport({
        userId,
        platform,
        periodId: currentWeeklyPeriodIdForStats(),
        force,
      });
      this.evolutionAiReport.set(report);
      if (report.status === 'ready') {
        this.evolutionAiStaleReady.set(null);
        this.evolutionAiRegenerating.set(false);
        this.clearEvolutionPoll();
        this.evolutionReadySub?.unsubscribe();
      } else if (report.status === 'pending') {
        this.bindEvolutionReady(userId, platform, currentWeeklyPeriodIdForStats());
      } else {
        this.evolutionAiRegenerating.set(false);
        this.clearEvolutionPoll();
        this.evolutionReadySub?.unsubscribe();
      }
    } catch (err) {
      this.evolutionAiRegenerating.set(false);
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
          .then((report) => {
            if (!report) return;
            this.evolutionAiReport.set(report);
            if (report.status === 'ready') {
              this.evolutionAiStaleReady.set(null);
              this.evolutionAiRegenerating.set(false);
              this.clearEvolutionPoll();
            } else if (report.status !== 'pending') {
              this.evolutionAiRegenerating.set(false);
              this.clearEvolutionPoll();
            }
          })
          .catch(() => undefined);
      },
      error: () => undefined,
    });
    this.startEvolutionPoll(userId, platform, periodId);
  }

  /** Fallback si la subscription no llega: poll + timeout ~90s. */
  private startEvolutionPoll(
    userId: string,
    platform: NonNullable<ReturnType<typeof matchBackendPlatform>>,
    periodId: string,
  ): void {
    this.clearEvolutionPoll();
    let ticks = 0;
    this.evolutionPollTimer = setInterval(() => {
      ticks += 1;
      void this.evolutionAi
        .getEvolutionAiReport(userId, platform, periodId)
        .then((report) => {
          if (!report) return;
          if (report.status === 'ready') {
            this.evolutionAiReport.set(report);
            this.evolutionAiStaleReady.set(null);
            this.evolutionAiRegenerating.set(false);
            this.clearEvolutionPoll();
          } else if (report.status !== 'pending') {
            this.evolutionAiReport.set(report);
            this.evolutionAiRegenerating.set(false);
            this.clearEvolutionPoll();
          }
        })
        .catch(() => undefined);

      if (ticks >= 12) {
        this.clearEvolutionPoll();
        const current = this.evolutionAiReport();
        if (current?.status === 'pending') {
          this.evolutionAiReport.set({
            ...current,
            status: 'failed',
            summary:
              current.summary ||
              'El informe está tardando más de lo esperado. Reintentá en un momento.',
          });
          this.evolutionAiRegenerating.set(false);
        }
      }
    }, 8_000);
  }

  private clearEvolutionPoll(): void {
    if (this.evolutionPollTimer != null) {
      clearInterval(this.evolutionPollTimer);
      this.evolutionPollTimer = null;
    }
  }

  private async loadStats(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    this.error.set(null);
    this.pageLoading.set(true);

    try {
      const uiGame = this.activePlatform();
      const platform = matchBackendPlatform(uiGame);
      const periodId = currentWeeklyPeriodIdForStats();
      const historyPeriodIds = listRecentWeeklyPeriodIds(this.formWeeks());

      const [profile, matches, weeklyRows, previousWeeklyRows, daily, community, leaderboard, evoReport, historyBoards] =
        await Promise.all([
          this.playerService.getPlayerProfileOrNull(userId).catch(() => null),
          this.matchService.listPlayerMatchesOnce(userId, { limit: 80 }).catch(() => [] as MatchUpdateView[]),
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
          Promise.all(
            historyPeriodIds.map((id) =>
              firstValueFrom(
                this.statsService.listWeeklyLeaderboard(platform ?? 'fortnite', id, 40),
              ).catch(() => [] as LeaderboardEntryView[]),
            ),
          ),
        ]);

      this.gamerTag.set(profile?.gamerTag ?? '');
      this.avatarUrl.set(profile?.avatarUrl ?? undefined);
      this.recentMatches.set(matches);
      this.weekly.set(weeklyRows[0] ?? null);
      this.previousWeekly.set(previousWeeklyRows[0] ?? null);
      this.dailyTrend.set(daily);
      this.evolutionAiReport.set(evoReport);
      if (evoReport?.status === 'ready') {
        this.evolutionAiStaleReady.set(null);
        this.evolutionAiRegenerating.set(false);
      }

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
      this.peerMedianByPeriod.set(
        buildPeerMedianByPeriod(historyPeriodIds, historyBoards ?? []),
      );
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err, 'Error cargando estadísticas'));
    } finally {
      this.pageLoading.set(false);
    }
  }
}

function buildPeerMedianByPeriod(
  periodIds: string[],
  boards: LeaderboardEntryView[][],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  periodIds.forEach((periodId, index) => {
    const rows = boards[index] ?? [];
    if (!rows.length) {
      out[periodId] = null;
      return;
    }
    const scores = rows
      .map((entry) => {
        if (typeof entry.score === 'number' && entry.score > 0) return entry.score;
        return computeFairCommunityScore({
          totalKills: entry.totalKills,
          totalDeaths: entry.totalDeaths,
          totalAssists: entry.totalAssists ?? 0,
          winCount: entry.winCount,
          matchCount: entry.matchCount,
        });
      })
      .filter((s) => s > 0)
      .sort((a, b) => a - b);
    if (!scores.length) {
      out[periodId] = null;
      return;
    }
    out[periodId] = scores[Math.floor(scores.length / 2)] ?? null;
  });
  return out;
}

function formatExtraChipDelta(
  current: string | number,
  previous: string | number | null | undefined,
  invert = false,
): { delta?: string; deltaTrend?: 'up' | 'down' | 'flat' } {
  const curr = Number.parseFloat(String(current).replace('%', ''));
  const prev = Number.parseFloat(String(previous ?? '').replace('%', ''));
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0 && curr === 0) {
    return {};
  }
  if (!Number.isFinite(prev)) return {};
  const diff = curr - prev;
  if (Math.abs(diff) < 0.05) return { delta: '=', deltaTrend: 'flat' };
  const trend: 'up' | 'down' = diff > 0 ? 'up' : 'down';
  const visualTrend = invert ? (trend === 'up' ? 'down' : 'up') : trend;
  const abs = Math.abs(diff);
  const label = Number.isInteger(abs) || abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  return {
    delta: `${diff > 0 ? '+' : '−'}${label}`,
    deltaTrend: visualTrend,
  };
}
