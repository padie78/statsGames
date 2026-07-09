import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import { StatValueComponent, TrendChartComponent, type TrendChartPoint } from '../../ui';
import { computeKdRatio } from '../../utils/match-stats.util';

@Component({
  standalone: true,
  selector: 'app-analytics-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, StatValueComponent, TrendChartComponent],
  template: `
    <ion-content class="ion-padding">
      <div class="page-shell u-flex u-flex-col u-gap-4">
        <header>
          <h1 class="u-font-display u-text-lg u-fw-bold u-uppercase">Estadísticas</h1>
          <p class="u-hint">Rollups semanales y tendencia diaria de kills.</p>
        </header>

        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        @if (weekly()) {
          <section class="u-surface-card u-p-4">
            <h2 class="u-font-display u-text-md u-fw-bold u-mb-3">Esta semana</h2>
            <div class="u-grid-stats">
              <sg-stat-value label="Partidas" [value]="weekly()!.matchCount" accent="lime" />
              <sg-stat-value label="Kills" [value]="weekly()!.totalKills" accent="lime" />
              <sg-stat-value label="Deaths" [value]="weekly()!.totalDeaths" accent="pink" />
              <sg-stat-value label="K/D" [value]="weeklyKd()" accent="purple" />
              <sg-stat-value
                label="Placement avg"
                [value]="weekly()!.avgPlacement.toFixed(1)"
              />
            </div>
          </section>
        }

        <sg-trend-chart
          title="Kills por día (últimos 7)"
          unit="kills"
          [points]="killsTrend()"
        />

        <sg-trend-chart
          title="Partidas por día"
          unit="matches"
          [points]="matchesTrend()"
        />
      </div>
    </ion-content>
  `,
})
export class AnalyticsPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly statsService = inject(StatsService);

  readonly weekly = signal<PlayerStatsRollupView | null>(null);
  readonly dailyTrend = signal<PlayerStatsRollupView[]>([]);
  readonly error = signal<string | null>(null);

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

  readonly matchesTrend = computed<TrendChartPoint[]>(() =>
    this.dailyTrend().map((d) => ({
      label: d.periodId.slice(5),
      value: d.matchCount,
    })),
  );

  ngOnInit(): void {
    void this.loadStats();
  }

  private async loadStats(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    const platform = this.auth.selectedGame() ?? undefined;
    this.error.set(null);

    try {
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
      this.error.set(err instanceof Error ? err.message : 'Error cargando estadísticas');
    }
  }
}
