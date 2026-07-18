import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { MOCK_COMMUNITY_BENCHMARKS } from '../../data/community-mock.data';
import {
  buildMockMatchHistory,
  filterMockMatchesByPlatform,
} from '../../data/match-mock.data';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import {
  lolChampionSplashFallbackUrl,
  lolChampionSplashUrl,
  lolFallbackSplashUrl,
} from '../../core/game/lol-ddragon.util';
import { isGameAccountConnected } from '../../core/game/platform-link.util';
import {
  matchBackendPlatform,
  selectedGameFromBackend,
  type SelectedGame,
} from '../../core/game/selected-game';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchAiService, type MatchAiReportView } from '../../services/match-ai.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import type { CommunityBenchmarks } from '../../data/community-mock.data';
import {
  MatchHighlightCardComponent,
  TrackStartPanelComponent,
  WeeklyHomeSummaryComponent,
} from '../../ui';
import { matchDetailRoute } from '../../utils/match-analysis.util';
import {
  aggregateMatchStats,
  computeKdRatio,
  filterMatchesWithinDays,
  toMatchCardStats,
} from '../../utils/match-stats.util';
import { mapCommunityBenchmarksFromApi } from '../../utils/community-stats.util';
import { buildWeeklyAiCoachSummary } from '../../utils/weekly-ai-summary.util';
import { extractGraphqlErrorMessage } from '../../utils/graphql-error.util';

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
    WeeklyHomeSummaryComponent,
  ],
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
          aria-label="Resumen semanal"
        >
          <img
            class="sg-dashboard__week-art"
            [src]="weekBannerSrc()"
            [alt]="platformMeta().label + ' splash'"
            (error)="onWeekBannerError()"
          />
          <div class="sg-dashboard__week-veil" aria-hidden="true"></div>

          <div class="sg-dashboard__week-inner">
            <div class="sg-dashboard__week-main">
              <p class="sg-dashboard__week-eyebrow">
                {{ platformMeta().label }} Stats
                @if (lastUpdatedLabel()) {
                  <span>· Actualizado {{ lastUpdatedLabel() }}</span>
                }
              </p>
              <h1 class="sg-dashboard__week-title">
                {{ profile()?.gamerTag || 'Tu rendimiento' }}
              </h1>
              <p class="sg-dashboard__week-lede u-m-0">
                @if (needsTrackingSetup()) {
                  Conectá tu cuenta del juego para ver KPIs reales, forma semanal y análisis.
                } @else if (weekMatchCount() === 0) {
                  Todavía no hay partidas en la ventana semanal. Cuando juegues, acá aparece el
                  resumen de forma y el análisis.
                } @else {
                  Esta semana: {{ weekSummary().winCount }}V /
                  {{ weekMatchCount() }} partidas · WR {{ weekSummary().winRate }}.
                }
              </p>

              <div class="sg-dashboard__week-kpis" aria-label="KPIs de la semana">
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ weekSummary().winRate }}</span>
                  <span class="sg-dashboard__week-kpi-label">Win rate</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ weeklyKd() }}</span>
                  <span class="sg-dashboard__week-kpi-label">{{ kdLabel() }}</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ weekSummary().winCount }}</span>
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

        <div class="sg-dashboard__body">
          <section class="sg-dashboard__block" aria-labelledby="dash-section-analysis">
            @if (needsTrackingSetup()) {
              <div class="sg-dashboard__block-head">
                <div>
                  <h2 id="dash-section-analysis" class="sg-dashboard__block-title">
                    Análisis semanal
                  </h2>
                  <p class="sg-dashboard__block-desc">
                    Vinculá tu cuenta para ver cómo venís esta semana.
                  </p>
                </div>
              </div>
              <sg-track-start-panel [platform]="heroPlatform()" />
            } @else {
              <sg-weekly-home-summary
                [summary]="weeklyCoach()"
                [kdLabel]="kdLabel()"
                [ctaLabel]="aiCtaLabel()"
                (primaryClick)="onAiCta()"
              />
            }
          </section>

          <section class="sg-dashboard__block" aria-labelledby="dash-section-latest">
            <div class="sg-dashboard__block-head">
              <div>
                <h2 id="dash-section-latest" class="sg-dashboard__block-title">
                  Partida destacada
                </h2>
                <p class="sg-dashboard__block-desc">
                  Tu mejor resultado de la semana. El historial completo está en Partidas.
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
              />
            } @else {
              <article class="sg-dashboard__empty-card">
                <div class="sg-dashboard__empty-copy-wrap">
                  <h3 class="sg-dashboard__empty-title">Sin partida destacada todavía</h3>
                  <p class="sg-dashboard__empty-copy u-m-0">
                    Cuando vinculés tu cuenta y juegues, acá aparece tu mejor resultado de la
                    semana (victoria, placement o highlight de kills).
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
  private readonly gameContext = inject(GameContextService);
  private readonly matchService = inject(MatchService);
  private readonly matchAi = inject(MatchAiService);
  private readonly playerService = inject(PlayerService);
  private readonly statsService = inject(StatsService);
  private readonly router = inject(Router);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly weekly = signal<PlayerStatsRollupView | null>(null);
  readonly communityBenchmarksApi = signal<CommunityBenchmarks | null>(null);
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

  constructor() {
    effect(() => {
      this.heroPlatform();
      this.weekLolSplashUrl();
      this.weekBannerFailed.set(false);
      this.weekBannerRetried.set(false);
    });
    effect(
      () => {
        if (this.gameContext.refreshTick() === 0) return;
        // Al cambiar de juego: skeleton hasta hidratar el nuevo contexto (evita panel de
        // "conectar" / KPIs del juego anterior).
        this.bootstrapped.set(false);
        this.weekly.set(null);
        void this.loadData();
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

  readonly weekMatches = computed(() =>
    filterMatchesWithinDays(this.effectiveRecentMatches(), 7),
  );

  readonly weekSummary = computed(() => aggregateMatchStats(this.weekMatches()));

  readonly lastUpdatedLabel = computed(() => {
    const stamp = this.lastUpdatedAt();
    if (!stamp) return '';
    return stamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  });

  readonly weekMatchCount = computed(
    () => this.weekly()?.matchCount ?? this.weekSummary().matchCount,
  );

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
    const api = this.recentMatches();
    // Autenticado: nunca mocks (causaban imagen/paneles incorrectos ~2s al entrar a Inicio).
    if (this.auth.userId()) {
      return filterMockMatchesByPlatform(api, platform);
    }
    const userId = 'mock-user-demo';
    const source = api.length > 0 ? api : buildMockMatchHistory(userId);
    return filterMockMatchesByPlatform(source, platform);
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

  readonly aiCtaLabel = computed(() => {
    const report = this.latestAiReport();
    if (report?.status === 'ready' && report.matchId) {
      return 'Ver último análisis de partida';
    }
    return 'Ver análisis semanal';
  });

  ngOnInit(): void {
    void this.loadData();
    this.realtime.ensureConnected();
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

      const [matches, weeklyRows, community, aiReports] = await Promise.all([
        this.matchService.listPlayerMatchesOnce(userId, { limit: 50 }),
        firstValueFrom(
          this.statsService.listPlayerStatsRollups(userId, 'WEEKLY', periodId, platform),
        ),
        firstValueFrom(
          this.statsService.getCommunityBenchmarks(platform ?? 'fortnite', periodId),
        ).catch(() => null),
        this.matchAi
          .listMatchAiReportsOnce(userId, {
            platform: platform ?? undefined,
            limit: 10,
          })
          .catch(() => [] as MatchAiReportView[]),
      ]);

      this.recentMatches.set(matches);
      this.weekly.set(weeklyRows[0] ?? null);
      this.lastUpdatedAt.set(new Date());
      this.latestAiReport.set(
        aiReports.find((row) => row.status === 'ready') ?? aiReports[0] ?? null,
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
      this.error.set(extractGraphqlErrorMessage(err, 'Error cargando dashboard'));
    } finally {
      this.loading.set(false);
      this.bootstrapped.set(true);
    }
  }
}
