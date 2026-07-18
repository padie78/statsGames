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
  type MatchResultFilter,
} from '../../ui';
import {
  formatMatchRelativeTime,
  groupMatchesByDay,
  isMatchWin,
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
          [dateRange]="dateFilter()"
          [result]="resultFilter()"
          [sort]="sortKey()"
          [query]="searchQuery()"
          [mode]="modeFilter()"
          [identity]="identityFilter()"
          [map]="mapFilter()"
          [modeOptions]="modeOptions()"
          [identityOptions]="identityOptions()"
          [mapOptions]="mapOptions()"
          [identityLabel]="identityLabel()"
          [resultCount]="filteredMatches().length"
          [usingMockData]="usingMockData()"
          [hasActiveFilters]="hasActiveFilters()"
          (dateRangeChange)="setDateFilter($event)"
          (resultChange)="setResultFilter($event)"
          (sortChange)="setSortKey($event)"
          (queryChange)="setSearchQuery($event)"
          (modeChange)="setModeFilter($event)"
          (identityChange)="setIdentityFilter($event)"
          (mapChange)="setMapFilter($event)"
          (clearFilters)="clearFilters()"
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
              No hay resultados con los filtros actuales. Probá ampliar la búsqueda o conectá tu
              cuenta en Integraciones.
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
  readonly dateFilter = signal<MatchDateFilter>('all');
  readonly resultFilter = signal<MatchResultFilter>('all');
  readonly sortKey = signal<MatchSortKey>('newest');
  readonly searchQuery = signal('');
  readonly modeFilter = signal('all');
  readonly identityFilter = signal('all');
  readonly mapFilter = signal('all');
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  readonly bannerPlatform = computed(
    (): SelectedGame => this.gameContext.activeGame() ?? 'fortnite',
  );

  /** Solo partidas del juego activo (selector del chrome). */
  readonly platformScopedMatches = computed(() => {
    const userId = this.auth.userId() ?? 'mock-user-demo';
    return resolveMatchHistory(this.allMatches(), userId, this.bannerPlatform());
  });

  readonly modeOptions = computed(() =>
    this.uniqueSorted(
      this.platformScopedMatches()
        .map((m) => m.stats?.mode?.trim())
        .filter((v): v is string => !!v),
    ),
  );

  readonly identityOptions = computed(() =>
    this.uniqueSorted(
      this.platformScopedMatches()
        .map((m) => (m.stats?.champion || m.stats?.agent || m.stats?.role || '').trim())
        .filter((v): v is string => !!v),
    ),
  );

  readonly mapOptions = computed(() =>
    this.uniqueSorted(
      this.platformScopedMatches()
        .map((m) => m.stats?.map?.trim())
        .filter((v): v is string => !!v),
    ),
  );

  readonly identityLabel = computed(() => {
    const platform = this.bannerPlatform();
    if (platform === 'league_of_legends') return 'Campeón';
    if (platform === 'valorant') return 'Agente';
    if (platform === 'overwatch2') return 'Héroe';
    return 'Personaje';
  });

  readonly usingMockData = computed(
    () => this.allMatches().length === 0 && this.filteredMatches().length > 0,
  );

  readonly hasActiveFilters = computed(
    () =>
      this.dateFilter() !== 'all' ||
      this.resultFilter() !== 'all' ||
      this.searchQuery().trim().length > 0 ||
      this.modeFilter() !== 'all' ||
      this.identityFilter() !== 'all' ||
      this.mapFilter() !== 'all' ||
      this.sortKey() !== 'newest',
  );

  readonly filteredMatches = computed(() => {
    let rows = this.platformScopedMatches();

    const range = this.dateFilter();
    if (range !== 'all') {
      const days = range === '7d' ? 7 : 30;
      const cutoff = Date.now() - days * 86_400_000;
      rows = rows.filter((m) => new Date(m.updatedAt).getTime() >= cutoff);
    }

    const result = this.resultFilter();
    if (result === 'wins') {
      rows = rows.filter((m) => isMatchWin(m.stats));
    } else if (result === 'losses') {
      rows = rows.filter((m) => !isMatchWin(m.stats));
    }

    const mode = this.modeFilter();
    if (mode !== 'all') {
      rows = rows.filter((m) => (m.stats?.mode ?? '') === mode);
    }

    const identity = this.identityFilter();
    if (identity !== 'all') {
      rows = rows.filter((m) => {
        const value = m.stats?.champion || m.stats?.agent || m.stats?.role || '';
        return value === identity;
      });
    }

    const map = this.mapFilter();
    if (map !== 'all') {
      rows = rows.filter((m) => (m.stats?.map ?? '') === map);
    }

    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      rows = rows.filter((m) => this.matchSearchHaystack(m).includes(query));
    }

    return sortMatches(rows, this.sortKey());
  });

  readonly summaryKpis = computed<KpiStripItem[]>(() => {
    const matches = this.filteredMatches();
    const platform = this.bannerPlatform() ?? matches[0]?.platform ?? 'fortnite';
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
        this.searchQuery.set('');
        this.dateFilter.set('all');
        this.resultFilter.set('all');
        this.sortKey.set('newest');
        this.resetDetailFilters();
        void this.loadMatches();
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

        this.allMatches.update((current) => mergeMatchUpdates(liveMatches, current));

        if (this.loading()) {
          this.loading.set(false);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    void this.loadMatches();
  }

  setDateFilter(value: MatchDateFilter): void {
    this.dateFilter.set(value);
  }

  setResultFilter(value: MatchResultFilter): void {
    this.resultFilter.set(value);
  }

  setSortKey(value: MatchSortKey): void {
    this.sortKey.set(value);
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  setModeFilter(value: string): void {
    this.modeFilter.set(value);
  }

  setIdentityFilter(value: string): void {
    this.identityFilter.set(value);
  }

  setMapFilter(value: string): void {
    this.mapFilter.set(value);
  }

  clearFilters(): void {
    this.dateFilter.set('all');
    this.resultFilter.set('all');
    this.sortKey.set('newest');
    this.searchQuery.set('');
    this.resetDetailFilters();
  }

  async refresh(event: CustomEvent): Promise<void> {
    await this.loadMatches();
    (event.target as HTMLIonRefresherElement).complete();
  }

  private resetDetailFilters(): void {
    this.modeFilter.set('all');
    this.identityFilter.set('all');
    this.mapFilter.set('all');
  }

  private matchSearchHaystack(match: MatchUpdateView): string {
    const s = match.stats;
    return [
      match.summary,
      match.matchId,
      match.platform,
      s?.mode,
      s?.map,
      s?.champion,
      s?.agent,
      s?.role,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es'));
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
