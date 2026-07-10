import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { DASHBOARD_QUICK_ACTIONS, type AchievementItem } from '../../data/dashboard-mock.data';
import {
  buildMockMatchHistory,
  filterMockMatchesByPlatform,
} from '../../data/match-mock.data';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  previousWeeklyPeriodIdForStats,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import {
  AchievementStripComponent,
  AiInsightCardComponent,
  DashboardHeroComponent,
  DualPlatformStripComponent,
  IntegrationStatusCardComponent,
  KpiStripComponent,
  LiveMatchFeedComponent,
  MatchHighlightCardComponent,
  PlatformSpotlightCardComponent,
  QuickActionsBarComponent,
  WeekComparisonPanelComponent,
  type KpiStripItem,
  type LiveMatchFeedItem,
} from '../../ui';
import {
  aggregateMatchStats,
  buildWeekComparison,
  computeBestKills,
  computeKdRatio,
  computePlayStreakFromDailyTrend,
  computeWinStreak,
  filterMatchesInDayRange,
  filterMatchesWithinDays,
  toMatchCardStats,
} from '../../utils/match-stats.util';
import { extractGraphqlErrorMessage } from '../../utils/graphql-error.util';

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    DashboardHeroComponent,
    DualPlatformStripComponent,
    PlatformSpotlightCardComponent,
    QuickActionsBarComponent,
    MatchHighlightCardComponent,
    KpiStripComponent,
    LiveMatchFeedComponent,
    AchievementStripComponent,
    IntegrationStatusCardComponent,
    AiInsightCardComponent,
    WeekComparisonPanelComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="sg-dashboard">
        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        @if (profile()) {
          <sg-dashboard-hero
            [gamerTag]="profile()!.gamerTag"
            [platform]="heroPlatform()"
            [artUrl]="heroArtUrl()"
            [fortniteId]="profile()!.fortniteId"
            [robloxId]="profile()!.robloxId"
            [live]="realtime.isLive()"
            [playerLevel]="playerLevel()"
            [winsWeek]="weekSummary().winCount"
            [winRate]="weekSummary().winRate"
            [kd]="weeklyKd()"
            [bestPlacement]="bestPlacement()"
          />
        }

        <sg-dual-platform-strip
          [activePlatform]="heroPlatform()"
          [fortniteConnected]="!!profile()?.fortniteId"
          [robloxConnected]="!!profile()?.robloxId"
        />

        <div class="sg-dashboard__bento-top">
          <sg-platform-spotlight-card
            [platform]="heroPlatform()"
            [winsWeek]="weekSummary().winCount"
            [winRate]="weekSummary().winRate"
            [totalKills]="weekly()?.totalKills ?? 0"
          />

          <sg-quick-actions-bar [actions]="quickActions" />
        </div>

        <sg-kpi-strip
          title="Tu semana"
          [platform]="heroPlatform()"
          [items]="kpiItems()"
        />

        <sg-week-comparison-panel [items]="weekComparison()" />

        <div class="sg-dashboard__grid">
          <div class="sg-dashboard__main">
            @if (highlightMatch(); as match) {
              <sg-match-highlight-card
                [matchId]="match.matchId"
                [platform]="match.platform"
                [summary]="match.summary"
                [updatedAt]="match.updatedAt"
                [stats]="match.stats"
              />
            }

            <sg-live-match-feed
              title="Partidas recientes"
              [items]="historyFeedItems()"
              [showLiveIndicator]="false"
              emptyMessage="Sin partidas. Conectá tu cuenta o cargá mock data."
            />
          </div>

          <aside class="sg-dashboard__rail">
            <sg-integration-status-card
              [fortniteConnected]="!!profile()?.fortniteId"
              [robloxConnected]="!!profile()?.robloxId"
              [liveActive]="realtime.isLive()"
            />

            <sg-achievement-strip title="Logros de la semana" [items]="achievements()" />

            <sg-ai-insight-card
              [headline]="aiHeadline()"
              [body]="aiBody()"
              (ctaClick)="onAiCta()"
            />
          </aside>
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
  private readonly playerService = inject(PlayerService);
  private readonly statsService = inject(StatsService);
  private readonly router = inject(Router);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly weekly = signal<PlayerStatsRollupView | null>(null);
  readonly previousWeekly = signal<PlayerStatsRollupView | null>(null);
  readonly dailyTrend = signal<PlayerStatsRollupView[]>([]);
  readonly error = signal<string | null>(null);

  readonly quickActions = DASHBOARD_QUICK_ACTIONS;

  readonly heroPlatform = computed((): 'fortnite' | 'roblox' => {
    const g = this.gameContext.activeGame() ?? this.profile()?.primaryPlatform?.toLowerCase();
    return g === 'roblox' ? 'roblox' : 'fortnite';
  });

  readonly heroArtUrl = computed(() => gamePlatformMeta(this.heroPlatform()).artUrl);

  readonly weeklyKd = computed(() => {
    const w = this.weekly();
    if (!w) return '—';
    return computeKdRatio(w.totalKills, w.totalDeaths);
  });

  readonly weekMatches = computed(() =>
    filterMatchesWithinDays(this.effectiveRecentMatches(), 7),
  );

  readonly weekSummary = computed(() => aggregateMatchStats(this.weekMatches()));

  readonly previousWeekMatches = computed(() =>
    filterMatchesInDayRange(this.effectiveRecentMatches(), 7, 14),
  );

  readonly previousWeekSummary = computed(() =>
    aggregateMatchStats(this.previousWeekMatches()),
  );

  readonly weekComparison = computed(() =>
    buildWeekComparison({
      currentWeekly: this.weekly(),
      previousWeekly: this.previousWeekly(),
      currentWins: this.weekSummary().winCount,
      previousWins: this.previousWeekSummary().winCount,
    }),
  );

  readonly bestPlacement = computed(() => {
    const placements = this.effectiveRecentMatches()
      .map((m) => m.stats?.placement)
      .filter((p): p is number => p != null && p > 0);
    if (!placements.length) return 99;
    return Math.min(...placements);
  });

  readonly playerLevel = computed(() => {
    const kills = this.weekly()?.totalKills ?? 0;
    return Math.max(1, Math.min(99, Math.floor(kills / 3) + 12));
  });

  readonly highlightMatch = computed(() => {
    const matches = this.effectiveRecentMatches();
    if (!matches.length) return null;

    const ranked = [...matches].sort((a, b) => {
      const pa = a.stats?.placement ?? 999;
      const pb = b.stats?.placement ?? 999;
      if (pa !== pb) return pa - pb;
      return (b.stats?.kills ?? 0) - (a.stats?.kills ?? 0);
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

  readonly kpiItems = computed<KpiStripItem[]>(() => {
    const w = this.weekly();
    const summary = this.weekSummary();
    const comparison = this.weekComparison();
    const winsDelta = comparison.find((item) => item.label === 'Victorias');
    const killsDelta = comparison.find((item) => item.label === 'Kills');
    const matchesDelta = comparison.find((item) => item.label === 'Partidas');
    const kdDelta = comparison.find((item) => item.label === 'K/D');

    return [
      {
        label: 'Victorias',
        value: summary.winCount,
        accent: 'lime',
        icon: 'placement',
        delta: shortComparisonNote(winsDelta?.note),
        deltaTrend: winsDelta?.trend,
      },
      { label: 'Win rate', value: summary.winRate, accent: 'cyan', icon: 'kd' },
      {
        label: 'K/D',
        value: this.weeklyKd(),
        accent: 'cyan',
        icon: 'kd',
        delta: shortComparisonNote(kdDelta?.note),
        deltaTrend: kdDelta?.trend,
      },
      {
        label: 'Kills',
        value: w?.totalKills ?? 0,
        accent: 'lime',
        icon: 'kills',
        delta: shortComparisonNote(killsDelta?.note),
        deltaTrend: killsDelta?.trend,
      },
      {
        label: 'Partidas',
        value: w?.matchCount ?? 0,
        icon: 'matches',
        delta: shortComparisonNote(matchesDelta?.note),
        deltaTrend: matchesDelta?.trend,
      },
    ];
  });

  readonly effectiveRecentMatches = computed(() => {
    const userId = this.auth.userId() ?? 'mock-user-demo';
    const platform = this.heroPlatform();
    const api = this.recentMatches();
    const source = api.length > 0 ? api : buildMockMatchHistory(userId);
    return filterMockMatchesByPlatform(source, platform);
  });

  readonly historyFeedItems = computed<LiveMatchFeedItem[]>(() =>
    this.effectiveRecentMatches().slice(0, 8).map((m) => this.toFeedItem(m)),
  );

  readonly achievements = computed<AchievementItem[]>(() => {
    const w = this.weekly();
    const matches = this.effectiveRecentMatches();
    const winStreak = computeWinStreak(matches);
    const playStreak = computePlayStreakFromDailyTrend(this.dailyTrend());
    const bestKills = computeBestKills(matches);
    const summary = this.weekSummary();

    return [
      {
        id: 'wins',
        title: 'Victorias',
        subtitle: `${summary.winCount} esta semana`,
        icon: '🏆',
        tone: 'purple',
      },
      {
        id: 'streak',
        title: 'Racha',
        subtitle:
          winStreak > 0
            ? `${winStreak} victoria${winStreak === 1 ? '' : 's'} seguidas`
            : playStreak > 0
              ? `${playStreak} día${playStreak === 1 ? '' : 's'} jugando`
              : 'Jugá una partida para empezar',
        icon: '🔥',
        tone: 'lime',
      },
      {
        id: 'clutch',
        title: 'Record kills',
        subtitle: bestKills > 0 ? `${bestKills} en una partida` : 'Sin datos todavía',
        icon: '🎯',
        tone: 'cyan',
      },
      {
        id: 'grind',
        title: 'Actividad',
        subtitle: `${w?.matchCount ?? 0} partidas esta semana`,
        icon: '⚔',
        tone: 'pink',
      },
    ];
  });

  readonly aiHeadline = computed(() => {
    const summary = this.weekSummary();
    const w = this.weekly();
    if (!w || w.matchCount === 0) {
      return 'Conectá tu cuenta y empezá a trackear';
    }
    if (summary.winCount >= 3) {
      return '¡Semana épica! Seguí sumando victorias';
    }
    if (summary.winCount >= 1) {
      return 'Buen arranque — apuntá a más victorias';
    }
    return 'Cada partida cuenta — buscá tu primera victoria';
  });

  readonly aiBody = computed(() => {
    const w = this.weekly();
    const summary = this.weekSummary();
    const comparison = this.weekComparison();
    if (!w || w.matchCount === 0) {
      return 'Vinculá Fortnite o Roblox en Integraciones para ver tus stats en vivo.';
    }

    const winsLine = comparison.find((item) => item.label === 'Victorias');
    if (winsLine && winsLine.trend === 'up') {
      return winsLine.note.charAt(0).toUpperCase() + winsLine.note.slice(1) + '. Seguí empujando.';
    }

    const bestKills = computeBestKills(this.effectiveRecentMatches());
    if (bestKills >= 10) {
      return `Llevás ${summary.winCount} victoria${summary.winCount === 1 ? '' : 's'} y tu record es ${bestKills} kills. ¡Seguí así!`;
    }
    return `${w.matchCount} partidas, win rate ${summary.winRate} y K/D ${this.weeklyKd()}. Enfocate en llegar al top 10 y sumar más eliminaciones.`;
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
    void this.router.navigateByUrl('/tabs/ai-coach');
  }

  private toFeedItem(m: MatchUpdateView): LiveMatchFeedItem {
    return {
      matchId: m.matchId,
      platform: m.platform,
      summary: m.summary,
      updatedAt: m.updatedAt,
      live: false,
      stats: toMatchCardStats(m.stats),
    };
  }

  private async loadData(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    this.error.set(null);
    try {
      const profile = await this.playerService.getPlayerProfileOrNull(userId);
      if (!profile) {
        await this.router.navigateByUrl('/onboarding');
        return;
      }
      this.profile.set(profile);

      const platform =
        (this.gameContext.activeGame() as 'fortnite' | 'roblox' | null) ??
        (profile.primaryPlatform as 'fortnite' | 'roblox') ??
        undefined;

      const [matches, weeklyRows, previousWeeklyRows, daily] = await Promise.all([
        this.matchService.listPlayerMatchesOnce(userId, { limit: 50 }),
        firstValueFrom(
          this.statsService.listPlayerStatsRollups(
            userId,
            'WEEKLY',
            currentWeeklyPeriodIdForStats(),
            platform,
          ),
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
      ]);

      this.recentMatches.set(matches);
      this.weekly.set(weeklyRows[0] ?? null);
      this.previousWeekly.set(previousWeeklyRows[0] ?? null);
      this.dailyTrend.set(daily);
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err, 'Error cargando dashboard'));
    }
  }
}

function shortComparisonNote(note?: string): string | undefined {
  if (!note) return undefined;
  if (note === 'igual que la semana pasada') return '≈ sem. pasada';
  return note.replace(' vs semana pasada', '');
}
