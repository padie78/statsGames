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
  type LeaderboardEntryView,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import {
  AgentOfWeekComponent,
  CommunityRankTableComponent,
  MatchHighlightCardComponent,
  TrackStartPanelComponent,
  WeekHeroBrandComponent,
  WeeklyHomeSummaryComponent,
  sgFadeSlideIn,
} from '../../ui';
import type { AgentOfWeekView } from '../../ui/molecules/agent-of-week/agent-of-week.component';
import { matchDetailRoute } from '../../utils/match-analysis.util';
import {
  aggregateMatchStats,
  computeKdRatio,
  filterMatchesWithinDays,
  isMatchWin,
  mergeMatchUpdates,
  toMatchCardStats,
} from '../../utils/match-stats.util';
import { formatCommunitySampleSize, mapCommunityBenchmarksFromApi } from '../../utils/community-stats.util';
import { buildWeeklyAiCoachSummary } from '../../utils/weekly-ai-summary.util';
import { buildWeeklyCommunityRankView } from '../../utils/weekly-community-rank.util';
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
    CommunityRankTableComponent,
    WeekHeroBrandComponent,
    WeeklyHomeSummaryComponent,
    AgentOfWeekComponent,
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
                  Conectá tu cuenta del juego para ver KPIs reales, forma semanal y análisis.
                } @else if (weekMatchCount() === 0) {
                  Todavía no hay partidas en la ventana semanal. Cuando juegues, acá aparece el
                  resumen de forma y el análisis.
                } @else {
                  Esta semana: {{ weekSummary().winCount }}V /
                  {{ weekMatchCount() }} partidas · WR {{ weekSummary().winRate }}.
                  @if (matchesUsePreview()) {
                    <span class="sg-analytics__badge">preview</span>
                  }
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
            <div class="sg-dashboard__block-head">
              <div>
                <h2 id="dash-section-analysis" class="sg-dashboard__block-title">
                  Análisis semanal
                </h2>
                <p class="sg-dashboard__block-desc">
                  @if (needsTrackingSetup()) {
                    Vinculá tu cuenta para ver cómo venís esta semana.
                  } @else {
                    Forma, foco y plan de práctica.
                  }
                </p>
              </div>
              @if (!needsTrackingSetup()) {
                <a routerLink="/tabs/ai-coach" class="sg-dashboard__block-link">
                  Ver completo →
                </a>
              }
            </div>
            @if (needsTrackingSetup()) {
              <sg-track-start-panel [platform]="heroPlatform()" />
            } @else {
              <sg-weekly-home-summary
                [summary]="weeklyCoach()"
                [kdLabel]="kdLabel()"
                [ctaLabel]="aiCtaLabel()"
                (primaryClick)="onAiCta()"
              />
              @if (agentOfWeek(); as agentWeek) {
                <sg-agent-of-week [view]="agentWeek" />
              }
            }
          </section>

          @if (!needsTrackingSetup()) {
            <section class="sg-dashboard__block" aria-labelledby="dash-section-community">
              <div class="sg-dashboard__block-head">
                <div>
                  <h2 id="dash-section-community" class="sg-dashboard__block-title">
                    Tu puesto esta semana
                  </h2>
                  <p class="sg-dashboard__block-desc">
                    Quién está justo arriba y abajo tuyo.
                    @if (communityUsesMock()) {
                      <span class="sg-analytics__badge">preview</span>
                    }
                  </p>
                </div>
                <a routerLink="/tabs/analytics" class="sg-dashboard__block-link">
                  Ranking completo →
                </a>
              </div>

              @if (communityRank(); as rank) {
                <sg-community-rank-table
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
                  Partida destacada
                </h2>
                <p class="sg-dashboard__block-desc">
                  Tu mejor resultado de la semana.
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
  readonly notifications = inject(MatchNotificationsStore);
  private readonly productAlerts = inject(InAppAlertsStore);
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
        this.weekly.set(null);
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

  /** Moda de agente + mapa top en la semana (solo Valorant). */
  readonly agentOfWeek = computed<AgentOfWeekView | null>(() => {
    if (this.heroPlatform() !== 'valorant') return null;
    const matches = this.weekMatches().filter((m) => m.stats?.agent?.trim());
    if (matches.length < 2) return null;

    const agentCounts = new Map<string, { count: number; wins: number }>();
    const mapCounts = new Map<string, number>();
    for (const m of matches) {
      const agent = m.stats?.agent?.trim();
      if (!agent) continue;
      const prev = agentCounts.get(agent) ?? { count: 0, wins: 0 };
      prev.count += 1;
      if (isMatchWin(m.stats)) prev.wins += 1;
      agentCounts.set(agent, prev);

      const map = m.stats?.map?.trim();
      if (map) mapCounts.set(map, (mapCounts.get(map) ?? 0) + 1);
    }

    let bestAgent = '';
    let best = { count: 0, wins: 0 };
    for (const [agent, stats] of agentCounts) {
      if (stats.count > best.count || (stats.count === best.count && stats.wins > best.wins)) {
        bestAgent = agent;
        best = stats;
      }
    }
    if (!bestAgent || best.count < 2) return null;

    let mapOfWeek: string | null = null;
    let mapTop = 0;
    for (const [map, count] of mapCounts) {
      if (count > mapTop) {
        mapTop = count;
        mapOfWeek = map;
      }
    }

    const winRate =
      best.count > 0 ? `${Math.round((best.wins / best.count) * 100)}%` : '—';

    return {
      agent: bestAgent,
      matches: best.count,
      winRate,
      artUrl: valorantAgentSplashUrl(bestAgent),
      mapOfWeek,
    };
  });

  readonly communityRank = computed<CommunityRankTableView | null>(() => {
    const summary = this.weekSummary();
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
        matches: summary.matchCount,
        winCount: summary.winCount,
      },
    });
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
    return `${label} · #${rank.yourRank} · rivales ±2 puestos`;
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

      const [matches, weeklyRows, community, leaderboard, aiReports] = await Promise.all([
        this.matchService.listPlayerMatchesOnce(userId, {
          platform: platform ?? undefined,
          limit: 50,
        }),
        firstValueFrom(
          this.statsService.listPlayerStatsRollups(userId, 'WEEKLY', periodId, platform),
        ),
        firstValueFrom(
          this.statsService.getCommunityBenchmarks(platform ?? 'fortnite', periodId),
        ).catch(() => null),
        firstValueFrom(
          this.statsService.listWeeklyLeaderboard(platform ?? 'fortnite', periodId, 40),
        ).catch(() => [] as LeaderboardEntryView[]),
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
