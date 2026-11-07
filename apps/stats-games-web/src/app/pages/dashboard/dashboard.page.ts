import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import {
  MOCK_COMMUNITY_BENCHMARKS,
  type CommunityBenchmarks,
  type CommunityRankTableView,
} from '../../data/community-mock.data';
import {
  filterMockMatchesByPlatform,
  resolveMatchHistory,
} from '../../data/match-mock.data';
import { AuthService } from '../../core/auth/auth.service';
import { AnalysisRangeService } from '../../core/analysis/analysis-range.service';
import {
  analysisRangeNoun,
  analysisRangeWeekSpan,
  previousPeriodId,
  type AnalysisRangeId,
} from '../../core/analysis/analysis-range';
import {
  buildDailyFormFromMatches,
  buildWeeklyFormFromMatches,
} from '../../core/charts/stats-chart.util';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import {
  lolChampionSplashFallbackUrl,
  lolChampionSplashUrl,
  lolFallbackSplashUrl,
} from '../../core/game/lol-ddragon.util';
import {
  valorantAgentSplashFallbackUrl,
  valorantAgentSplashUrl,
  valorantFallbackSplashUrl,
} from '../../core/game/valorant-assets.util';
import { isGameAccountConnected } from '../../core/game/platform-link.util';
import {
  matchBackendPlatform,
  selectedGameFromBackend,
  type SelectedGame,
} from '../../core/game/selected-game';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchAiService, type MatchAiReportView } from '../../services/match-ai.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { MatchNotificationsStore } from '../../stores/match-notifications.store';
import { InAppAlertsStore } from '../../stores/in-app-alerts.store';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  isoWeeklyPeriodIdForDay,
  listRecentWeeklyPeriodIds,
  type LeaderboardEntryView,
} from '../../services/stats.service';
import {
  AnalysisFiltersPanelComponent,
  CommunityRankTableComponent,
  MatchHighlightCardComponent,
  PercentileGaugesComponent,
  TrackStartPanelComponent,
  WeekHeroBrandComponent,
  WeeklyFormChartComponent,
  WeeklyHomeSummaryComponent,
  sgFadeSlideIn,
} from '../../ui';
import { matchDetailRoute } from '../../utils/match-analysis.util';
import {
  computeWinStreak,
  filterMatchesByAnalysisRange,
  filterMatchesInDayRange,
  filterMatchesInPreviousIsoWeek,
  filterMatchesOnCalendarDay,
  isMatchWin,
  mergeMatchUpdates,
  toMatchCardStats,
} from '../../utils/match-stats.util';
import { aggregatePlatformMatchStats } from '../../utils/platform-stats.util';
import {
  buildCommunityComparison,
  formatCommunitySampleSize,
  mapCommunityBenchmarksFromApi,
  parsePlayerKdForCommunity,
  parsePlayerWinRateForCommunity,
  type CommunityComparisonItem,
} from '../../utils/community-stats.util';
import { buildWeeklyAiCoachSummary, compactFocusHeadline } from '../../utils/weekly-ai-summary.util';
import {
  buildWeeklyCommunityRankView,
  mergeLeaderboardsAcrossPeriods,
} from '../../utils/weekly-community-rank.util';
import { extractGraphqlErrorMessage } from '../../utils/graphql-error.util';

type KpiDeltaTone = 'up' | 'down' | 'flat' | 'neutral';

interface KpiDelta {
  label: string;
  tone: KpiDeltaTone;
}

interface HeroKpi {
  id: string;
  label: string;
  value: string;
  delta: KpiDelta | null;
}

/**
 * Delta absoluto vs período anterior. `neutral` para KPIs de volumen, donde
 * subir o bajar no implica mejor o peor.
 */
function buildDelta(
  current: number | null,
  previous: number | null,
  options: { unit?: string; decimals?: number; neutral?: boolean } = {},
): KpiDelta | null {
  if (current == null || previous == null) return null;

  const decimals = options.decimals ?? 0;
  const diff = current - previous;
  const rounded = Number(diff.toFixed(decimals));
  const suffix = options.unit ? ` ${options.unit}` : '';

  if (rounded === 0) return { label: `=${suffix}`, tone: 'flat' };

  const sign = rounded > 0 ? '+' : '−';
  const label = `${sign}${Math.abs(rounded).toFixed(decimals)}${suffix}`;
  if (options.neutral) return { label, tone: 'neutral' };
  return { label, tone: rounded > 0 ? 'up' : 'down' };
}

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    RouterLink,
    TrackStartPanelComponent,
    MatchHighlightCardComponent,
    CommunityRankTableComponent,
    WeekHeroBrandComponent,
    WeeklyHomeSummaryComponent,
    AnalysisFiltersPanelComponent,
    WeeklyFormChartComponent,
    PercentileGaugesComponent,
  ],
  animations: [sgFadeSlideIn],
  template: `
    <ion-content class="sg-page-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div
        class="sg-dashboard sg-dashboard--home"
        [class.sg-dashboard--loading]="bootstrapped() && loading()"
      >
        @if (error()) {
          <p class="u-error sg-dashboard__error">{{ error() }}</p>
        }

        @if (!bootstrapped()) {
          <div
            class="sg-dashboard__loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Cargando"
          >
            <span class="sg-dashboard__loading-dots" aria-hidden="true">
              <i></i><i></i><i></i>
            </span>
          </div>
        } @else {
        <section
          class="sg-dashboard__week"
          [attr.data-game]="heroPlatform()"
          [attr.aria-label]="'Resumen · ' + rangeNoun()"
        >
          <img
            class="sg-dashboard__week-art"
            [src]="weekBannerSrc()"
            [alt]="platformMeta().label + ' splash'"
            (error)="onWeekBannerError()"
          />
          <div class="sg-dashboard__week-veil" aria-hidden="true"></div>

          <div class="sg-dashboard__week-inner">
            <sg-week-hero-brand [platform]="heroPlatform()" />
            <div class="sg-dashboard__week-main">
              <p class="sg-dashboard__week-eyebrow">
                {{ platformMeta().label }} Stats
                @if (lastUpdatedLabel()) {
                  <span>· Actualizado {{ lastUpdatedLabel() }}</span>
                }
              </p>
              <h1 class="sg-dashboard__week-title">Inicio</h1>
              <p class="sg-dashboard__week-lede u-m-0">
                @if (needsTrackingSetup()) {
                  Conectá tu cuenta del juego para ver KPIs reales, forma y análisis.
                } @else if (weekMatchCount() === 0) {
                  Todavía no hay partidas en {{ rangeNoun() }}. Probá ampliar el período.
                } @else {
                  Cómo venís en {{ rangeNoun() }}.
                }
              </p>

              <div class="sg-dashboard__week-mid">
                <div class="sg-dashboard__week-chips" aria-label="Contexto del período">
                  <span class="sg-dashboard__week-chip">{{ rangeMeta().label }}</span>
                  @if (winStreak() > 0) {
                    <span class="sg-dashboard__week-chip" data-tone="win">
                      Racha {{ winStreak() }}
                    </span>
                  }
                  @if (hasComparePeriod()) {
                    <span class="sg-dashboard__week-chip">vs {{ comparePeriodLabel() }}</span>
                  }
                </div>

                @if (needsTrackingSetup()) {
                  <div class="sg-dashboard__week-latest sg-dashboard__week-latest--empty">
                    <div class="sg-dashboard__week-latest-copy">
                      <span class="sg-dashboard__week-latest-label">Primer paso</span>
                      <span class="sg-dashboard__week-latest-title">
                        Vinculá {{ platformMeta().label }} para activar el dashboard
                      </span>
                    </div>
                    <a
                      routerLink="/tabs/integrations"
                      class="u-btn u-btn--gold sg-dashboard__week-cta"
                    >
                      Conectar
                    </a>
                  </div>
                } @else {
                  @if (focusHeadline(); as focus) {
                    <div class="sg-dashboard__week-latest">
                      <div class="sg-dashboard__week-latest-copy">
                        <span class="sg-dashboard__week-latest-label">Tu foco ahora</span>
                        <span class="sg-dashboard__week-latest-title">{{ focus }}</span>
                      </div>
                      <button
                        type="button"
                        class="u-btn u-btn--gold sg-dashboard__week-cta"
                        (click)="onAiCta()"
                      >
                        {{ aiCtaLabel() }}
                      </button>
                    </div>
                  }
                }
              </div>

              <div class="sg-dashboard__week-kpis" [attr.aria-label]="'KPIs · ' + rangeNoun()">
                @for (kpi of heroKpis(); track kpi.id) {
                  <div class="sg-dashboard__week-kpi">
                    <span class="sg-dashboard__week-kpi-value">{{ kpi.value }}</span>
                    <span class="sg-dashboard__week-kpi-label">{{ kpi.label }}</span>
                    <span
                      class="sg-dashboard__week-kpi-delta"
                      [attr.data-tone]="kpi.delta?.tone ?? 'empty'"
                      [attr.title]="
                        kpi.delta
                          ? kpi.label + ' ' + kpi.delta.label + ' vs ' + comparePeriodLabel()
                          : null
                      "
                    >
                      @if (kpi.delta; as delta) {
                        <span class="sg-dashboard__week-kpi-arrow" aria-hidden="true"></span>
                        {{ delta.label }}
                      } @else {
                        —
                      }
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>
        </section>

        <div class="sg-dashboard__body">
          @if (previewNotice(); as notice) {
            <aside class="sg-dashboard__preview" role="status">
              <span class="sg-dashboard__preview-tag">Datos de ejemplo</span>
              <p class="sg-dashboard__preview-copy u-m-0">{{ notice }}</p>
              <a routerLink="/tabs/integrations" class="u-btn u-btn--ghost-gold u-btn--sm">
                Revisar conexión
              </a>
            </aside>
          }

          <section class="sg-dashboard__block" aria-labelledby="dash-section-filters">
            <div class="sg-dashboard__block-head">
              <div>
                <h2 id="dash-section-filters" class="sg-dashboard__block-title">Filtros</h2>
                <p class="sg-dashboard__block-desc">
                  Elegí el período que querés analizar.
                </p>
              </div>
            </div>
            <sg-analysis-filters-panel
              [value]="analysisRange.range()"
              [selectedDayIso]="analysisRange.selectedDayIso()"
              (rangeChange)="onAnalysisRangeChange($event)"
              (dayChange)="onAnalysisDayChange($event)"
            />
          </section>

          <section class="sg-dashboard__block" aria-labelledby="dash-section-focus">
            <div class="sg-dashboard__block-head">
              <div>
                <h2 id="dash-section-focus" class="sg-dashboard__block-title">Tu foco ahora</h2>
                <p class="sg-dashboard__block-desc">
                  @if (needsTrackingSetup()) {
                    Vinculá tu cuenta para ver en qué conviene enfocarte.
                  } @else {
                    Una acción concreta para mejorar.
                  }
                </p>
              </div>
              @if (!needsTrackingSetup()) {
                <a routerLink="/tabs/ai-coach" class="sg-dashboard__block-link">
                  Ver Coach →
                </a>
              }
            </div>
            @if (needsTrackingSetup()) {
              <sg-track-start-panel [platform]="heroPlatform()" />
            } @else {
              @if (focusHeadline(); as focus) {
                <div class="sg-dashboard__focus-row">
                  <p class="sg-dashboard__focus u-m-0">{{ focus }}</p>
                  <button
                    type="button"
                    class="u-btn u-btn--gold u-btn--sm sg-dashboard__focus-cta"
                    (click)="onAiCta()"
                  >
                    {{ aiCtaLabel() }}
                  </button>
                </div>
              }
              <sg-weekly-home-summary
                class="sg-dashboard__focus-detail"
                [summary]="weeklyCoach()"
                [kdLabel]="kdLabel()"
                [ctaLabel]="aiCtaLabel()"
                [showMeta]="false"
                [showCharts]="false"
                [showFocusChip]="false"
                (primaryClick)="onAiCta()"
              />
            }
          </section>

          @if (!needsTrackingSetup()) {
            <section class="sg-dashboard__block" aria-labelledby="dash-section-form">
              <div class="sg-dashboard__block-head">
                <div>
                  <h2 id="dash-section-form" class="sg-dashboard__block-title">Tu forma</h2>
                  <p class="sg-dashboard__block-desc">
                    Mirá si tu rendimiento está subiendo o bajando.
                  </p>
                </div>
                <a routerLink="/tabs/analytics" class="sg-dashboard__block-link">
                  Ver evolución →
                </a>
              </div>

              @if (weekMatchCount() === 0) {
                <p class="sg-dashboard__form-empty u-m-0">
                  Sin partidas en {{ rangeNoun() }}: no hay curva para dibujar. Probá ampliar el
                  período o jugá una partida para empezar la serie.
                </p>
              } @else {
                <sg-weekly-form-chart
                  [title]="formChartTitle()"
                  [subtitle]="formChartSubtitle()"
                  variant="wr-kd"
                  [kdLabel]="kdLabel()"
                  [points]="formPoints()"
                />
              }
            </section>

            <section class="sg-dashboard__block" aria-labelledby="dash-section-community">
              <div class="sg-dashboard__block-head">
                <div>
                  <h2 id="dash-section-community" class="sg-dashboard__block-title">
                    Vs la comunidad
                  </h2>
                  <p class="sg-dashboard__block-desc">{{ communityScopeDesc() }}</p>
                </div>
                <a routerLink="/tabs/analytics" class="sg-dashboard__block-link">
                  Ranking completo →
                </a>
              </div>

              @if (communityItems().length) {
                <sg-percentile-gauges
                  title="Cuánto de la comunidad superás"
                  [subtitle]="communitySampleLabel()"
                  [items]="communityItems()"
                />
              }

              @if (communityRank(); as rank) {
                <sg-community-rank-table
                  class="sg-dashboard__community-detail"
                  variant="snapshot"
                  title="Vecindario cercano"
                  deepLink="/tabs/analytics"
                  [platform]="heroPlatform()"
                  [rows]="rank.rows"
                  [yourRank]="rank.yourRank"
                  [totalPlayers]="rank.totalPlayers"
                  [sampleLabel]="communitySampleLabel()"
                  [subtitle]="communityRankSubtitle()"
                />
              } @else {
                <aside class="sg-weekly-coach__empty-rank" role="status">
                  <p class="sg-weekly-coach__empty-rank-title u-m-0">
                    Ranking comunitario aún sin peers
                  </p>
                  <p class="sg-weekly-coach__empty-rank-body u-m-0">
                    No hay jugadores reales en el leaderboard semanal de
                    {{ platformMeta().label }}. Cuando haya peers esta semana, te comparamos acá.
                  </p>
                </aside>
              }
            </section>
          }

          <section class="sg-dashboard__block" aria-labelledby="dash-section-latest" @sgFadeSlideIn>
            <div class="sg-dashboard__block-head">
              <div>
                <h2 id="dash-section-latest" class="sg-dashboard__block-title">
                  Mejor partida · {{ rangeMeta().label }}
                </h2>
                <p class="sg-dashboard__block-desc">
                  Tu mejor resultado del período.
                </p>
              </div>
              <a routerLink="/tabs/matches" class="sg-dashboard__block-link">Ver partidas →</a>
            </div>

            @if (highlightMatch(); as match) {
              <sg-match-highlight-card
                [matchId]="match.matchId"
                [platform]="match.platform"
                [summary]="match.summary"
                [updatedAt]="match.updatedAt"
                [stats]="match.stats"
                [showHistoryLink]="false"
                [compact]="true"
                [fresh]="notifications.isFreshMatch(match.matchId)"
              />
            } @else {
              <article class="sg-dashboard__empty-card">
                <div class="sg-dashboard__empty-copy-wrap">
                  <h3 class="sg-dashboard__empty-title">Sin partida destacada todavía</h3>
                  <p class="sg-dashboard__empty-copy u-m-0">
                    Cuando vinculés tu cuenta y juegues, acá aparece tu mejor resultado del
                    período (victoria, placement o highlight de kills).
                  </p>
                </div>
                <div class="sg-dashboard__empty-actions">
                  <a routerLink="/tabs/matches" class="u-btn u-btn--gold">Ir a Partidas</a>
                </div>
              </article>
            }
          </section>
        </div>
        }
      </div>
    </ion-content>
  `,
})
export class DashboardPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly realtime = inject(AppSyncRealtimeService);
  readonly notifications = inject(MatchNotificationsStore);
  private readonly productAlerts = inject(InAppAlertsStore);
  private readonly gameContext = inject(GameContextService);
  readonly analysisRange = inject(AnalysisRangeService);
  private readonly matchService = inject(MatchService);
  private readonly matchAi = inject(MatchAiService);
  private readonly playerService = inject(PlayerService);
  private readonly statsService = inject(StatsService);
  private readonly router = inject(Router);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly communityBenchmarksApi = signal<CommunityBenchmarks | null>(null);
  readonly leaderboardApi = signal<LeaderboardEntryView[]>([]);
  readonly latestAiReport = signal<MatchAiReportView | null>(null);
  readonly loading = signal(true);
  /** Evita flash de mocks / onboarding antes de la 1ª hidratación. */
  readonly bootstrapped = signal(false);
  readonly lastUpdatedAt = signal<Date | null>(null);
  readonly error = signal<string | null>(null);

  readonly heroPlatform = computed(() => {
    const g = this.gameContext.activeGame();
    if (g) return g;
    const primary = this.profile()?.primaryPlatform?.toLowerCase();
    if (primary === 'roblox') return 'blox_fruits' as const;
    if (
      primary === 'valorant' ||
      primary === 'league_of_legends' ||
      primary === 'cs2' ||
      primary === 'dota2' ||
      primary === 'overwatch2' ||
      primary === 'rocket_league' ||
      primary === 'fortnite' ||
      primary === 'clash_royale' ||
      primary === 'brawl_stars'
    ) {
      return primary;
    }
    return 'fortnite' as const;
  });

  readonly platformMeta = computed(() => gamePlatformMeta(this.heroPlatform()));
  readonly rangeMeta = computed(() => this.analysisRange.meta());
  readonly rangeNoun = computed(() =>
    analysisRangeNoun(this.analysisRange.range(), this.analysisRange.selectedDayIso()),
  );
  private readonly weekBannerFailed = signal(false);
  /** Tras fallo del splash del campeón, probar splash curado una vez. */
  private readonly weekBannerRetried = signal(false);

  /** Splash centered (CDragon) → splash campeón / cinematic → SVG. */
  readonly weekBannerSrc = computed(() => {
    const meta = this.platformMeta();
    const localFallback = meta.portraitFallbackUrl || meta.artUrl;

    if (this.weekBannerFailed() && this.weekBannerRetried()) {
      return localFallback;
    }

    if (this.heroPlatform() === 'league_of_legends') {
      if (this.weekBannerFailed()) {
        // 2º intento: splash Data Dragon del campeón, o cinematic curado
        const champ =
          this.highlightMatch()?.stats?.champion ??
          this.weekMatches().find((m) => m.stats?.champion)?.stats?.champion;
        return (
          lolChampionSplashFallbackUrl(champ) ??
          lolFallbackSplashUrl((this.profile()?.gamerTag ?? 'lol').length + 3)
        );
      }
      return this.weekLolSplashUrl() ?? localFallback;
    }

    if (this.heroPlatform() === 'valorant') {
      if (this.weekBannerFailed()) {
        const agent =
          this.highlightMatch()?.stats?.agent ??
          this.weekMatches().find((m) => m.stats?.agent)?.stats?.agent;
        return (
          valorantAgentSplashFallbackUrl(agent) ??
          valorantFallbackSplashUrl((this.profile()?.gamerTag ?? 'val').length + 3)
        );
      }
      return this.weekValorantSplashUrl() ?? localFallback;
    }

    if (this.weekBannerFailed()) {
      return localFallback;
    }

    const videoId = meta.officialTrailerVideoId;
    if (videoId) {
      return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }
    return meta.portraitUrl || meta.artUrl;
  });

  /** Campeón más relevante de la semana → splash HQ oficial Riot CDN. */
  private readonly weekLolSplashUrl = computed(() => {
    if (this.heroPlatform() !== 'league_of_legends') return null;

    const fromHighlight = this.highlightMatch()?.stats?.champion;
    const fromSplash = lolChampionSplashUrl(fromHighlight);
    if (fromSplash) return fromSplash;

    const fromRecent = this.weekMatches().find((m) => m.stats?.champion)?.stats?.champion;
    const recentSplash = lolChampionSplashUrl(fromRecent);
    if (recentSplash) return recentSplash;

    const seed = (this.profile()?.gamerTag ?? 'lol').length;
    return lolFallbackSplashUrl(seed);
  });

  /** Agente más relevante de la semana → fullportrait Valorant API. */
  private readonly weekValorantSplashUrl = computed(() => {
    if (this.heroPlatform() !== 'valorant') return null;

    const fromHighlight = this.highlightMatch()?.stats?.agent;
    const fromSplash = valorantAgentSplashUrl(fromHighlight);
    if (fromSplash) return fromSplash;

    const fromRecent = this.weekMatches().find((m) => m.stats?.agent)?.stats?.agent;
    const recentSplash = valorantAgentSplashUrl(fromRecent);
    if (recentSplash) return recentSplash;

    const seed = (this.profile()?.gamerTag ?? 'val').length;
    return valorantFallbackSplashUrl(seed);
  });

  constructor() {
    effect(() => {
      this.heroPlatform();
      this.weekLolSplashUrl();
      this.weekValorantSplashUrl();
      this.weekBannerFailed.set(false);
      this.weekBannerRetried.set(false);
    });
    effect(
      () => {
        if (this.gameContext.refreshTick() === 0) return;
        // Al cambiar de juego: skeleton hasta hidratar el nuevo contexto (evita panel de
        // "conectar" / KPIs del juego anterior).
        this.bootstrapped.set(false);
        this.leaderboardApi.set([]);
        this.communityBenchmarksApi.set(null);
        void this.loadData();
      },
      { allowSignalWrites: true },
    );
    effect(
      () => {
        const live = this.realtime.liveMatches();
        if (!live.length) return;
        this.recentMatches.update((current) => mergeMatchUpdates(live, current));
      },
      { allowSignalWrites: true },
    );
    effect(
      () => {
        if (!this.bootstrapped() || this.loading()) return;
        this.emitProductAlerts();
      },
      { allowSignalWrites: true },
    );
  }

  onWeekBannerError(): void {
    if (!this.weekBannerFailed()) {
      this.weekBannerFailed.set(true);
      return;
    }
    if (!this.weekBannerRetried()) {
      this.weekBannerRetried.set(true);
    }
  }

  readonly kdLabel = computed(() => {
    const platform = this.heroPlatform();
    return platform === 'valorant' ||
      platform === 'league_of_legends' ||
      platform === 'dota2' ||
      platform === 'overwatch2'
      ? 'KDA'
      : 'K/D';
  });

  readonly weekMatches = computed(() =>
    filterMatchesByAnalysisRange(
      this.effectiveRecentMatches(),
      this.analysisRange.range(),
      this.analysisRange.selectedDayIso(),
    ),
  );

  /**
   * Única fuente de verdad de los KPIs: siempre las partidas del rango elegido.
   * Mezclar el rollup semanal con las partidas del cliente hacía que WR,
   * Victorias y Partidas no reconciliaran entre sí.
   */
  readonly rangeSummary = computed(() => aggregatePlatformMatchStats(this.weekMatches()));

  /** Partidas del período inmediatamente anterior, para los deltas del hero. */
  readonly previousRangeMatches = computed(() => {
    const matches = this.effectiveRecentMatches();
    const meta = this.rangeMeta();
    if (meta.id === 'all') return [];
    if (meta.isSingleDay) {
      return filterMatchesOnCalendarDay(
        matches,
        previousPeriodId(this.analysisRange.selectedDayIso()),
      );
    }
    if (meta.preferWeeklyRollup) return filterMatchesInPreviousIsoWeek(matches);
    return filterMatchesInDayRange(matches, meta.days, meta.days * 2);
  });

  readonly previousSummary = computed(() =>
    aggregatePlatformMatchStats(this.previousRangeMatches()),
  );

  /** Sin período previo (o sin partidas en él) no mostramos deltas engañosos. */
  readonly hasComparePeriod = computed(
    () =>
      this.rangeMeta().id !== 'all' &&
      this.previousSummary().matchCount > 0 &&
      this.rangeSummary().matchCount > 0,
  );

  readonly comparePeriodLabel = computed(() => {
    switch (this.rangeMeta().id) {
      case 'day':
        return 'el día anterior';
      case 'week':
        return 'la semana pasada';
      case '30d':
        return 'los 30 días previos';
      case '90d':
        return 'los 90 días previos';
      default:
        return 'el período anterior';
    }
  });

  readonly usesKdaRatio = computed(() => this.kdLabel() === 'KDA');

  /** Racha de victorias en curso (partidas más recientes del rango). */
  readonly winStreak = computed(() => computeWinStreak(this.weekMatches()));

  readonly heroKpis = computed((): HeroKpi[] => {
    const current = this.rangeSummary();
    const previous = this.previousSummary();
    const compare = this.hasComparePeriod();
    const useKda = this.usesKdaRatio();

    const winRatePct = (s: typeof current) =>
      s.matchCount > 0 ? (s.winCount / s.matchCount) * 100 : null;
    // KDA incluye asistencias; K/D no. Antes ambos usaban la fórmula de K/D.
    const ratio = (s: typeof current) => {
      if (s.matchCount === 0) return null;
      const numerator = useKda ? s.totalKills + s.totalAssists : s.totalKills;
      return numerator / Math.max(s.totalDeaths, 1);
    };

    return [
      {
        id: 'win-rate',
        label: 'Win rate',
        value: current.winRate,
        delta: compare
          ? buildDelta(winRatePct(current), winRatePct(previous), { unit: 'pts', decimals: 0 })
          : null,
      },
      {
        id: 'kd',
        label: this.kdLabel(),
        value: useKda ? current.kda : current.kd,
        delta: compare ? buildDelta(ratio(current), ratio(previous), { decimals: 2 }) : null,
      },
      {
        id: 'wins',
        label: 'Victorias',
        value: String(current.winCount),
        delta: compare ? buildDelta(current.winCount, previous.winCount, { decimals: 0 }) : null,
      },
      {
        id: 'matches',
        label: 'Partidas',
        value: String(current.matchCount),
        // Jugar más o menos no es bueno ni malo: solo volumen.
        delta: compare
          ? buildDelta(current.matchCount, previous.matchCount, {
              decimals: 0,
              neutral: true,
            })
          : null,
      },
      {
        id: 'streak',
        label: 'Racha',
        value: this.winStreak() > 0 ? `${this.winStreak()}` : '—',
        delta: null,
      },
    ];
  });

  /**
   * Forma alineada al período: días para rangos cortos, semanas ISO para los
   * largos. Antes eran siempre semanas fijas y el filtro parecía no hacer nada.
   */
  readonly formPoints = computed(() => {
    const meta = this.rangeMeta();
    const useKda = this.usesKdaRatio();
    if (meta.id === 'day' || meta.id === 'week') {
      return buildDailyFormFromMatches(this.effectiveRecentMatches(), {
        days: meta.id === 'day' ? 7 : 7,
        useKda,
      });
    }
    return buildWeeklyFormFromMatches(this.effectiveRecentMatches(), {
      weeks: meta.formWeeks,
      useKda,
    });
  });

  readonly formChartTitle = computed(() => {
    const bucket = this.formBucketNoun();
    return `Win rate y ${this.kdLabel()} por ${bucket}`;
  });

  readonly formBucketNoun = computed(() => {
    const id = this.rangeMeta().id;
    return id === 'day' || id === 'week' ? 'día' : 'semana';
  });

  readonly formChartSubtitle = computed(() =>
    this.formBucketNoun() === 'día'
      ? 'Últimos 7 días. Los días sin partidas quedan en gap.'
      : `Últimas ${this.rangeMeta().formWeeks} semanas ISO. Las semanas sin partidas quedan en gap.`,
  );

  readonly communityItems = computed((): CommunityComparisonItem[] => {
    const platform = this.heroPlatform();
    const benchmarks =
      this.communityBenchmarksApi() ??
      (this.bootstrapped() ? MOCK_COMMUNITY_BENCHMARKS[platform] : null);
    if (!benchmarks) return [];

    const summary = this.rangeSummary();
    if (summary.matchCount === 0) return [];

    // Mismos números que las tiles del hero, para que no haya dos verdades.
    const kd = this.usesKdaRatio() ? summary.kda : summary.kd;
    return buildCommunityComparison({
      benchmarks,
      winRate: summary.winRate,
      winRateNumeric: parsePlayerWinRateForCommunity(summary.winRate),
      kd,
      kdNumeric: parsePlayerKdForCommunity(kd),
      kills: summary.totalKills,
      matchCount: summary.matchCount,
      kdLabel: this.kdLabel(),
      killsLabel:
        platform === 'rocket_league'
          ? 'Goles'
          : platform === 'fortnite'
            ? 'Elims'
            : 'Kills',
    });
  });

  readonly lastUpdatedLabel = computed(() => {
    const stamp = this.lastUpdatedAt();
    if (!stamp) return '';
    return stamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  });

  readonly weekMatchCount = computed(() => this.rangeSummary().matchCount);

  /**
   * Onboarding de conexión solo si el juego activo no tiene ID vinculado en el perfil.
   * Un rollup semanal vacío ≠ sin conectar (p. ej. LoL vinculado sin partidas esta semana).
   */
  readonly needsTrackingSetup = computed(() => {
    if (!this.bootstrapped() || this.loading()) return false;
    return !isGameAccountConnected(this.heroPlatform(), this.profile());
  });

  readonly highlightMatch = computed(() => {
    const matches = this.weekMatches();
    if (!matches.length) return null;
    const platform = this.heroPlatform();

    const ranked = [...matches].sort((a, b) => {
      const winA = a.stats?.won === true || a.stats?.placement === 1 ? 1 : 0;
      const winB = b.stats?.won === true || b.stats?.placement === 1 ? 1 : 0;
      if (winA !== winB) return winB - winA;

      if (platform === 'fortnite') {
        const pa = a.stats?.placement ?? 999;
        const pb = b.stats?.placement ?? 999;
        if (pa !== pb) return pa - pb;
      }

      const scoreA =
        (a.stats?.kills ?? a.stats?.goals ?? 0) * 3 +
        (a.stats?.assists ?? 0) +
        (a.stats?.score ?? 0) / 100;
      const scoreB =
        (b.stats?.kills ?? b.stats?.goals ?? 0) * 3 +
        (b.stats?.assists ?? 0) +
        (b.stats?.score ?? 0) / 100;
      return scoreB - scoreA;
    });

    const best = ranked[0];
    return {
      matchId: best.matchId,
      platform: best.platform,
      summary: best.summary,
      updatedAt: best.updatedAt,
      stats: toMatchCardStats(best.stats),
    };
  });

  readonly effectiveRecentMatches = computed(() => {
    const platform = this.heroPlatform();
    const api = filterMockMatchesByPlatform(this.recentMatches(), platform);
    if (api.length > 0) return api;

    const userId = this.auth.userId();
    // Sin cuenta vinculada: vacío (el track panel cubre el CTA).
    if (userId && !isGameAccountConnected(platform, this.profile())) {
      return [];
    }

    // Guest o cuenta vinculada sin ingest: preview (mismo criterio que Partidas).
    return resolveMatchHistory([], userId || 'mock-user-demo', platform);
  });

  /** True cuando Inicio está en preview (API sin partidas del juego). */
  readonly matchesUsePreview = computed(() => {
    const platform = this.heroPlatform();
    const api = filterMockMatchesByPlatform(this.recentMatches(), platform);
    return api.length === 0 && this.effectiveRecentMatches().length > 0;
  });

  readonly communityUsesMock = computed(() => this.communityBenchmarksApi() == null);

  /**
   * Aviso explícito cuando lo que se ve no son datos propios. Antes era un chip
   * "preview" perdido en un párrafo, con los KPIs falsos al mismo nivel visual.
   */
  readonly previewNotice = computed(() => {
    if (!this.bootstrapped() || this.needsTrackingSetup()) return null;
    if (this.matchesUsePreview()) {
      return `Todavía no llegaron partidas reales de ${this.platformMeta().label}. Los KPIs y gráficos de abajo son un ejemplo para que veas cómo se va a ver.`;
    }
    if (this.communityUsesMock()) {
      return `La muestra de comunidad de ${this.platformMeta().label} todavía es de ejemplo. Tus KPIs son reales; los percentiles y el ranking no.`;
    }
    return null;
  });

  /** Una sola recomendación corta. El detalle vive en Coach. */
  readonly focusHeadline = computed(() => {
    const coach = this.weeklyCoach();
    const raw = coach.focusNext?.trim() || coach.headline?.trim() || null;
    return raw ? compactFocusHeadline(raw) : null;
  });

  readonly weeklyCoach = computed(() => {
    const platform = this.heroPlatform();
    return buildWeeklyAiCoachSummary({
      platform,
      weekMatches: this.weekMatches(),
      latestAiReport: this.latestAiReport(),
      communityBenchmarks:
        this.communityBenchmarksApi() ??
        (this.bootstrapped() ? MOCK_COMMUNITY_BENCHMARKS[platform] : undefined),
      kdLabel: this.kdLabel(),
    });
  });

  readonly communityRank = computed<CommunityRankTableView | null>(() => {
    // Los peers salen del leaderboard semanal (backend WEEKLY), pero tu fila
    // refleja el rango elegido (día / semana / 30d / 90d).
    const summary = this.rangeSummary();
    const kd =
      summary.totalDeaths > 0
        ? summary.totalKills / summary.totalDeaths
        : summary.totalKills;
    const winRate =
      summary.matchCount > 0 ? (summary.winCount / summary.matchCount) * 100 : 0;

    return buildWeeklyCommunityRankView({
      platform: this.heroPlatform(),
      userId: this.auth.userId(),
      apiRows: this.leaderboardApi(),
      sampleSize: this.communityBenchmarksApi()?.sampleSize ?? null,
      // Inicio: solo rivales inmediatos (±2). El board completo vive en Evolución.
      radius: 2,
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

  /**
   * El leaderboard del backend es semanal, así que el scope de los rivales no
   * siempre coincide con el rango elegido. Se dice explícitamente.
   */
  readonly communityScopeDesc = computed(() => {
    const weeks = analysisRangeWeekSpan(this.analysisRange.range());
    if (this.rangeMeta().isSingleDay) {
      return 'Tus números del día contra los rivales de esa semana ISO.';
    }
    if (weeks === 1) return 'Rivales de la semana ISO en curso: quién está arriba y abajo tuyo.';
    return `Tus números de ${this.rangeMeta().label} contra los rivales de las últimas ${weeks} semanas ISO.`;
  });

  readonly communitySampleLabel = computed(() => {
    const platform = this.heroPlatform();
    const benchmarks =
      this.communityBenchmarksApi() ?? MOCK_COMMUNITY_BENCHMARKS[platform];
    return `${gamePlatformMeta(platform).label} · ${formatCommunitySampleSize(benchmarks.sampleSize)} jugadores`;
  });

  readonly communityRankSubtitle = computed(() => {
    const rank = this.communityRank();
    const label = this.platformMeta().label;
    if (!rank) return `${label} · sin peers reales esta semana`;
    return `${label} · #${rank.yourRank} · ${this.rangeMeta().label} · rivales ±2 puestos`;
  });

  readonly aiCtaLabel = computed(() => {
    const report = this.latestAiReport();
    if (report?.status === 'ready' && report.matchId) {
      return 'Ver último análisis de partida';
    }
    return `Ver análisis · ${this.rangeMeta().shortLabel}`;
  });

  ngOnInit(): void {
    void this.loadData();
    this.realtime.ensureConnected();
  }

  onAnalysisRangeChange(id: AnalysisRangeId): void {
    this.analysisRange.setRange(id);
    void this.refreshRangeLeaderboard();
  }

  onAnalysisDayChange(dayIso: string): void {
    this.analysisRange.setDay(dayIso);
    void this.refreshRangeLeaderboard();
  }

  private async refreshRangeLeaderboard(): Promise<void> {
    const platform = matchBackendPlatform(this.heroPlatform());
    this.leaderboardApi.set(await this.loadRangeLeaderboard(platform));
  }

  /**
   * Board del rango. El backend solo guarda leaderboards semanales: 30d/90d se
   * agregan sumando semanas ISO y "Día" usa la semana que contiene ese día.
   */
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

  async refresh(event: CustomEvent): Promise<void> {
    await this.loadData();
    (event.target as HTMLIonRefresherElement).complete();
  }

  onAiCta(): void {
    const report = this.latestAiReport();
    if (report?.status === 'ready' && report.matchId) {
      void this.router.navigateByUrl(matchDetailRoute(report.matchId));
      return;
    }
    void this.router.navigateByUrl('/tabs/ai-coach');
  }

  private emitProductAlerts(): void {
    const platform = this.heroPlatform();
    const periodId = currentWeeklyPeriodIdForStats();
    const meta = this.platformMeta();
    const connected = isGameAccountConnected(platform, this.profile());

    if (this.needsTrackingSetup() || !connected) {
      this.productAlerts.push({
        kind: 'sync_stale',
        title: `Sync · ${meta.label}`,
        body: 'Cuenta sin vincular o desactualizada. Conectá para refrescar partidas y ranking.',
        route: '/tabs/integrations',
        dedupKey: `sync_stale:${platform}:${periodId}`,
      });
      return;
    }

    const coach = this.weeklyCoach();
    if (coach.matchCount >= 3 && (coach.formBand === 'cold' || coach.regressions.length >= 2)) {
      this.productAlerts.push({
        kind: 'forma_down',
        title: 'Forma en baja',
        body:
          coach.regressions[0] ||
          'WR/KDA de la semana por debajo de tu media. Revisá el foco en Coach.',
        route: '/tabs/ai-coach',
        dedupKey: `forma_down:${platform}:${periodId}`,
      });
    }

    const report = this.latestAiReport();
    if (report?.status === 'ready' && report.matchId) {
      this.productAlerts.push({
        kind: 'report_ready',
        title: 'Reporte IA listo',
        body: report.headline?.trim() || 'Tu último análisis de partida ya está disponible.',
        route: matchDetailRoute(report.matchId),
        dedupKey: `report_ready:${report.matchId}`,
      });
    }

    const rank = this.communityRank();
    const you = rank?.rows.find((row) => row.isYou);
    if (you && you.trend === 'up' && you.rank > 0) {
      const lpLabel = platform === 'valorant' ? 'RR' : platform === 'league_of_legends' ? 'LP' : 'rank';
      this.productAlerts.push({
        kind: 'rank_up',
        title: `Subiste en el ranking (${lpLabel})`,
        body: `#${you.rank} · ${you.delta} esta semana. Compartí tu ficha si querés.`,
        route: '/tabs/profile',
        dedupKey: `rank_up:${platform}:${periodId}:${you.rank}`,
      });
    } else if (you && you.trend === 'down' && you.rank > 0) {
      const lpLabel = platform === 'valorant' ? 'RR' : platform === 'league_of_legends' ? 'LP' : 'rank';
      this.productAlerts.push({
        kind: 'rank_down',
        title: `Bajaste en el ranking (${lpLabel})`,
        body: `#${you.rank} · ${you.delta}. Revisá forma y rivales en Evolución.`,
        route: '/tabs/analytics',
        dedupKey: `rank_down:${platform}:${periodId}:${you.rank}`,
      });
    }
  }

  private async loadData(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) {
      this.loading.set(false);
      this.bootstrapped.set(true);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const profile = await this.playerService.getPlayerProfileOrNull(userId);
      if (!profile) {
        await this.router.navigateByUrl('/onboarding');
        return;
      }
      this.profile.set(profile);

      const uiGame: SelectedGame =
        this.gameContext.activeGame() ??
        selectedGameFromBackend(profile.primaryPlatform) ??
        'fortnite';
      const platform = matchBackendPlatform(uiGame);
      const periodId = currentWeeklyPeriodIdForStats();
      const range = this.rangeMeta();
      const matchLimit =
        range.id === 'all' ? 150 : Math.min(150, Math.max(50, range.days + 40));

      const [matches, community, leaderboard, aiReports] = await Promise.all([
        this.matchService.listPlayerMatchesOnce(userId, {
          platform: platform ?? undefined,
          limit: matchLimit,
        }),
        firstValueFrom(
          this.statsService.getCommunityBenchmarks(platform ?? 'fortnite', periodId),
        ).catch(() => null),
        this.loadRangeLeaderboard(platform),
        this.matchAi
          .listMatchAiReportsOnce(userId, {
            platform: platform ?? undefined,
            limit: 10,
          })
          .catch(() => [] as MatchAiReportView[]),
      ]);

      this.recentMatches.set(matches);
      this.lastUpdatedAt.set(new Date());
      this.latestAiReport.set(
        aiReports.find((row) => row.status === 'ready') ?? aiReports[0] ?? null,
      );
      this.leaderboardApi.set(leaderboard ?? []);

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
      this.error.set(extractGraphqlErrorMessage(err, 'Error cargando dashboard'));
    } finally {
      this.loading.set(false);
      this.bootstrapped.set(true);
    }
  }
}
