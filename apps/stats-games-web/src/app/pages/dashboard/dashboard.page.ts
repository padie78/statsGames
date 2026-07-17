import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { DASHBOARD_QUICK_ACTIONS } from '../../data/dashboard-mock.data';
import {
  MOCK_COMMUNITY_BENCHMARKS,
  type CommunityRankRow,
  type CommunityRankTableView,
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
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchAiService, type MatchAiReportView } from '../../services/match-ai.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  type LeaderboardEntryView,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import type { CommunityBenchmarks } from '../../data/community-mock.data';
import {
  IntegrationStatusCardComponent,
  MatchHighlightCardComponent,
  QuickActionsBarComponent,
  PlayerSearchHeroComponent,
  TrackStartPanelComponent,
  WeeklyAiCoachPanelComponent,
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
    PlayerSearchHeroComponent,
    WeeklyAiCoachPanelComponent,
    TrackStartPanelComponent,
    QuickActionsBarComponent,
    IntegrationStatusCardComponent,
    MatchHighlightCardComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div
        class="sg-dashboard sg-dashboard--home"
        [class.sg-dashboard--loading]="loading()"
      >
        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        <sg-player-search-hero [matches]="effectiveRecentMatches()" />

        <div class="sg-dashboard__body">
          <section class="sg-dashboard__week" aria-label="Resumen semanal">
            <div class="sg-dashboard__week-identity">
              <img
                class="sg-dashboard__week-icon"
                [src]="platformMeta().iconUrl"
                [alt]=""
                width="40"
                height="40"
                aria-hidden="true"
              />
              <div class="sg-dashboard__week-copy">
                <p class="sg-dashboard__week-eyebrow">
                  {{ platformMeta().label }} · Esta semana
                  @if (lastUpdatedLabel()) {
                    <span>· Actualizado {{ lastUpdatedLabel() }}</span>
                  }
                </p>
                <h1 class="sg-dashboard__week-title">
                  {{ profile()?.gamerTag || 'Tu rendimiento' }}
                </h1>
              </div>
            </div>

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
          </section>

          <section class="sg-dashboard__block" aria-labelledby="dash-section-now">
            <div class="sg-dashboard__block-head">
              <div>
                <h2 id="dash-section-now" class="sg-dashboard__block-title">Ahora</h2>
                <p class="sg-dashboard__block-desc">
                  @if (needsTrackingSetup()) {
                    Vinculá tu cuenta para desbloquear KPIs en vivo, historial y coaching.
                  } @else {
                    Resumen semanal del coach, atajos e integraciones.
                  }
                </p>
              </div>
            </div>

            @if (needsTrackingSetup()) {
              <sg-track-start-panel [platform]="heroPlatform()" />
            }

            @if (!needsTrackingSetup()) {
              <sg-weekly-ai-coach-panel
                [summary]="weeklyCoach()"
                [communityRank]="weeklyCommunityRank()"
                [ctaLabel]="aiCtaLabel()"
                (ctaClick)="onAiCta()"
              />
            }

            <div
              class="sg-dashboard__now"
              [class.sg-dashboard__now--setup]="needsTrackingSetup()"
            >
              <div class="sg-dashboard__now-side sg-dashboard__now-side--full">
                <sg-quick-actions-bar
                  [actions]="quickActions"
                  [gameLabel]="platformMeta().label"
                  [needsSetup]="needsTrackingSetup()"
                  [matchCount]="weekMatchCount()"
                  [winRate]="weekSummary().winRate"
                />
                <sg-integration-status-card
                  [valorantConnected]="!!profile()?.valorantId"
                  [leagueOfLegendsConnected]="!!profile()?.leagueOfLegendsId"
                  [cs2Connected]="!!profile()?.cs2Id"
                  [dota2Connected]="!!profile()?.dota2Id"
                  [overwatch2Connected]="!!profile()?.overwatch2Id"
                  [rocketLeagueConnected]="!!profile()?.rocketLeagueId"
                  [fortniteConnected]="!!profile()?.fortniteId"
                  [clashRoyaleConnected]="!!profile()?.clashRoyaleId"
                  [brawlStarsConnected]="!!profile()?.brawlStarsId"
                  [robloxConnected]="!!profile()?.robloxId"
                  [liveActive]="realtime.isLive()"
                />
              </div>
            </div>
          </section>

          <section class="sg-dashboard__block" aria-labelledby="dash-section-latest">
            <div class="sg-dashboard__block-head">
              <div>
                <h2 id="dash-section-latest" class="sg-dashboard__block-title">Última destacada</h2>
                <p class="sg-dashboard__block-desc">
                  Una partida para retomar. El historial completo está en Partidas.
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
              />
            } @else {
              <article class="sg-dashboard__empty-card">
                <div class="sg-dashboard__empty-copy-wrap">
                  <h3 class="sg-dashboard__empty-title">Sin partida destacada todavía</h3>
                  <p class="sg-dashboard__empty-copy u-m-0">
                    Cuando vinculés tu cuenta y juegues, acá aparece tu mejor resultado de la
                    semana (victoria, placement o highlight de kills). Mientras tanto podés
                    explorar el historial de ejemplo.
                  </p>
                </div>
                <div class="sg-dashboard__empty-actions">
                  <a routerLink="/tabs/matches" class="u-btn u-btn--ghost">Ir a Partidas</a>
                  <a routerLink="/tabs/integrations" class="u-btn u-btn--primary">Conectar cuenta</a>
                </div>
              </article>
            }
          </section>
        </div>
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
  readonly communityLeaderboardApi = signal<LeaderboardEntryView[]>([]);
  readonly latestAiReport = signal<MatchAiReportView | null>(null);
  readonly loading = signal(false);
  readonly lastUpdatedAt = signal<Date | null>(null);
  readonly error = signal<string | null>(null);

  readonly quickActions = DASHBOARD_QUICK_ACTIONS;

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

  /** Sin rollup semanal de API: mostramos onboarding de conexión. */
  readonly needsTrackingSetup = computed(() => {
    const w = this.weekly();
    return !w || w.matchCount === 0;
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
    const userId = this.auth.userId() ?? 'mock-user-demo';
    const platform = this.heroPlatform();
    const api = this.recentMatches();
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
        this.communityBenchmarksApi() ?? MOCK_COMMUNITY_BENCHMARKS[platform],
      kdLabel: this.kdLabel(),
    });
  });

  readonly weeklyCommunityRank = computed<CommunityRankTableView | null>(() => {
    const platform = this.heroPlatform();
    const apiRows = this.communityLeaderboardApi();
    if (apiRows.length === 0) return null;

    const summary = this.weekSummary();
    const kd =
      summary.totalDeaths > 0
        ? summary.totalKills / summary.totalDeaths
        : summary.totalKills;
    const winRate =
      summary.matchCount > 0 ? (summary.winCount / summary.matchCount) * 100 : 0;
    const gamerTag = this.profile()?.gamerTag || 'Vos';
    const userId = this.auth.userId();

    const rows: CommunityRankRow[] = apiRows.map((entry) => ({
      rank: entry.rank,
      gamerTag:
        entry.userId === userId
          ? gamerTag
          : entry.gamerTag && entry.gamerTag !== entry.userId
            ? entry.gamerTag
            : `Jugador ${entry.rank}`,
      platform,
      isYou: entry.userId === userId,
      kd: entry.kd,
      winRate: entry.winRate,
      kills: entry.totalKills,
      matches: entry.matchCount,
      score: entry.score,
      delta: entry.delta,
      trend:
        entry.trend === 'up' || entry.trend === 'down'
          ? entry.trend
          : 'flat',
    }));

    if (!rows.some((row) => row.isYou) && summary.matchCount > 0) {
      rows.push({
        rank: rows.length + 1,
        gamerTag,
        platform,
        isYou: true,
        kd,
        winRate,
        kills: summary.totalKills,
        matches: summary.matchCount,
        score:
          summary.totalKills * 10 +
          summary.winCount * 100 +
          summary.matchCount * 5,
        delta: '—',
        trend: 'flat',
      });
      rows.sort((a, b) => b.score - a.score);
      rows.forEach((row, index) => {
        row.rank = index + 1;
      });
    }

    const yourIndex = rows.findIndex((row) => row.isYou);
    const start = Math.max(0, yourIndex >= 0 ? yourIndex - 5 : 0);
    const end = Math.min(
      rows.length,
      yourIndex >= 0 ? yourIndex + 6 : Math.min(rows.length, 11),
    );

    return {
      rows: rows.slice(start, end),
      yourRank: yourIndex >= 0 ? (rows[yourIndex]?.rank ?? 0) : 0,
      totalPlayers:
        this.communityBenchmarksApi()?.sampleSize ?? rows.length,
      platform,
    };
  });

  readonly aiCtaLabel = computed(() => {
    const report = this.latestAiReport();
    if (report?.status === 'ready' && report.matchId) {
      return 'Ver último análisis';
    }
    return 'Abrir AI Coach';
  });

  ngOnInit(): void {
    void this.loadData();
    this.realtime.ensureConnected();
  }

  constructor() {
    effect(() => {
      if (this.gameContext.refreshTick() === 0) return;
      void this.loadData();
    });
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
    if (!userId) return;

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
        this.matchService.listPlayerMatchesOnce(userId, { limit: 50 }),
        firstValueFrom(
          this.statsService.listPlayerStatsRollups(userId, 'WEEKLY', periodId, platform),
        ),
        firstValueFrom(
          this.statsService.getCommunityBenchmarks(platform ?? 'fortnite', periodId),
        ).catch(() => null),
        firstValueFrom(
          this.statsService.listWeeklyLeaderboard(platform ?? 'fortnite', periodId, 20),
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
      this.communityLeaderboardApi.set(leaderboard);
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
    }
  }
}
