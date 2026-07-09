import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import {
  LiveMatchFeedComponent,
  type LiveMatchFeedItem,
  NeonBadgeComponent,
  PremiumUpsellBannerComponent,
  ShareLinkButtonComponent,
  StatValueComponent,
  TrendChartComponent,
  type TrendChartPoint,
} from '../../ui';
import { computeKdRatio, toMatchCardStats } from '../../utils/match-stats.util';

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    NeonBadgeComponent,
    StatValueComponent,
    LiveMatchFeedComponent,
    PremiumUpsellBannerComponent,
    ShareLinkButtonComponent,
    TrendChartComponent,
  ],
  template: `
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-shell u-flex u-flex-col u-gap-4">
        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        <section class="sg-player-hero">
          <div class="u-flex u-justify-between u-items-start u-gap-3">
            <div class="u-min-w-0">
              <p class="u-text-xs u-font-display u-tracking-wide u-text-muted u-uppercase u-mb-2">
                Overview
              </p>
              <h1 class="sg-player-hero__name">{{ profile()?.gamerTag ?? 'Gamer' }}</h1>
              <div class="sg-player-hero__meta u-mt-3">
                <sg-neon-badge [tone]="platformTone()">
                  {{ profile()?.primaryPlatform ?? '—' }}
                </sg-neon-badge>
                @if (realtime.isLive()) {
                  <sg-neon-badge tone="lime" [pulse]="true">STREAM ON</sg-neon-badge>
                }
                @if (profile()?.fortniteId) {
                  <sg-neon-badge tone="cyan">FN {{ profile()?.fortniteId }}</sg-neon-badge>
                }
                @if (profile()?.robloxId) {
                  <sg-neon-badge tone="purple">RBX {{ profile()?.robloxId }}</sg-neon-badge>
                }
              </div>
            </div>
            @if (profile()?.gamerTag) {
              <sg-share-link-button [gamerTag]="profile()!.gamerTag" />
            }
          </div>

          <div class="u-grid-stats u-mt-2">
            <sg-stat-value label="Partidas (sem)" [value]="weekly()?.matchCount ?? 0" accent="lime" />
            <sg-stat-value label="K/D (sem)" [value]="weeklyKd()" accent="purple" />
            <sg-stat-value label="Kills (sem)" [value]="weekly()?.totalKills ?? 0" accent="purple" />
            <sg-stat-value
              label="Placement avg"
              [value]="weekly()?.avgPlacement?.toFixed(1) ?? '—'"
              accent="pink"
            />
          </div>
        </section>

        <sg-trend-chart title="Kills — últimos 7 días" unit="kills" [points]="killsTrend()" />

        @if (showPremiumBanner() && realtime.premiumInsight().visible) {
          <sg-premium-upsell-banner
            [headline]="realtime.premiumInsight().headline"
            [body]="realtime.premiumInsight().body"
            (ctaClick)="onPremiumCta()"
            (dismiss)="dismissPremium()"
          />
        }

        <sg-live-match-feed
          title="Partidas recientes"
          [items]="historyFeedItems()"
          [showLiveIndicator]="false"
          emptyMessage="Sin partidas todavía. Vinculá tu cuenta en Integraciones."
        />

        <sg-live-match-feed
          title="Live feed"
          [items]="liveFeedItems()"
          [showLiveIndicator]="realtime.isLive()"
          emptyMessage="Esperando eventos en tiempo real vía AppSync…"
        />
      </div>
    </ion-content>
  `,
})
export class DashboardPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly realtime = inject(AppSyncRealtimeService);
  private readonly matchService = inject(MatchService);
  private readonly playerService = inject(PlayerService);
  private readonly statsService = inject(StatsService);
  private readonly router = inject(Router);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly weekly = signal<PlayerStatsRollupView | null>(null);
  readonly dailyTrend = signal<PlayerStatsRollupView[]>([]);
  readonly error = signal<string | null>(null);
  readonly showPremiumBanner = signal(true);

  readonly platformTone = computed(() => {
    const p = this.profile()?.primaryPlatform?.toLowerCase();
    if (p === 'fortnite') return 'cyan' as const;
    if (p === 'roblox') return 'purple' as const;
    return 'muted' as const;
  });

  readonly weeklyKd = computed(() => {
    const w = this.weekly();
    if (!w) return '—';
    return computeKdRatio(w.totalKills, w.totalDeaths);
  });

  readonly killsTrend = computed<TrendChartPoint[]>(() =>
    this.dailyTrend().map((d) => ({
      label: d.periodId.slice(5),
      value: d.totalKills,
    })),
  );

  readonly historyFeedItems = computed<LiveMatchFeedItem[]>(() =>
    this.recentMatches().map((m) => this.toFeedItem(m, false)),
  );

  readonly liveFeedItems = computed<LiveMatchFeedItem[]>(() =>
    this.realtime.liveMatches().map((m) => this.toFeedItem(m, true)),
  );

  ngOnInit(): void {
    void this.loadData();
    this.realtime.ensureConnected();
  }

  async refresh(event: CustomEvent): Promise<void> {
    await this.loadData();
    (event.target as HTMLIonRefresherElement).complete();
  }

  dismissPremium(): void {
    this.showPremiumBanner.set(false);
  }

  onPremiumCta(): void {
    console.info('[Dashboard] Premium CTA clicked');
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

      const platform = (profile.primaryPlatform as 'fortnite' | 'roblox') ?? undefined;

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
      this.error.set(err instanceof Error ? err.message : 'Error inesperado');
    }
  }
}
