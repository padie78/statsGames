import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import {
  PlatformPageBannerComponent,
  StatValueComponent,
  TrendChartComponent,
  type TrendChartPoint,
} from '../../ui';
import { computeKdRatio, computePlayStreakFromDailyTrend } from '../../utils/match-stats.util';
import { extractGraphqlErrorMessage } from '../../utils/graphql-error.util';

@Component({
  standalone: true,
  selector: 'app-analytics-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    PlatformPageBannerComponent,
    StatValueComponent,
    TrendChartComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-6">
        <sg-platform-page-banner
          [platform]="activePlatform()"
          title="Stats avanzadas"
          subtitle="Para quien quiere profundizar. Victorias e historial están en Partidas."
        />

        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        @if (showEmptyHint()) {
          <section class="u-surface-card u-p-5">
            <p class="u-hint u-m-0">
              Sin estadísticas todavía. Cargá mock data con tu User ID (Config):
              <code class="sg-code-block u-mt-2">npm run seed:mock -- --user-id TU_USER_ID</code>
            </p>
          </section>
        }

        @if (weekly()) {
          <section class="u-surface-card u-p-5">
            <h2 class="sg-page-header__title u-text-md u-mb-3">
              Esta semana · {{ platformMeta().shortLabel }}
            </h2>
            <div class="u-grid-stats">
              <sg-stat-value label="Partidas" [value]="weekly()!.matchCount" />
              <sg-stat-value label="Kills" [value]="weekly()!.totalKills" accent="cyan" />
              <sg-stat-value label="K/D" [value]="weeklyKd()" accent="purple" />
              <sg-stat-value label="Racha días" [value]="playStreak()" />
            </div>
          </section>
        }

        <div class="sg-analytics-charts sg-analytics-charts--compact">
          <sg-trend-chart
            title="Kills por día (últimos 7)"
            unit="kills"
            variant="area"
            [points]="killsTrend()"
          />

          <sg-trend-chart
            title="Partidas por día"
            unit="matches"
            variant="bar"
            color="#22d3ee"
            [points]="matchesTrend()"
          />
        </div>
      </div>
    </ion-content>
  `,
})
export class AnalyticsPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
  private readonly statsService = inject(StatsService);

  readonly weekly = signal<PlayerStatsRollupView | null>(null);
  readonly dailyTrend = signal<PlayerStatsRollupView[]>([]);
  readonly error = signal<string | null>(null);

  readonly activePlatform = computed(
    (): 'fortnite' | 'roblox' => this.gameContext.activeGame() ?? 'fortnite',
  );

  readonly platformMeta = computed(() => gamePlatformMeta(this.activePlatform()));

  readonly weeklyKd = computed(() => {
    const w = this.weekly();
    if (!w) return '—';
    return computeKdRatio(w.totalKills, w.totalDeaths);
  });

  readonly playStreak = computed(() => computePlayStreakFromDailyTrend(this.dailyTrend()));

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

  readonly showEmptyHint = computed(
    () =>
      !this.error() &&
      !this.weekly() &&
      this.dailyTrend().length > 0 &&
      this.dailyTrend().every((d) => d.matchCount === 0),
  );

  constructor() {
    effect(() => {
      if (this.gameContext.refreshTick() === 0) return;
      void this.loadStats();
    });
  }

  ngOnInit(): void {
    void this.loadStats();
  }

  private async loadStats(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    this.error.set(null);

    try {
      const platform = this.activePlatform();

      const [weeklyRows, daily] = await Promise.all([
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

      this.weekly.set(weeklyRows[0] ?? null);
      this.dailyTrend.set(daily);
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err, 'Error cargando estadísticas'));
    }
  }
}
