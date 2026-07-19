import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import {
  lolBannerSplashFallbackUrl,
  lolMatchesBannerSplashUrl,
} from '../../core/game/lol-ddragon.util';
import type { SelectedGame } from '../../core/game/selected-game';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { MatchNotificationsStore } from '../../stores/match-notifications.store';
import {
  MatchFiltersToolbarComponent,
  MatchHighlightCardComponent,
  MatchHistoryListComponent,
  MatchPreviewModalComponent,
  WeekHeroBrandComponent,
  sgFadeSlideIn,
  type MatchDateFilter,
  type MatchHistoryListItem,
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
import { aggregatePlatformMatchStats } from '../../utils/platform-stats.util';
import { resolveLolRegionLabel } from '../../utils/lol-region.util';
import { resolveMatchHistory } from '../../data/match-mock.data';

@Component({
  standalone: true,
  selector: 'app-matches-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    RouterLink,
    MatchFiltersToolbarComponent,
    MatchHighlightCardComponent,
    MatchHistoryListComponent,
    MatchPreviewModalComponent,
    WeekHeroBrandComponent,
  ],
  animations: [sgFadeSlideIn],
  template: `
    <sg-match-preview-modal
      [matchId]="previewMatchId()"
      (closed)="closeMatchPreview()"
    />

    <ion-content class="sg-page-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div
        class="sg-matches-page"
        [class.sg-matches-page--loading]="loading()"
        [attr.data-game]="bannerPlatform()"
      >
        <section
          class="sg-dashboard__week sg-matches__hero"
          [attr.data-game]="bannerPlatform()"
          aria-label="Partidas"
        >
          <img
            class="sg-dashboard__week-art sg-matches__hero-art"
            [src]="heroArtSrc()"
            [alt]="platformMeta().label + ' art'"
            (error)="onHeroArtError()"
          />
          <div class="sg-dashboard__week-veil" aria-hidden="true"></div>

          <div class="sg-dashboard__week-inner">
            <sg-week-hero-brand [platform]="bannerPlatform()" />
            <div class="sg-dashboard__week-main">
              <p class="sg-dashboard__week-eyebrow">
                {{ platformMeta().label }} · Historial
                @if (!loading()) {
                  <span>· {{ filteredMatches().length }} resultados</span>
                }
              </p>
              <h1 class="sg-dashboard__week-title">Partidas</h1>
              <p class="sg-dashboard__week-lede u-m-0">
                @if (loading()) {
                  Cargando tu historial…
                } @else if (filteredMatches().length === 0) {
                  Sin resultados con estos filtros. Probá ampliar el periodo.
                } @else {
                  Tu historial filtrable por resultado, modo y
                  {{ identityLabel().toLowerCase() }}. Abrí un match para el análisis completo.
                }
              </p>

              @if (heroChips().length) {
                <div class="sg-dashboard__week-chips" aria-label="Región y modo">
                  @for (chip of heroChips(); track chip.id) {
                    <span
                      class="sg-dashboard__week-chip"
                      [attr.data-tone]="chip.tone"
                    >{{ chip.label }}</span>
                  }
                </div>
              }

              @if (latestMatch(); as latest) {
                <div class="sg-dashboard__week-latest">
                  <div class="sg-dashboard__week-latest-copy">
                    <span class="sg-dashboard__week-latest-label">Último match</span>
                    <span
                      class="sg-dashboard__week-latest-title"
                      [class.sg-dashboard__week-latest-title--win]="latest.won"
                      [class.sg-dashboard__week-latest-title--loss]="!latest.won"
                    >{{ latest.headline }}</span>
                    <span class="sg-dashboard__week-latest-time">{{ latest.relativeTime }}</span>
                  </div>
                  <button
                    type="button"
                    class="u-btn u-btn--gold sg-dashboard__week-cta"
                    (click)="openMatchPreview(latest)"
                  >
                    Ver análisis
                  </button>
                </div>
              } @else if (!loading()) {
                <div class="sg-dashboard__week-latest sg-dashboard__week-latest--empty">
                  <div class="sg-dashboard__week-latest-copy">
                    <span class="sg-dashboard__week-latest-label">Sin partidas</span>
                    <span class="sg-dashboard__week-latest-title">
                      Conectá tu cuenta para sincronizar el historial
                    </span>
                  </div>
                  <a
                    routerLink="/tabs/integrations"
                    class="u-btn u-btn--gold sg-dashboard__week-cta"
                  >
                    Integraciones
                  </a>
                </div>
              }

              <div class="sg-dashboard__week-kpis" aria-label="KPIs del filtro">
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().winRate }}</span>
                  <span class="sg-dashboard__week-kpi-label">Win rate</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().kd }}</span>
                  <span class="sg-dashboard__week-kpi-label">{{ kdLabel() }}</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().wins }}</span>
                  <span class="sg-dashboard__week-kpi-label">Victorias</span>
                </div>
                <div class="sg-dashboard__week-kpi">
                  <span class="sg-dashboard__week-kpi-value">{{ heroKpis().matches }}</span>
                  <span class="sg-dashboard__week-kpi-label">Partidas</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="sg-matches__body page-shell page-shell--fluid">
          <section class="sg-dashboard__block" aria-labelledby="matches-filters">
            <div class="sg-dashboard__block-head">
              <div>
                <h2 id="matches-filters" class="sg-dashboard__block-title">Filtros</h2>
                <p class="sg-dashboard__block-desc">
                  Período, resultado y búsqueda sobre tu historial.
                </p>
              </div>
              @if (hasActiveFilters()) {
                <button
                  type="button"
                  class="sg-dashboard__block-link"
                  (click)="clearFilters()"
                >
                  Limpiar →
                </button>
              }
            </div>
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
          </section>

          @if (error()) {
            <p class="u-error">{{ error() }}</p>
          }

          @if (loading()) {
            <div
              class="sg-matches__loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label="Cargando partidas"
            >
              <span class="sg-dashboard__loading-dots" aria-hidden="true">
                <i></i><i></i><i></i>
              </span>
            </div>
          } @else if (filteredMatches().length > 0) {
            @if (highlightMatch(); as match) {
              <section class="sg-dashboard__block" aria-labelledby="matches-highlight" @sgFadeSlideIn>
                <div class="sg-dashboard__block-head">
                  <div>
                    <h2 id="matches-highlight" class="sg-dashboard__block-title">
                      Partida destacada
                    </h2>
                    <p class="sg-dashboard__block-desc">
                      Mejor resultado del filtro actual.
                    </p>
                  </div>
                </div>
                <sg-match-highlight-card
                  [matchId]="match.matchId"
                  [platform]="match.platform"
                  [summary]="match.summary"
                  [updatedAt]="match.relativeTime"
                  [stats]="match.stats"
                  [showHistoryLink]="false"
                  [compact]="true"
                  [fresh]="isFreshMatch(match.matchId)"
                  openMode="event"
                  (openMatch)="openMatchPreview(match)"
                />
              </section>
            }

            <section class="sg-dashboard__block" aria-labelledby="matches-history" @sgFadeSlideIn>
              <div class="sg-dashboard__block-head">
                <div>
                  <h2 id="matches-history" class="sg-dashboard__block-title">Historial</h2>
                  <p class="sg-dashboard__block-desc">
                    Agrupado por día. Tocá una partida para ver el resumen.
                  </p>
                </div>
              </div>
              <sg-match-history-list
                [groups]="groupedMatches()"
                emptyMessage="No hay partidas con estos filtros."
                openMode="event"
                (matchSelect)="openMatchPreview($event)"
              />
            </section>
          } @else {
            <section class="sg-dashboard__block" aria-labelledby="matches-empty" @sgFadeSlideIn>
              <div class="sg-dashboard__block-head">
                <div>
                  <h2 id="matches-empty" class="sg-dashboard__block-title">Historial</h2>
                  <p class="sg-dashboard__block-desc">
                    Sin resultados con los filtros actuales.
                  </p>
                </div>
              </div>
              <article class="sg-dashboard__empty-card">
                <div class="sg-dashboard__empty-copy-wrap">
                  <h3 class="sg-dashboard__empty-title">Sin partidas</h3>
                  <p class="sg-dashboard__empty-copy u-m-0">
                    Probá ampliar la búsqueda o conectá tu cuenta en Integraciones.
                  </p>
                </div>
                <div class="sg-dashboard__empty-actions">
                  <a routerLink="/tabs/integrations" class="u-btn u-btn--gold">Ir a Integraciones</a>
                </div>
              </article>
            </section>
          }
        </div>
      </div>
    </ion-content>
  `,
})
export class MatchesPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
  private readonly matchService = inject(MatchService);
  private readonly realtime = inject(AppSyncRealtimeService);
  private readonly notifications = inject(MatchNotificationsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly allMatches = signal<MatchUpdateView[]>([]);
  readonly dateFilter = signal<MatchDateFilter>('all');
  readonly resultFilter = signal<MatchResultFilter>('all');
  readonly sortKey = signal<MatchSortKey>('newest');
  readonly searchQuery = signal('');
  readonly modeFilter = signal('all');
  readonly identityFilter = signal('all');
  readonly mapFilter = signal('all');
  /** Foco desde Evolución: deaths | vision | cs | kda | form | wins | losses */
  readonly topicFilter = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly previewMatchId = signal<string | null>(null);
  private readonly heroArtFailed = signal(false);

  readonly bannerPlatform = computed(
    (): SelectedGame => this.gameContext.activeGame() ?? 'fortnite',
  );

  readonly platformMeta = computed(() => gamePlatformMeta(this.bannerPlatform()));

  /** Arte distinto a Inicio: pool cinematic de Partidas para LoL. */
  readonly heroArtSrc = computed(() => {
    const meta = this.platformMeta();
    const seed = (this.auth.userId() ?? 'lol-matches').length + 11;
    if (this.heroArtFailed()) {
      if (this.bannerPlatform() === 'league_of_legends') {
        return lolBannerSplashFallbackUrl(seed, 'matches');
      }
      return meta.portraitFallbackUrl || meta.artUrl;
    }
    if (this.bannerPlatform() === 'league_of_legends') {
      return lolMatchesBannerSplashUrl(seed);
    }
    return meta.portraitUrl || meta.artUrl;
  });

  readonly kdLabel = computed(() => {
    const p = this.bannerPlatform();
    return p === 'valorant' ||
      p === 'league_of_legends' ||
      p === 'dota2' ||
      p === 'overwatch2'
      ? 'KDA'
      : 'K/D';
  });

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
      this.sortKey() !== 'newest' ||
      Boolean(this.topicFilter()),
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

    const topic = this.topicFilter();
    if (topic === 'deaths') {
      rows = [...rows].sort((a, b) => (b.stats?.deaths ?? 0) - (a.stats?.deaths ?? 0));
    } else if (topic === 'vision') {
      rows = [...rows].sort(
        (a, b) => (b.stats?.visionScore ?? 0) - (a.stats?.visionScore ?? 0),
      );
    } else if (topic === 'cs') {
      rows = [...rows].sort((a, b) => (b.stats?.cs ?? 0) - (a.stats?.cs ?? 0));
    } else if (topic === 'kda') {
      rows = [...rows].sort((a, b) => {
        const kdaA =
          ((a.stats?.kills ?? 0) + (a.stats?.assists ?? 0)) / Math.max(a.stats?.deaths ?? 0, 1);
        const kdaB =
          ((b.stats?.kills ?? 0) + (b.stats?.assists ?? 0)) / Math.max(b.stats?.deaths ?? 0, 1);
        return kdaA - kdaB;
      });
    }

    if (topic === 'deaths' || topic === 'vision' || topic === 'cs' || topic === 'kda') {
      return rows;
    }
    return sortMatches(rows, this.sortKey());
  });

  readonly heroKpis = computed(() => {
    const matches = this.filteredMatches();
    const summary = aggregatePlatformMatchStats(matches);
    return {
      winRate: summary.winRate || '—',
      kd: summary.kda || summary.kd || '—',
      wins: summary.winCount,
      matches: summary.matchCount,
    };
  });

  /** Última partida del juego activo (sin filtros de historial). */
  readonly latestMatch = computed(() => {
    const rows = sortMatches(this.platformScopedMatches(), 'newest');
    const match = rows[0];
    if (!match) return null;

    const won = isMatchWin(match.stats);
    const identity = (
      match.stats?.champion ||
      match.stats?.agent ||
      match.stats?.role ||
      ''
    ).trim();
    const mode = (match.stats?.mode ?? '').trim();
    const parts = [won ? 'Win' : 'Loss'];
    if (identity) parts.push(identity);
    if (mode) parts.push(mode);

    return {
      matchId: match.matchId,
      won,
      mode,
      headline: parts.join(' · '),
      relativeTime: formatMatchRelativeTime(match.updatedAt),
    };
  });

  readonly heroChips = computed(() => {
    const chips: Array<{ id: string; label: string; tone: 'region' | 'mode' | 'game' }> = [];
    const platform = this.bannerPlatform();

    if (platform === 'league_of_legends') {
      chips.push({
        id: 'region',
        label: resolveLolRegionLabel(),
        tone: 'region',
      });
    } else {
      chips.push({
        id: 'game',
        label: this.platformMeta().shortLabel,
        tone: 'game',
      });
    }

    const mode =
      this.modeFilter() !== 'all'
        ? this.modeFilter()
        : (this.latestMatch()?.mode ?? '');
    if (mode) {
      chips.push({ id: `mode-${mode}`, label: mode, tone: 'mode' });
    }

    return chips;
  });

  readonly highlightMatch = computed(() => {
    const matches = this.filteredMatches();
    if (!matches.length) return null;

    const best = [...matches].sort((a, b) => {
      const winA = isMatchWin(a.stats) ? 1 : 0;
      const winB = isMatchWin(b.stats) ? 1 : 0;
      if (winA !== winB) return winB - winA;
      const pa = a.stats?.placement ?? 999;
      const pb = b.stats?.placement ?? 999;
      if (pa !== pb) return pa - pb;
      return (b.stats?.kills ?? 0) - (a.stats?.kills ?? 0);
    })[0];

    return {
      matchId: best.matchId,
      platform: best.platform,
      summary: best.summary,
      updatedAt: best.updatedAt,
      relativeTime: formatMatchRelativeTime(best.updatedAt),
      stats: toMatchCardStats(best.stats),
    };
  });

  readonly groupedMatches = computed(() => {
    const newestId = this.notifications.newestMatchId();
    const liveIds = new Set(this.realtime.liveMatches().map((m) => m.matchId));
    return groupMatchesByDay(this.filteredMatches()).map((group) => ({
      ...group,
      items: group.matches.map((match) => ({
        matchId: match.matchId,
        platform: match.platform,
        summary: match.summary,
        updatedAt: match.updatedAt,
        relativeTime: formatMatchRelativeTime(match.updatedAt),
        stats: toMatchCardStats(match.stats),
        live: liveIds.has(match.matchId) && newestId === match.matchId,
        fresh: newestId === match.matchId,
      })),
    }));
  });

  isFreshMatch(matchId: string): boolean {
    return this.notifications.isFreshMatch(matchId);
  }

  constructor() {
    effect(
      () => {
        const tick = this.gameContext.refreshTick();
        this.bannerPlatform();
        this.heroArtFailed.set(false);
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
    this.applyQueryParams(this.route.snapshot.queryParamMap);
    this.route.queryParamMap.subscribe((params) => this.applyQueryParams(params));
    void this.loadMatches();
  }

  private applyQueryParams(params: ParamMap): void {
    const date = params.get('date');
    if (date === '7d' || date === '30d' || date === 'all') this.dateFilter.set(date);

    const result = params.get('result');
    if (result === 'wins' || result === 'losses' || result === 'all') {
      this.resultFilter.set(result);
    }

    const sort = params.get('sort');
    if (sort === 'newest' || sort === 'oldest' || sort === 'placement' || sort === 'kills') {
      this.sortKey.set(sort);
    }

    const q = params.get('q');
    if (q != null) this.searchQuery.set(q);

    const topic = params.get('topic');
    this.topicFilter.set(topic?.trim() || null);
  }

  onHeroArtError(): void {
    this.heroArtFailed.set(true);
  }

  openMatchPreview(match: { matchId: string } | MatchHistoryListItem): void {
    this.previewMatchId.set(match.matchId);
  }

  closeMatchPreview(): void {
    this.previewMatchId.set(null);
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
    this.topicFilter.set(null);
    this.resetDetailFilters();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
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
