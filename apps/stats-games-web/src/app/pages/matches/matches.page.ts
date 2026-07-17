import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import type { SelectedGame } from '../../core/game/selected-game';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import {
  KpiStripComponent,
  MatchFiltersToolbarComponent,
  MatchHighlightCardComponent,
  MatchHistoryListComponent,
  PlatformPageBannerComponent,
  type KpiStripItem,
  type MatchDateFilter,
  type MatchPlatformFilter,
} from '../../ui';
import {
  formatMatchRelativeTime,
  groupMatchesByDay,
  mergeMatchUpdates,
  sortMatches,
  toMatchCardStats,
  type MatchSortKey,
} from '../../utils/match-stats.util';
import {
  aggregatePlatformMatchStats,
  buildPlatformKpiItems,
} from '../../utils/platform-stats.util';
import { resolveMatchHistory } from '../../data/match-mock.data';

@Component({
  standalone: true,
  selector: 'app-matches-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    PlatformPageBannerComponent,
    MatchFiltersToolbarComponent,
    KpiStripComponent,
    MatchHighlightCardComponent,
    MatchHistoryListComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-shell page-shell--fluid sg-matches-page u-flex u-flex-col u-gap-6">
        <sg-platform-page-banner
          [platform]="bannerPlatform()"
          title="Partidas"
          subtitle="Historial, filtros y análisis por match. Las tendencias viven en Evolución."
        />

        <sg-match-filters-toolbar
          [platform]="platformFilter()"
          [dateRange]="dateFilter()"
          [sort]="sortKey()"
          [resultCount]="filteredMatches().length"
          [usingMockData]="usingMockData()"
          (platformChange)="setPlatformFilter($event)"
          (dateRangeChange)="setDateFilter($event)"
          (sortChange)="setSortKey($event)"
        />

        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        @if (loading()) {
          <section class="u-surface-card u-p-5">
            <p class="u-hint u-m-0">Cargando partidas…</p>
          </section>
        } @else if (filteredMatches().length > 0) {
          <sg-kpi-strip
            title="Resumen del período"
            [platform]="bannerPlatform()"
            [items]="summaryKpis()"
          />

          @if (highlightMatch(); as match) {
            <sg-match-highlight-card
              [matchId]="match.matchId"
              [platform]="match.platform"
              [summary]="match.summary"
              [updatedAt]="match.relativeTime"
              [stats]="match.stats"
              [showHistoryLink]="false"
            />
          }

          <sg-match-history-list
            [groups]="groupedMatches()"
            emptyMessage="No hay partidas con estos filtros."
          />
        } @else {
          <section class="sg-match-history__empty u-surface-card u-p-5">
            <h2 class="sg-page-header__title u-text-md u-mb-2">Sin partidas</h2>
            <p class="u-hint u-m-0">
              No hay resultados con los filtros actuales. Probá ampliar el período o conectá tu cuenta en Integraciones.
            </p>
          </section>
        }
      </div>
    </ion-content>
  `,
})
export class MatchesPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
  private readonly matchService = inject(MatchService);
  private readonly realtime = inject(AppSyncRealtimeService);

  readonly allMatches = signal<MatchUpdateView[]>([]);
  readonly platformFilter = signal<MatchPlatformFilter>('all');
  readonly dateFilter = signal<MatchDateFilter>('all');
  readonly sortKey = signal<MatchSortKey>('newest');
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  readonly bannerPlatform = computed((): SelectedGame => {
    const filter = this.platformFilter();
    if (filter !== 'all') return filter;
    return this.gameContext.activeGame() ?? 'fortnite';
  });

  readonly usingMockData = computed(
    () => this.allMatches().length === 0 && this.filteredMatches().length > 0,
  );

  readonly filteredMatches = computed(() => {
    const userId = this.auth.userId() ?? 'mock-user-demo';
    const platform = this.platformFilter();
    const platformFilter = platform === 'all' ? null : platform;
    let rows = resolveMatchHistory(this.allMatches(), userId, platformFilter);

    const range = this.dateFilter();
    if (range !== 'all') {
      const days = range === '7d' ? 7 : 30;
      const cutoff = Date.now() - days * 86_400_000;
      rows = rows.filter((m) => new Date(m.updatedAt).getTime() >= cutoff);
    }

    return sortMatches(rows, this.sortKey());
  });

  readonly summaryKpis = computed<KpiStripItem[]>(() => {
    const matches = this.filteredMatches();
    const platform = this.gameContext.activeGame() ?? matches[0]?.platform ?? 'fortnite';
    const summary = aggregatePlatformMatchStats(matches);
    return buildPlatformKpiItems(platform, summary);
  });

  readonly highlightMatch = computed(() => {
    const matches = this.filteredMatches();
    if (!matches.length) return null;

    const best = [...matches].sort((a, b) => {
      const pa = a.stats?.placement ?? 999;
      const pb = b.stats?.placement ?? 999;
      if (pa !== pb) return pa - pb;
      return (b.stats?.kills ?? 0) - (a.stats?.kills ?? 0);
    })[0];

    return {
      matchId: best.matchId,
      platform: best.platform,
      summary: best.summary,
      relativeTime: formatMatchRelativeTime(best.updatedAt),
      stats: toMatchCardStats(best.stats),
    };
  });

  readonly groupedMatches = computed(() =>
    groupMatchesByDay(this.filteredMatches()).map((group) => ({
      ...group,
      items: group.matches.map((match) => ({
        matchId: match.matchId,
        platform: match.platform,
        summary: match.summary,
        updatedAt: match.updatedAt,
        relativeTime: formatMatchRelativeTime(match.updatedAt),
        stats: toMatchCardStats(match.stats),
      })),
    })),
  );

  constructor() {
    effect(
      () => {
        const tick = this.gameContext.refreshTick();
        if (tick === 0) return;

        const active = this.gameContext.activeGame();
        if (active) {
          this.platformFilter.set(active);
          void this.loadMatches();
        }
      },
      { allowSignalWrites: true },
    );

    // Mismo feed que el toast de notificaciones: merge live → lista sin F5.
    effect(
      () => {
        const userId = this.auth.userId();
        if (!userId) return;
        this.realtime.ensureConnected(userId);

        const liveMatches = this.realtime.liveMatches();
        if (!liveMatches.length) return;

        const newest = liveMatches[0];
        this.allMatches.update((current) => mergeMatchUpdates(liveMatches, current));

        // Si el filtro activo oculta la partida nueva, abrí ese juego / "all".
        const filter = this.platformFilter();
        if (
          newest?.platform &&
          filter !== 'all' &&
          filter !== newest.platform
        ) {
          this.platformFilter.set(newest.platform as MatchPlatformFilter);
        }

        if (this.loading()) {
          this.loading.set(false);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    const active = this.gameContext.activeGame();
    if (active) this.platformFilter.set(active);
    void this.loadMatches();
  }

  setPlatformFilter(value: MatchPlatformFilter): void {
    this.platformFilter.set(value);
  }

  setDateFilter(value: MatchDateFilter): void {
    this.dateFilter.set(value);
  }

  setSortKey(value: MatchSortKey): void {
    this.sortKey.set(value);
  }

  async refresh(event: CustomEvent): Promise<void> {
    await this.loadMatches();
    (event.target as HTMLIonRefresherElement).complete();
  }

  private async loadMatches(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const rows = await this.matchService.listPlayerMatchesOnce(userId, { limit: 100 });
      this.allMatches.set(mergeMatchUpdates(this.realtime.liveMatches(), rows));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error cargando partidas');
    } finally {
      this.loading.set(false);
    }
  }
}

