import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import {
  MOCK_ACHIEVEMENTS,
  MOCK_LEADERBOARD,
  MOCK_TICKER,
  MOCK_TRENDING,
  type AchievementItem,
} from '../../data/dashboard-mock.data';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import {
  AchievementStripComponent,
  AiInsightCardComponent,
  DashboardHeroComponent,
  IntegrationStatusCardComponent,
  KpiStripComponent,
  LeaderboardMiniComponent,
  LiveMatchFeedComponent,
  LiveTickerComponent,
  type KpiStripItem,
  type LiveMatchFeedItem,
  TrendChartComponent,
  TrendingRailComponent,
  type TrendChartPoint,
} from '../../ui';
import { computeKdRatio, toMatchCardStats } from '../../utils/match-stats.util';
import { extractGraphqlErrorMessage } from '../../utils/graphql-error.util';

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    LiveTickerComponent,
    DashboardHeroComponent,
    KpiStripComponent,
    TrendChartComponent,
    LiveMatchFeedComponent,
    LeaderboardMiniComponent,
    AchievementStripComponent,
    TrendingRailComponent,
    IntegrationStatusCardComponent,
    AiInsightCardComponent,
  ],
  template: `
    <ion-content class="sg-dashboard-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="sg-dashboard">
        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        <sg-live-ticker [items]="tickerItems" [live]="realtime.isLive()" />

        @if (profile()) {
          <sg-dashboard-hero
            [gamerTag]="profile()!.gamerTag"
            [platform]="heroPlatform()"
            [artUrl]="heroArtUrl()"
            [fortniteId]="profile()!.fortniteId"
            [robloxId]="profile()!.robloxId"
            [live]="realtime.isLive()"
            [matches7d]="matches7d()"
            [bestPlacement]="bestPlacement()"
            [percentile]="percentileLabel()"
            [playerLevel]="playerLevel()"
          />
        }

        <sg-kpi-strip title="Performance snapshot" [items]="kpiItems()" />

        <div class="sg-dashboard__grid">
          <div class="sg-dashboard__main">
            <div class="sg-dashboard__charts">
              <sg-trend-chart title="Kills / día" unit="kills" [points]="killsTrend()" />
              <sg-trend-chart title="Partidas / día" unit="matches" [points]="matchesTrend()" />
            </div>

            <sg-live-match-feed
              title="Partidas recientes"
              [items]="historyFeedItems()"
              [showLiveIndicator]="false"
              emptyMessage="Sin partidas. Conectá tu cuenta o cargá mock data."
            />

            <sg-live-match-feed
              title="Live event stream"
              [items]="liveFeedItems()"
              [showLiveIndicator]="realtime.isLive()"
              emptyMessage="Esperando eventos en tiempo real vía AppSync…"
            />
          </div>

          <aside class="sg-dashboard__rail">
            <sg-integration-status-card
              [fortniteConnected]="!!profile()?.fortniteId"
              [robloxConnected]="!!profile()?.robloxId"
              [liveActive]="realtime.isLive()"
            />

            <sg-leaderboard-mini title="Global leaderboard" [entries]="leaderboard" />

            <sg-achievement-strip title="Session highlights" [items]="achievements()" />

            <sg-ai-insight-card
              [headline]="aiHeadline()"
              [body]="aiBody()"
              (ctaClick)="onAiCta()"
            />

            <sg-trending-rail title="Meta & trending" [items]="trending" />
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
  readonly dailyTrend = signal<PlayerStatsRollupView[]>([]);
  readonly error = signal<string | null>(null);

  readonly leaderboard = MOCK_LEADERBOARD;
  readonly trending = MOCK_TRENDING;
  readonly tickerItems = MOCK_TICKER;

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

  readonly matches7d = computed(() =>
    this.dailyTrend().reduce((sum, d) => sum + d.matchCount, 0),
  );

  readonly bestPlacement = computed(() => {
    const placements = this.recentMatches()
      .map((m) => m.stats?.placement)
      .filter((p): p is number => p != null && p > 0);
    if (!placements.length) return 99;
    return Math.min(...placements);
  });

  readonly percentileLabel = computed(() => {
    const matches = this.weekly()?.matchCount ?? 0;
    if (matches >= 15) return 'Top 10%';
    if (matches >= 8) return 'Top 18%';
    if (matches >= 3) return 'Top 35%';
    return 'Unranked';
  });

  readonly playerLevel = computed(() => {
    const kills = this.weekly()?.totalKills ?? 0;
    return Math.max(1, Math.min(99, Math.floor(kills / 3) + 12));
  });

  readonly kpiItems = computed<KpiStripItem[]>(() => {
    const w = this.weekly();
    return [
      { label: 'Matches', value: w?.matchCount ?? 0, accent: 'lime', delta: '+2', deltaTrend: 'up' },
      { label: 'K/D', value: this.weeklyKd(), accent: 'purple', delta: '+0.4', deltaTrend: 'up' },
      { label: 'Kills', value: w?.totalKills ?? 0, accent: 'lime' },
      { label: 'Deaths', value: w?.totalDeaths ?? 0, accent: 'pink', delta: '-3', deltaTrend: 'down' },
      {
        label: 'Placement',
        value: w?.avgPlacement ? w.avgPlacement.toFixed(1) : '—',
        accent: 'purple',
      },
      { label: 'Live events', value: this.realtime.liveCount(), accent: 'pink' },
    ];
  });

  readonly killsTrend = computed<TrendChartPoint[]>(() =>
    this.dailyTrend().map((d) => ({
      label: d.periodId.slice(5),
      value: d.totalKills,
    })),
  );

  readonly matchesTrend = computed<TrendChartPoint[]>(() =>
    this.dailyTrend().map((d) => ({
      label: d.periodId.slice(5),
      value: d.matchCount,
    })),
  );

  readonly historyFeedItems = computed<LiveMatchFeedItem[]>(() =>
    this.recentMatches().slice(0, 6).map((m) => this.toFeedItem(m, false)),
  );

  readonly liveFeedItems = computed<LiveMatchFeedItem[]>(() =>
    this.realtime.liveMatches().slice(0, 6).map((m) => this.toFeedItem(m, true)),
  );

  readonly achievements = computed<AchievementItem[]>(() => {
    const w = this.weekly();
    const bestKills = Math.max(
      0,
      ...this.recentMatches().map((m) => m.stats?.kills ?? 0),
    );

    return MOCK_ACHIEVEMENTS.map((item) => {
      if (item.id === 'grind' && w) {
        return { ...item, subtitle: `${w.matchCount} matches this week` };
      }
      if (item.id === 'clutch' && bestKills > 0) {
        return { ...item, subtitle: `Best: ${bestKills} eliminations` };
      }
      if (item.id === 'top') {
        return { ...item, subtitle: this.percentileLabel() };
      }
      return item;
    });
  });

  readonly aiHeadline = computed(() => {
    const w = this.weekly();
    if (!w || w.matchCount === 0) {
      return 'Empezá a trackear para desbloquear insights';
    }
    if (w.avgPlacement > 25) {
      return 'Tu mid-game está costando placement';
    }
    return 'Racha positiva — empujá el siguiente rank';
  });

  readonly aiBody = computed(() => {
    const w = this.weekly();
    if (!w || w.matchCount === 0) {
      return 'Vinculá Fortnite o Roblox en Integraciones, o cargá mock data para ver coaching personalizado.';
    }
    return `Con ${w.matchCount} partidas esta semana y K/D ${this.weeklyKd()}, el coach recomienda enfocarte en supervivencia temprana y fights más selectivos.`;
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

  private toFeedItem(m: MatchUpdateView, live: boolean): LiveMatchFeedItem {
    return {
      matchId: m.matchId,
      platform: m.platform,
      summary: m.summary,
      updatedAt: m.updatedAt,
      live,
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

      const [matches, weeklyRows, daily] = await Promise.all([
        this.matchService.listPlayerMatchesOnce(userId, { limit: 20 }),
        firstValueFrom(
          this.statsService.listPlayerStatsRollups(
            userId,
            'WEEKLY',
            currentWeeklyPeriodIdForStats(),
            platform,
          ),
        ),
        firstValueFrom(this.statsService.listPlayerDailyTrend(userId, platform, 7)),
      ]);

      this.recentMatches.set(matches);
      this.weekly.set(weeklyRows[0] ?? null);
      this.dailyTrend.set(daily);
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err, 'Error cargando dashboard'));
    }
  }
}
