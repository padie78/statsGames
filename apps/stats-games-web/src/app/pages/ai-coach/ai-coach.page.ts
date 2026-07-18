import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
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
  type LeaderboardEntryView,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import { MOCK_COMMUNITY_BENCHMARKS } from '../../data/community-mock.data';
import type { CommunityBenchmarks } from '../../data/community-mock.data';
import {
  buildMockMatchHistory,
  filterMockMatchesByPlatform,
} from '../../data/match-mock.data';
import { NeonBadgeComponent, WeeklyAiCoachPanelComponent } from '../../ui';
import { matchDetailRoute } from '../../utils/match-analysis.util';
import {
  aggregateMatchStats,
  computeKdRatio,
  filterMatchesWithinDays,
  formatMatchRelativeTime,
} from '../../utils/match-stats.util';
import { mapCommunityBenchmarksFromApi } from '../../utils/community-stats.util';
import { buildWeeklyAiCoachSummary } from '../../utils/weekly-ai-summary.util';
import { buildWeeklyCommunityRankView } from '../../utils/weekly-community-rank.util';

@Component({
  standalone: true,
  selector: 'app-ai-coach-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    RouterLink,
    NeonBadgeComponent,
    WeeklyAiCoachPanelComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-5">
        <header class="sg-page-header">
          <h1 class="sg-page-header__title">Coach IA</h1>
          <p class="sg-page-header__subtitle">
            Análisis semanal de tu rendimiento e informes Bedrock por partida.
            El detalle técnico completo vive en cada análisis de partida.
          </p>
        </header>

        @if (hasWeekData()) {
          <section aria-labelledby="coach-weekly">
            <h2 id="coach-weekly" class="sg-page-header__title u-text-lg u-mb-3">
              Análisis semanal
            </h2>
            <sg-weekly-ai-coach-panel
              [summary]="weeklyCoach()"
              [communityRank]="weeklyCommunityRank()"
              ctaLabel="Ver partidas"
              (ctaClick)="goToMatches()"
            />
          </section>
        }

        <section aria-labelledby="coach-reports">
          <h2 id="coach-reports" class="sg-page-header__title u-text-lg u-mb-3">
            Análisis por partida
          </h2>

          @if (loading()) {
            <p class="u-hint u-m-0">Cargando reportes…</p>
          } @else if (error()) {
            <p class="u-error u-m-0">{{ error() }}</p>
          } @else if (reports().length === 0) {
            <section class="u-surface-card u-p-5">
              <sg-neon-badge tone="muted">Sin reportes aún</sg-neon-badge>
              <p class="u-hint u-mt-3 u-mb-0">
                Acá debería aparecer la lista de análisis por partida (headline, grade, summary) por cada
                match analizado. Todavía no hay filas porque el analyzer no generó reportes, o
                las partidas del juego activo no están encoladas a Bedrock.
              </p>
              <ul class="u-hint u-mt-3" style="padding-left: 1.1rem; margin: 0">
                <li>Vinculá la cuenta del juego en Integraciones</li>
                <li>Jugá / enviá un match (poller o send-match)</li>
                <li>Esperá a que match_ai_analyzer marque el reporte como ready</li>
              </ul>
              <div class="u-flex u-gap-2 u-mt-4" style="flex-wrap: wrap">
                <a routerLink="/tabs/integrations" class="u-btn u-btn--ghost">Ir a Integraciones</a>
                <a routerLink="/tabs/matches" class="u-btn u-btn--primary">Ver Partidas</a>
              </div>
            </section>
          } @else {
            <div class="u-flex u-flex-col u-gap-3">
              @for (report of reports(); track report.matchId) {
                <a
                  class="u-surface-card u-p-4 sg-ai-coach-row"
                  [routerLink]="detailLink(report.matchId)"
                >
                  <div class="u-flex u-items-start u-justify-between u-gap-3">
                    <div>
                      <div class="u-flex u-gap-2 u-items-center u-mb-1">
                        <sg-neon-badge [tone]="report.status === 'ready' ? 'purple' : 'muted'">
                          {{ report.gradeLabel || '—' }} · {{ report.performanceScore ?? '—' }}/100
                        </sg-neon-badge>
                        <sg-neon-badge tone="cyan">{{ report.platform }}</sg-neon-badge>
                      </div>
                      <h3 class="u-text-md u-m-0">{{ report.headline || 'Análisis de partida' }}</h3>
                      <p class="u-hint u-m-0 u-mt-1">{{ report.summary }}</p>
                      @if (report.actionPlan?.length) {
                        <p class="u-hint u-m-0 u-mt-2">Foco: {{ report.actionPlan[0] }}</p>
                      }
                    </div>
                    <span class="u-hint u-text-xs">{{ relative(report.createdAt) }}</span>
                  </div>
                </a>
              }
            </div>
          }
        </section>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .sg-ai-coach-row {
        display: block;
        text-decoration: none;
        color: inherit;
        transition: border-color 160ms ease, transform 160ms ease;
      }
      .sg-ai-coach-row:hover {
        transform: translateY(-1px);
      }
    `,
  ],
})
export class AiCoachPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
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

  readonly activePlatform = computed<SelectedGame>(() => {
    const g = this.gameContext.activeGame();
    if (g) return g;
    return selectedGameFromBackend(this.profile()?.primaryPlatform) ?? 'fortnite';
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
    filterMatchesWithinDays(this.effectiveRecentMatches(), 7),
  );

  readonly weekSummary = computed(() => aggregateMatchStats(this.weekMatches()));

  readonly hasWeekData = computed(() => {
    const w = this.weekly();
    return !!w && w.matchCount > 0;
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
      self: {
        gamerTag: this.profile()?.gamerTag || 'Vos',
        kd,
        winRate,
        kills: summary.totalKills,
        matches: summary.matchCount,
        winCount: summary.winCount,
      },
    });
  });

  ngOnInit(): void {
    void this.load();
  }

  constructor() {
    effect(() => {
      if (this.gameContext.refreshTick() === 0) return;
      void this.load();
    });
  }

  detailLink(matchId: string): string {
    return matchDetailRoute(matchId);
  }

  relative(iso: string): string {
    return formatMatchRelativeTime(iso);
  }

  goToMatches(): void {
    void this.router.navigateByUrl('/tabs/matches');
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

      const [reports, matches, weeklyRows, community, leaderboard] = await Promise.all([
        this.matchAi
          .listMatchAiReportsOnce(userId, { platform: platform ?? undefined, limit: 30 })
          .catch(() => [] as MatchAiReportView[]),
        this.matchService
          .listPlayerMatchesOnce(userId, { limit: 50 })
          .catch(() => [] as MatchUpdateView[]),
        firstValueFrom(
          this.statsService.listPlayerStatsRollups(userId, 'WEEKLY', periodId, platform),
        ).catch(() => [] as PlayerStatsRollupView[]),
        firstValueFrom(
          this.statsService.getCommunityBenchmarks(platform ?? 'fortnite', periodId),
        ).catch(() => null),
        firstValueFrom(
          this.statsService.listWeeklyLeaderboard(platform ?? 'fortnite', periodId, 20),
        ).catch(() => [] as LeaderboardEntryView[]),
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
