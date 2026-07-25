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
import { AnalysisRangeService } from '../../core/analysis/analysis-range.service';
import {
  analysisRangeCompareSubtitle,
  analysisRangeCompareTitle,
  analysisRangeNoun,
  analysisRangeWeekSpan,
  previousPeriodId,
  type AnalysisRangeId,
} from '../../core/analysis/analysis-range';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { lolEvolutionBannerSplashUrl } from '../../core/game/lol-ddragon.util';
import { valorantEvolutionBannerSplashUrl } from '../../core/game/valorant-assets.util';
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
  isoWeeklyPeriodIdForDay,
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
  AnalysisFiltersPanelComponent,
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
  filterMatchesByAnalysisRange,
  filterMatchesInDayRange,
  filterMatchesInPreviousIsoWeek,
  filterMatchesOnCalendarDay,
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
  mergeLeaderboardsAcrossPeriods,
} from '../../utils/weekly-community-rank.util';

@Component({
  standalone: true,
  selector: 'app-analytics-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    RouterLink,
    WeekHeroBrandComponent,
    AnalysisFiltersPanelComponent,
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

              <div class="sg-dashboard__week-kpis" [attr.aria-label]="'KPIs clave · ' + rangeNoun()">
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
        <section class="sg-dashboard__block" aria-labelledby="analytics-filters">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-filters" class="sg-dashboard__block-title">Filtros</h2>
              <p class="sg-dashboard__block-desc">
                Mismo período que Inicio, Partidas y Coach.
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

        <section class="sg-dashboard__block" aria-labelledby="analytics-form">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-form" class="sg-dashboard__block-title">Forma en el tiempo</h2>
              <p class="sg-dashboard__block-desc">
                Últimas {{ formWeeks() }} semanas: WR + {{ kdLabel() }} y score justo vs mediana
                de peers. Gaps = sin partidas. Semana actual resaltada.
              </p>
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
                {{ dailyChartsDesc() }} Días sin partidas quedan en gap.
              </p>
            </div>
          </div>

          <div class="sg-analytics-charts sg-analytics-charts--daily">
            <sg-trend-chart
              title="Win rate"
              subtitle="% ganadas ese día."
              unit="%"
              variant="line"
              color="#f0d060"
              areaColor="rgba(240, 208, 96, 0.18)"
              [points]="winRateTrend()"
            />
            <sg-trend-chart
              [title]="kdLabel()"
              subtitle="Ratio acumulado en la semana."
              unit="ratio"
              variant="line"
              color="#f5d075"
              areaColor="rgba(245, 208, 117, 0.2)"
              [points]="kdTrend()"
            />
            @if (showValorantExtras()) {
              <sg-trend-chart
                title="ACS"
                subtitle="Combat score medio del día."
                unit="acs"
                variant="area"
                color="#ff6b7a"
                areaColor="rgba(255, 70, 85, 0.2)"
                [points]="acsTrend()"
              />
              <sg-trend-chart
                title="HS%"
                subtitle="Headshot % medio del día."
                unit="%"
                variant="line"
                color="#7dd3fc"
                areaColor="rgba(125, 211, 252, 0.16)"
                [points]="hsTrend()"
              />
            } @else if (showLolExtras()) {
              <sg-trend-chart
                [title]="analyticsKillLabel() + ' / día'"
                subtitle="Volumen ofensivo diario."
                unit="kills"
                variant="area"
                color="#f0d060"
                areaColor="rgba(240, 208, 96, 0.22)"
                [points]="killsTrend()"
              />
            } @else {
              <sg-trend-chart
                [title]="analyticsKillLabel() + ' / día'"
                subtitle="Volumen ofensivo diario."
                unit="kills"
                variant="area"
                color="#f0d060"
                areaColor="rgba(240, 208, 96, 0.22)"
                [points]="killsTrend()"
              />
            }
          </div>
        </section>

        <section class="sg-dashboard__block sg-analytics__ai-compact" aria-labelledby="analytics-ai-report">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-ai-report" class="sg-dashboard__block-title">
                Informe IA de la semana
              </h2>
              <p class="sg-dashboard__block-desc">
                Lectura macro opcional. Las curvas de arriba son la señal principal.
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
            [title]="evolutionAiTitle()"
            [subtitle]="evolutionAiSubtitle()"
            [report]="evolutionAiReport()"
            [staleReady]="evolutionAiStaleReady()"
            [regenerating]="evolutionAiRegenerating()"
            [loading]="evolutionAiLoading()"
            [compact]="true"
            (generate)="onRequestEvolutionAi(false)"
            (regenerate)="onRequestEvolutionAi(true)"
          />
        </section>

        <section class="sg-dashboard__block sg-analytics__section" aria-labelledby="analytics-compare-week">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-compare-week" class="sg-dashboard__block-title">{{ compareTitle() }}</h2>
              <p class="sg-dashboard__block-desc">
                {{ compareSubtitle() }}
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
              [title]="compareTitle()"
              [subtitle]="compareSubtitle()"
              [items]="weekComparison()"
            />

            <sg-stats-comparison-chart
              title="Vos vs promedio de la muestra"
              subtitle="Barras: tu valor en el rango (oro) frente a la muestra comunitaria disponible (gris)."
              [rows]="communityChartRows()"
            />
          </div>
        </section>

        <section class="sg-dashboard__block" aria-labelledby="analytics-community">
          <div class="sg-dashboard__block-head">
            <div>
              <h2 id="analytics-community" class="sg-dashboard__block-title">Tu lugar en la comunidad</h2>
              <p class="sg-dashboard__block-desc">
                {{ communityScopeDesc() }} El score justo prioriza ratios (ventana ≥5 games).
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
  readonly analysisRange = inject(AnalysisRangeService);
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
  readonly error = signal<string | null>(null);
  private readonly heroArtFailed = signal(false);

  readonly activePlatform = computed((): SelectedGame => this.gameContext.activeGame() ?? 'fortnite');

  readonly platformMeta = computed(() => gamePlatformMeta(this.activePlatform()));

  readonly rangeMeta = computed(() => this.analysisRange.meta());

  readonly rangeNoun = computed(() =>
    analysisRangeNoun(this.analysisRange.range(), this.analysisRange.selectedDayIso()),
  );

  readonly formWeeks = computed(() => this.rangeMeta().formWeeks);

  readonly compareTitle = computed(() => analysisRangeCompareTitle(this.analysisRange.range()));

  readonly communityScopeDesc = computed(() => {
    const weeks = analysisRangeWeekSpan(this.analysisRange.range());
    if (this.rangeMeta().isSingleDay) {
      return 'Muestra de la semana ISO que contiene el día elegido.';
    }
    if (weeks === 1) return 'Muestra de la semana ISO en curso.';
    return `Muestra acumulada de las últimas ${weeks} semanas ISO (${this.rangeMeta().label}).`;
  });

  readonly compareSubtitle = computed(() =>
    analysisRangeCompareSubtitle(this.analysisRange.range()),
  );

  readonly evolutionAiTitle = computed(() =>
    this.analysisRange.range() === 'week'
      ? 'Informe IA de la semana'
      : `Informe IA · ${this.rangeMeta().label}`,
  );

  /** Micro-copy A/B estable por userId. */
  readonly heroLede = computed(() => {
    const noun = this.rangeNoun();
    const userId = this.auth.userId() ?? 'guest';
    const variant = userId.length % 2;
    if (variant === 0) {
      return `Tu forma en ${noun}, la curva multi-semana y tu puesto en la muestra semanal. El detalle de cada partida vive en Partidas.`;
    }
    return `Elegí el rango arriba: KPIs, curvas, comparativas y ranking se recalculan con el historial disponible.`;
  });

  readonly evolutionAiSubtitle = computed(() => {
    const periodId = currentWeeklyPeriodIdForStats();
    const range = this.rangeMeta().label;
    return `${this.platformMeta().label} · ${range} · ancla semanal ${periodId}`;
  });

  readonly heroArtSrc = computed(() => {
    const meta = this.platformMeta();
    if (this.heroArtFailed()) {
      return meta.portraitFallbackUrl || meta.artUrl;
    }
    const seed = (this.gamerTag() || this.auth.userId() || 'evo-hero').length + 17;
    if (this.activePlatform() === 'league_of_legends') {
      return lolEvolutionBannerSplashUrl(seed);
    }
    if (this.activePlatform() === 'valorant') {
      return valorantEvolutionBannerSplashUrl(seed);
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
    filterMatchesByAnalysisRange(
      this.effectiveRecentMatches(),
      this.analysisRange.range(),
      this.analysisRange.selectedDayIso(),
    ),
  );

  readonly previousWeekMatches = computed(() => {
    const matches = this.effectiveRecentMatches();
    const meta = this.rangeMeta();
    if (meta.id === 'all') return [];
    if (meta.isSingleDay) {
      return filterMatchesOnCalendarDay(
        matches,
        previousPeriodId(this.analysisRange.selectedDayIso()),
      );
    }
    if (meta.preferWeeklyRollup) {
      return filterMatchesInPreviousIsoWeek(matches);
    }
    const days = meta.days;
    return filterMatchesInDayRange(matches, days, days * 2);
  });

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

  dailyChartsDesc(): string {
    const noun = this.rangeNoun();
    if (this.showValorantExtras()) {
      return `WR, KDA, ACS y HS% de los ${noun}.`;
    }
    if (this.showLolExtras()) {
      return `WR, KDA y kills de los ${noun}.`;
    }
    return `WR, KDA y volumen ofensivo de los ${noun}.`;
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
    const meta = this.rangeMeta();
    const userId = this.auth.userId() ?? 'mock-user-demo';
    const platform = this.activePlatform();

    if (meta.isSingleDay) {
      const dayIso = this.analysisRange.selectedDayIso();
      const fromApi = this.dailyTrend().find((d) => d.periodId === dayIso);
      if (fromApi) return [fromApi];
      return buildDailyTrendFromMatches(this.weekMatches(), userId, platform, 1).map((row) => ({
        ...row,
        periodId: dayIso,
      }));
    }

    const days =
      meta.id === 'all'
        ? availableHistoryDays(this.effectiveRecentMatches())
        : meta.days;
    const api = this.dailyTrend();
    const hasSignal = api.some((day) => day.matchCount > 0 || day.totalKills > 0);
    // API diario topea en 30 días: para 90d (o API vacía) armamos desde partidas.
    if (hasSignal && days <= 30 && api.length >= Math.min(days, 7)) {
      return api.slice(-days);
    }
    return buildDailyTrendFromMatches(this.weekMatches(), userId, platform, days);
  });

  readonly weeklyForCharts = computed(() => {
    const preferWeekly = this.rangeMeta().preferWeeklyRollup;
    const w = this.weekly();
    if (preferWeekly && w && w.matchCount > 0) return w;
    const summary = this.weekSummary();
    if (summary.matchCount === 0) return preferWeekly ? w : null;
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
    if (this.rangeMeta().preferWeeklyRollup) {
      const w = this.weekly();
      if (w && w.matchCount > 0) {
        return computeKdRatio(w.totalKills, w.totalDeaths);
      }
    }
    const summary = this.weekSummary();
    if (summary.matchCount > 0) {
      return computeKdRatio(summary.totalKills, summary.totalDeaths);
    }
    return '—';
  });

  readonly weekKills = computed(() => {
    if (this.rangeMeta().preferWeeklyRollup) {
      return this.weekly()?.totalKills ?? this.weekSummary().totalKills;
    }
    return this.weekSummary().totalKills;
  });

  readonly weekMatchCount = computed(() => {
    if (this.rangeMeta().preferWeeklyRollup) {
      return this.weekly()?.matchCount ?? this.weekSummary().matchCount;
    }
    return this.weekSummary().matchCount;
  });

  readonly avgPlacementLabel = computed(() => {
    if (this.rangeMeta().preferWeeklyRollup) {
      const fromWeekly = this.weekly()?.avgPlacement;
      if (fromWeekly && fromWeekly > 0) return fromWeekly.toFixed(1);
    }
    const fromSummary = this.weekSummary().avgPlacement;
    return fromSummary && fromSummary !== '—' ? fromSummary : '—';
  });

  readonly weekComparison = computed(() => {
    if (this.analysisRange.range() === 'all') return [];
    const preferWeekly = this.rangeMeta().preferWeeklyRollup;
    const previousFromMatches = {
      matchCount: this.previousWeekSummary().matchCount,
      totalKills: this.previousWeekSummary().totalKills,
      totalDeaths: this.previousWeekSummary().totalDeaths,
    };
    return buildWeekComparison({
      currentWeekly: this.weeklyForCharts(),
      previousWeekly: preferWeekly
        ? this.previousWeekly() ?? previousFromMatches
        : previousFromMatches,
      currentWins: this.weekSummary().winCount,
      previousWins: this.previousWeekSummary().winCount,
    });
  });

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
    // Peers y self comparten la ventana del rango elegido.
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
      apiRows: this.leaderboardApi(),
      sampleSize: this.communityBenchmarksApi()?.sampleSize ?? null,
      radius: 14,
      self: {
        gamerTag: this.gamerTag() || 'Vos',
        avatarUrl: this.avatarUrl(),
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

  /** ACS medio por día (Valorant) desde partidas de la semana. */
  readonly acsTrend = computed<TrendChartPoint[]>(() => {
    const buckets = this.matchCombatBuckets();
    return this.chartDailyTrend().map((day) => {
      const bucket = buckets.get(day.periodId);
      if (!bucket || bucket.acsCount === 0) {
        return { label: day.periodId.slice(5), value: null };
      }
      return {
        label: day.periodId.slice(5),
        value: Math.round(bucket.acsSum / bucket.acsCount),
      };
    });
  });

  /** HS% medio por día (Valorant / CS2). */
  readonly hsTrend = computed<TrendChartPoint[]>(() => {
    const buckets = this.matchCombatBuckets();
    return this.chartDailyTrend().map((day) => {
      const bucket = buckets.get(day.periodId);
      if (!bucket || bucket.hsCount === 0) {
        return { label: day.periodId.slice(5), value: null };
      }
      return {
        label: day.periodId.slice(5),
        value: Math.round((bucket.hsSum / bucket.hsCount) * 10) / 10,
      };
    });
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

  /** ACS / HS% por día desde stats de partida. */
  private readonly matchCombatBuckets = computed(() => {
    const days = this.chartDailyTrend();
    const buckets = new Map<
      string,
      { acsSum: number; acsCount: number; hsSum: number; hsCount: number }
    >();
    for (const day of days) {
      buckets.set(day.periodId, { acsSum: 0, acsCount: 0, hsSum: 0, hsCount: 0 });
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
      const s = match.stats;
      if (s?.score != null) {
        const rounds = (s.roundsWon ?? 0) + (s.roundsLost ?? 0);
        bucket.acsSum += rounds > 0 ? s.score / rounds : s.score;
        bucket.acsCount += 1;
      }
      if (s?.headshotPct != null) {
        bucket.hsSum += s.headshotPct;
        bucket.hsCount += 1;
      }
    }
    return buckets;
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

  onAnalysisRangeChange(id: AnalysisRangeId): void {
    this.analysisRange.setRange(id);
    void this.reloadForRange();
  }

  onAnalysisDayChange(dayIso: string): void {
    this.analysisRange.setDay(dayIso);
    void this.reloadForRange();
  }

  private async reloadForRange(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    try {
      await this.loadRangeScopedData(userId, matchBackendPlatform(this.activePlatform()));
    } catch {
      /* keep previous data */
    }
  }

  /**
   * Curva diaria + leaderboard del rango. El backend solo tiene boards semanales:
   * 30d/90d se agregan sumando semanas ISO; "Día" usa la semana que contiene ese día.
   */
  private async loadRangeScopedData(
    userId: string,
    platform: ReturnType<typeof matchBackendPlatform>,
  ): Promise<void> {
    const range = this.rangeMeta();
    const boardPlatform = platform ?? 'fortnite';
    const weekSpan = analysisRangeWeekSpan(range.id);
    const historyPeriodIds = listRecentWeeklyPeriodIds(
      Math.max(range.formWeeks, weekSpan),
    );
    const rangeWeekIds = range.isSingleDay
      ? [isoWeeklyPeriodIdForDay(this.analysisRange.selectedDayIso())]
      : historyPeriodIds.slice(-weekSpan);
    const allPeriodIds = [...new Set([...historyPeriodIds, ...rangeWeekIds])];

    const [daily, boards] = await Promise.all([
      firstValueFrom(
        this.statsService.listPlayerDailyTrend(userId, platform, range.dailyApiDays),
      ).catch(() => [] as PlayerStatsRollupView[]),
      Promise.all(
        allPeriodIds.map((id) =>
          firstValueFrom(
            this.statsService.listWeeklyLeaderboard(boardPlatform, id, 40),
          ).catch(() => [] as LeaderboardEntryView[]),
        ),
      ),
    ]);

    const byPeriod = new Map(allPeriodIds.map((id, index) => [id, boards[index] ?? []]));

    this.dailyTrend.set(daily);
    this.leaderboardApi.set(
      mergeLeaderboardsAcrossPeriods(rangeWeekIds.map((id) => byPeriod.get(id) ?? [])),
    );
    this.peerMedianByPeriod.set(
      buildPeerMedianByPeriod(
        historyPeriodIds,
        historyPeriodIds.map((id) => byPeriod.get(id) ?? []),
      ),
    );
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
      const range = this.rangeMeta();
      const matchLimit =
        range.id === 'all' ? 150 : Math.min(150, Math.max(80, range.days + 40));

      const [profile, matches, weeklyRows, previousWeeklyRows, community, evoReport] =
        await Promise.all([
          this.playerService.getPlayerProfileOrNull(userId).catch(() => null),
          this.matchService.listPlayerMatchesOnce(userId, {
            platform: platform ?? undefined,
            limit: matchLimit,
          }).catch(() => [] as MatchUpdateView[]),
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
          firstValueFrom(
            this.statsService.getCommunityBenchmarks(platform ?? 'fortnite', periodId),
          ).catch(() => null),
          platform
            ? this.evolutionAi
                .getEvolutionAiReport(userId, platform, periodId)
                .catch(() => null)
            : Promise.resolve(null),
        ]);

      await this.loadRangeScopedData(userId, platform);

      this.gamerTag.set(profile?.gamerTag ?? '');
      this.avatarUrl.set(profile?.avatarUrl ?? undefined);
      this.recentMatches.set(matches);
      this.weekly.set(weeklyRows[0] ?? null);
      this.previousWeekly.set(previousWeeklyRows[0] ?? null);
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
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err, 'Error cargando estadísticas'));
    } finally {
      this.pageLoading.set(false);
    }
  }
}

function availableHistoryDays(matches: MatchUpdateView[]): number {
  const valid = matches
    .map((match) => new Date(match.updatedAt).getTime())
    .filter((stamp) => Number.isFinite(stamp));
  if (!valid.length) return 1;
  const oldest = Math.min(...valid);
  return Math.max(1, Math.min(365, Math.ceil((Date.now() - oldest) / 86_400_000) + 1));
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
