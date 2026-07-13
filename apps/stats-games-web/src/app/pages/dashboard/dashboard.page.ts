import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { DASHBOARD_QUICK_ACTIONS, type AchievementItem } from '../../data/dashboard-mock.data';
import {
  MOCK_COMMUNITY_BENCHMARKS,
  buildCommunityRankNeighborhood,
} from '../../data/community-mock.data';
import type { LeaderboardEntry } from '../../data/dashboard-mock.data';
import {
  buildMockMatchHistory,
  filterMockMatchesByPlatform,
} from '../../data/match-mock.data';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import {
  isRobloxExperienceGame,
  matchBackendPlatform,
  selectedGameFromBackend,
  type SelectedGame,
} from '../../core/game/selected-game';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import {
  StatsService,
  currentWeeklyPeriodIdForStats,
  previousWeeklyPeriodIdForStats,
  type PlayerStatsRollupView,
} from '../../services/stats.service';
import type { CommunityBenchmarks } from '../../data/community-mock.data';
import { PlayerAvatarService } from '../../services/player-avatar.service';
import { PlatformMediaService } from '../../services/platform-media.service';
import { FortniteOfficialMediaService } from '../../services/fortnite-official-media.service';
import { RobloxExperiencesService } from '../../services/roblox-experiences.service';
import { coachTipsForPlatform } from '../../data/coach-video-tips.data';
import {
  AchievementStripComponent,
  AiInsightCardComponent,
  DashboardHeroComponent,
  IntegrationStatusCardComponent,
  KpiStripComponent,
  LiveMatchFeedComponent,
  MatchHighlightCardComponent,
  OfficialNewsRailComponent,
  PlatformCosmeticsRailComponent,
  PlatformSpotlightCardComponent,
  QuickActionsBarComponent,
  RobloxExperiencesRailComponent,
  WeekComparisonPanelComponent,
  CommunityComparisonPanelComponent,
  CommunityRankTableComponent,
  TrendChartComponent,
  StatsRadarChartComponent,
  PercentileGaugesComponent,
  YoutubeTipCardComponent,
  PlayerSearchHeroComponent,
  type KpiStripItem,
  type LiveMatchFeedItem,
  type TrendChartPoint,
} from '../../ui';
import {
  buildDailyTrendFromMatches,
  buildKdCumulativeTrend,
  buildPlacementTrend,
} from '../../core/charts/stats-chart.util';
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
import {
  aggregatePlatformMatchStats,
  buildPlatformKpiItems,
} from '../../utils/platform-stats.util';
import {
  buildCommunityComparison,
  formatCommunitySampleSize,
  mapCommunityBenchmarksFromApi,
  parsePlayerKdForCommunity,
  parsePlayerWinRateForCommunity,
} from '../../utils/community-stats.util';
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
    DashboardHeroComponent,
    PlatformSpotlightCardComponent,
    QuickActionsBarComponent,
    MatchHighlightCardComponent,
    KpiStripComponent,
    LiveMatchFeedComponent,
    AchievementStripComponent,
    IntegrationStatusCardComponent,
    AiInsightCardComponent,
    WeekComparisonPanelComponent,
    CommunityComparisonPanelComponent,
    CommunityRankTableComponent,
    TrendChartComponent,
    StatsRadarChartComponent,
    PercentileGaugesComponent,
    YoutubeTipCardComponent,
    PlatformCosmeticsRailComponent,
    OfficialNewsRailComponent,
    RobloxExperiencesRailComponent,
    PlayerSearchHeroComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div
        class="sg-dashboard"
        [class.sg-dashboard--loading]="loading()"
      >
        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        <sg-player-search-hero />

        <header class="sg-dashboard__masthead">
          <div class="sg-dashboard__masthead-copy">
            <p class="sg-dashboard__masthead-eyebrow">Dashboard</p>
            <h1 class="sg-dashboard__masthead-title">Tu rendimiento, claro y al día</h1>
            <p class="sg-dashboard__masthead-desc">
              Mirá cómo venís esta semana, comparate con la comunidad y saltá a partidas o coach cuando lo necesites.
            </p>
            @if (lastUpdatedLabel()) {
              <p class="sg-dashboard__updated u-m-0">Actualizado {{ lastUpdatedLabel() }}</p>
            }
          </div>
        </header>

        <nav class="sg-dashboard__flow" aria-label="Secciones del dashboard">
          <a class="sg-dashboard__flow-link" href="#dash-section-week">
            <span>1</span> Semana
          </a>
          <a class="sg-dashboard__flow-link" href="#dash-section-community">
            <span>2</span> Comunidad
          </a>
          <a class="sg-dashboard__flow-link" href="#dash-section-activity">
            <span>3</span> Partidas
          </a>
          <a class="sg-dashboard__flow-link" href="#dash-section-more">
            <span>4</span> Coach
          </a>
        </nav>

        @if (profile()) {
          <sg-dashboard-hero
            [gamerTag]="profile()!.gamerTag"
            [platform]="heroPlatform()"
            [artUrl]="heroArtUrl()"
            [avatarUrl]="playerAvatar()"
            [fortniteId]="profile()!.fortniteId"
            [robloxId]="profile()!.robloxId"
            [live]="realtime.isLive()"
            [playerLevel]="playerLevel()"
            [winsWeek]="weekSummary().winCount"
            [winRate]="weekSummary().winRate"
            [kd]="weeklyKd()"
            [bestPlacement]="bestPlacement()"
            [primaryCtaLabel]="heroPrimaryCta().label"
            [primaryCtaRoute]="heroPrimaryCta().route"
            [secondaryCtaLabel]="heroSecondaryCta().label"
            [secondaryCtaRoute]="heroSecondaryCta().route"
          />
        }

        <section class="sg-dashboard__section" aria-labelledby="dash-section-start">
          <header class="sg-dashboard__section-header">
            <p class="sg-dashboard__section-index" aria-hidden="true">01</p>
            <div class="sg-dashboard__section-heading">
              <h2 id="dash-section-start" class="sg-dashboard__section-title">Empezá acá</h2>
              <p class="sg-dashboard__section-desc">
                Atajos a lo que más usás. El spotlight resume el estado de tu plataforma activa.
              </p>
            </div>
          </header>

          <div class="sg-dashboard__bento-top">
            <sg-platform-spotlight-card
              [platform]="heroPlatform()"
              [winsWeek]="weekSummary().winCount"
              [winRate]="weekSummary().winRate"
              [totalKills]="weekKills()"
            />

            <sg-quick-actions-bar [actions]="quickActions" />
          </div>
        </section>

        <section id="dash-section-week" class="sg-dashboard__section" aria-labelledby="dash-section-week-title">
          <header class="sg-dashboard__section-header">
            <p class="sg-dashboard__section-index" aria-hidden="true">02</p>
            <div class="sg-dashboard__section-heading">
              <h2 id="dash-section-week-title" class="sg-dashboard__section-title">Tu semana</h2>
              <p class="sg-dashboard__section-desc">
                Números de los últimos 7 días, tendencias visuales, el cambio vs la semana anterior y un tip de AI Coach.
              </p>
            </div>
          </header>

          <div class="sg-dashboard__week-layout">
            <div class="sg-dashboard__section-body">
              <div class="sg-dashboard__panel u-surface-card u-p-6 sg-dashboard__kpi-panel">
                <sg-kpi-strip [platform]="heroPlatform()" [items]="kpiItems()" [embedded]="true" />
              </div>

              <sg-week-comparison-panel [items]="weekComparison()" />

              <div class="sg-dashboard__charts">
                <sg-trend-chart
                  title="Kills por día"
                  unit="kills"
                  variant="area"
                  color="#b8ff3c"
                  areaColor="rgba(184, 255, 60, 0.22)"
                  [points]="killsTrend()"
                />
                <sg-trend-chart
                  title="Partidas por día"
                  unit="matches"
                  variant="bar"
                  color="#3de0f5"
                  areaColor="rgba(61, 224, 245, 0.28)"
                  [points]="matchesTrend()"
                />
                <sg-trend-chart
                  title="K/D acumulado"
                  unit="ratio"
                  variant="line"
                  color="#f5d075"
                  areaColor="rgba(245, 208, 117, 0.2)"
                  [points]="kdTrend()"
                />
                <sg-trend-chart
                  title="Placement medio"
                  unit="puesto"
                  variant="area"
                  color="#ff4d9a"
                  areaColor="rgba(255, 77, 154, 0.18)"
                  [points]="placementTrend()"
                />
                <div class="sg-dashboard__charts-span">
                  <sg-stats-radar-chart
                    title="Perfil de la semana"
                    subtitle="Actividad, kills, K/D, placement y consistencia normalizados."
                    [weekly]="weekly()"
                    [dailyTrend]="chartDailyTrend()"
                  />
                </div>
              </div>
            </div>

            <aside class="sg-dashboard__week-aside">
              <sg-ai-insight-card
                [headline]="aiHeadline()"
                [body]="aiBody()"
                (ctaClick)="onAiCta()"
              />
            </aside>
          </div>
        </section>

        <section id="dash-section-community" class="sg-dashboard__section" aria-labelledby="dash-section-community-title">
          <header class="sg-dashboard__section-header">
            <p class="sg-dashboard__section-index" aria-hidden="true">03</p>
            <div class="sg-dashboard__section-heading">
              <h2 id="dash-section-community-title" class="sg-dashboard__section-title">Vs comunidad</h2>
              <p class="sg-dashboard__section-desc">
                Tu puesto en el ranking semanal, rodeado de jugadores cercanos, con KD, WR, kills y score.
              </p>
            </div>
          </header>

          <div class="sg-dashboard__community-stack">
            <sg-community-rank-table
              [platform]="heroPlatform()"
              [rows]="communityRank().rows"
              [yourRank]="communityRank().yourRank"
              [totalPlayers]="communityRank().totalPlayers"
              [sampleLabel]="communitySampleLabel()"
              [subtitle]="communityRankSubtitle()"
            />

            <sg-community-comparison-panel
              title="Tus percentiles"
              subtitle="Comparación clara vs el promedio: Top %, cuántos jugadores superás y dónde está la media."
              [items]="communityComparison()"
              [sampleLabel]="communitySampleLabel()"
              [disclaimer]="communityDisclaimer()"
            />

            <sg-percentile-gauges
              title="Percentiles de un vistazo"
              subtitle="Gauges de cómo te ubicás vs la comunidad en cada KPI."
              [items]="communityComparison()"
            />
          </div>
        </section>

        <section id="dash-section-activity" class="sg-dashboard__section" aria-labelledby="dash-section-activity-title">
          <header class="sg-dashboard__section-header">
            <p class="sg-dashboard__section-index" aria-hidden="true">04</p>
            <div class="sg-dashboard__section-heading">
              <h2 id="dash-section-activity-title" class="sg-dashboard__section-title">Tus partidas</h2>
              <p class="sg-dashboard__section-desc">
                Destacada de la semana e historial reciente. Abrí una partida para ver el mapa.
              </p>
            </div>
          </header>

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
              } @else {
                <article class="sg-dashboard__empty-card u-surface-card u-p-5">
                  <h3 class="sg-dashboard__empty-title">Sin partida destacada</h3>
                  <p class="sg-dashboard__empty-copy u-m-0">
                    Cuando juagues esta semana, acá vas a ver tu mejor resultado.
                  </p>
                  <div class="sg-dashboard__empty-actions">
                    <a routerLink="/tabs/matches" class="u-btn u-btn--ghost">Ver partidas</a>
                    <a routerLink="/tabs/integrations" class="u-btn u-btn--primary">Conectar cuenta</a>
                  </div>
                </article>
              }

              <div class="sg-dashboard__panel u-surface-card u-p-6">
                <div class="sg-dashboard__panel-head">
                  <h3 class="sg-dashboard__panel-title">Historial de la semana</h3>
                  <a routerLink="/tabs/matches" class="sg-dashboard__panel-link">Ver todo</a>
                </div>
                <sg-live-match-feed
                  title=""
                  [items]="historyFeedItems()"
                  [showLiveIndicator]="false"
                  emptyMessage="Sin partidas esta semana. Conectá tu cuenta en Integraciones para trackear."
                />
              </div>
            </div>

            <aside class="sg-dashboard__rail" aria-label="Estado de cuenta y logros">
              <div class="sg-dashboard__rail-group">
                <h3 class="sg-dashboard__rail-label">Cuenta</h3>
                <sg-integration-status-card
                  [valorantConnected]="!!profile()?.valorantId"
                  [leagueOfLegendsConnected]="!!profile()?.leagueOfLegendsId"
                  [cs2Connected]="!!profile()?.cs2Id"
                  [rocketLeagueConnected]="!!profile()?.rocketLeagueId"
                  [fortniteConnected]="!!profile()?.fortniteId"
                  [robloxConnected]="!!profile()?.robloxId"
                  [liveActive]="realtime.isLive()"
                />
              </div>

              <div class="sg-dashboard__rail-group">
                <h3 class="sg-dashboard__rail-label">Logros</h3>
                <sg-achievement-strip title="Esta semana" [items]="achievements()" />
              </div>
            </aside>
          </div>
        </section>

        <section id="dash-section-more" class="sg-dashboard__section" aria-labelledby="dash-section-more-title">
          <header class="sg-dashboard__section-header">
            <p class="sg-dashboard__section-index" aria-hidden="true">05</p>
            <div class="sg-dashboard__section-heading">
              <h2 id="dash-section-more-title" class="sg-dashboard__section-title">Mejorá y descubrí</h2>
              <p class="sg-dashboard__section-desc">
                Tips oficiales y contenido de la plataforma activa.
              </p>
            </div>
          </header>

          <div class="sg-dashboard__discover">
            <div class="sg-dashboard__discover-main">
              @for (tip of coachTips(); track tip.videoId) {
                <sg-youtube-tip-card
                  [videoId]="tip.videoId"
                  [title]="tip.title"
                  [subtitle]="tip.subtitle"
                  [creatorName]="tip.creatorName"
                  badgeLabel="Oficial"
                />
              }

              <details class="sg-dashboard__details" open>
                <summary class="sg-dashboard__details-summary">
                  {{ heroPlatform() === 'fortnite' ? 'Cosmetics y noticias Fortnite' : 'Experiencia activa' }}
                </summary>
                <div class="sg-dashboard__details-body sg-dashboard__details-body--stack">
                  @if (heroPlatform() === 'fortnite') {
                    <sg-platform-cosmetics-rail
                      [items]="fortniteCosmetics()"
                      [loading]="mediaLoading()"
                    />
                    <sg-official-news-rail
                      [items]="fortniteNews()"
                      [bannerUrl]="fortniteNewsBanner()"
                      [loading]="officialMediaLoading()"
                    />
                  } @else {
                    <sg-roblox-experiences-rail
                      [items]="robloxExperiences()"
                      [loading]="robloxExperiencesLoading()"
                    />
                  }
                </div>
              </details>
            </div>
          </div>
        </section>
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
  private readonly avatarService = inject(PlayerAvatarService);
  private readonly platformMedia = inject(PlatformMediaService);
  private readonly fortniteOfficial = inject(FortniteOfficialMediaService);
  private readonly robloxExperiencesSvc = inject(RobloxExperiencesService);
  private readonly statsService = inject(StatsService);
  private readonly router = inject(Router);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly weekly = signal<PlayerStatsRollupView | null>(null);
  readonly previousWeekly = signal<PlayerStatsRollupView | null>(null);
  readonly dailyTrend = signal<PlayerStatsRollupView[]>([]);
  readonly communityBenchmarksApi = signal<CommunityBenchmarks | null>(null);
  readonly leaderboardApi = signal<LeaderboardEntry[] | null>(null);
  readonly communityUsesMock = signal(true);
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
      primary === 'rocket_league' ||
      primary === 'fortnite'
    ) {
      return primary;
    }
    return 'fortnite' as const;
  });

  readonly heroArtUrl = computed(() => this.platformMedia.resolveHeroArt(this.heroPlatform()));

  readonly playerAvatar = computed(() => this.avatarService.url());

  readonly coachTips = computed(() => coachTipsForPlatform(this.heroPlatform()).slice(0, 2));

  readonly fortniteCosmetics = computed(() => {
    const featured = this.fortniteOfficial.featuredOutfits();
    return featured.length ? featured : this.platformMedia.fortniteFeatured();
  });

  readonly fortniteNews = computed(() => this.fortniteOfficial.news().slice(0, 4));

  readonly fortniteNewsBanner = computed(() => this.fortniteOfficial.newsBannerUrl());

  readonly officialMediaLoading = computed(() => this.fortniteOfficial.loading());

  readonly robloxExperiences = computed(() => this.robloxExperiencesSvc.items());

  readonly robloxExperiencesLoading = computed(() => this.robloxExperiencesSvc.loading());

  readonly mediaLoading = computed(
    () => this.platformMedia.loading() || this.fortniteOfficial.loading(),
  );

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

  readonly chartDailyTrend = computed(() => {
    const api = this.dailyTrend();
    const hasSignal = api.some((day) => day.matchCount > 0 || day.totalKills > 0);
    if (hasSignal) return api;
    const userId = this.auth.userId() ?? this.profile()?.userId ?? 'mock-user-demo';
    return buildDailyTrendFromMatches(
      this.weekMatches(),
      userId,
      this.heroPlatform(),
      7,
    );
  });

  readonly killsTrend = computed<TrendChartPoint[]>(() =>
    this.chartDailyTrend().map((day) => ({
      label: day.periodId.slice(5),
      value: day.totalKills,
    })),
  );

  readonly matchesTrend = computed<TrendChartPoint[]>(() =>
    this.chartDailyTrend().map((day) => ({
      label: day.periodId.slice(5),
      value: day.matchCount,
    })),
  );

  readonly kdTrend = computed<TrendChartPoint[]>(() =>
    buildKdCumulativeTrend(this.chartDailyTrend()),
  );

  readonly placementTrend = computed<TrendChartPoint[]>(() =>
    buildPlacementTrend(this.chartDailyTrend()),
  );

  readonly communityComparison = computed(() => {
    const platform = this.heroPlatform();
    const benchmarks =
      this.communityBenchmarksApi() ?? MOCK_COMMUNITY_BENCHMARKS[platform];
    const summary = this.weekSummary();
    const weekly = this.weekly();
    const matchCount = weekly?.matchCount || summary.matchCount;
    const kills = weekly?.totalKills || summary.totalKills;
    const kd =
      weekly != null
        ? this.weeklyKd()
        : computeKdRatio(summary.totalKills, summary.totalDeaths);

    return buildCommunityComparison({
      benchmarks,
      winRate: summary.winRate,
      winRateNumeric: parsePlayerWinRateForCommunity(summary.winRate),
      kd,
      kdNumeric: parsePlayerKdForCommunity(kd),
      kills,
      matchCount,
      kdLabel:
        platform === 'valorant' || platform === 'league_of_legends' ? 'KDA' : 'K/D',
      killsLabel:
        platform === 'rocket_league'
          ? 'Goles / semana'
          : platform === 'fortnite'
            ? 'Elims / semana'
            : 'Kills / semana',
    });
  });

  readonly communitySampleLabel = computed(() => {
    const platform = this.heroPlatform();
    const benchmarks =
      this.communityBenchmarksApi() ?? MOCK_COMMUNITY_BENCHMARKS[platform];
    const label = gamePlatformMeta(platform).label;
    return `${label} · ${formatCommunitySampleSize(benchmarks.sampleSize)} jugadores`;
  });

  readonly communityDisclaimer = computed(() =>
    this.communityUsesMock()
      ? 'Datos de comunidad en preview (mock). Ejecutá seed:mock y desplegá el backend para datos reales.'
      : 'Percentiles calculados vs jugadores activos de tu plataforma esta semana.',
  );

  readonly communityRank = computed(() => {
    const platform = this.heroPlatform();
    const summary = this.weekSummary();
    const weekly = this.weekly();
    const kd = parsePlayerKdForCommunity(this.weeklyKd()) ?? 1.0;
    const winRate = parsePlayerWinRateForCommunity(summary.winRate) ?? 25;
    const kills = weekly?.totalKills || summary.totalKills || 0;
    const matches = weekly?.matchCount || summary.matchCount || 0;

    return buildCommunityRankNeighborhood({
      platform,
      gamerTag: this.profile()?.gamerTag ?? 'Vos',
      kd,
      winRate,
      kills,
      matches,
      radius: 3,
    });
  });

  readonly communityRankSubtitle = computed(() => {
    const label = gamePlatformMeta(this.heroPlatform()).label;
    const you = this.communityRank().yourRank;
    return this.communityUsesMock()
      ? `${label} · puesto #${you} (preview mock)`
      : `${label} · tu puesto #${you} esta semana`;
  });

  readonly bestPlacement = computed(() => {
    const placements = this.weekMatches()
      .map((m) => m.stats?.placement)
      .filter((p): p is number => p != null && p > 0);
    if (!placements.length) return null;
    return Math.min(...placements);
  });

  readonly accountsConnected = computed(() => {
    const p = this.profile();
    return !!(
      p?.fortniteId ||
      p?.robloxId ||
      p?.valorantId ||
      p?.leagueOfLegendsId ||
      p?.cs2Id ||
      p?.rocketLeagueId
    );
  });

  readonly heroPrimaryCta = computed(() =>
    this.accountsConnected()
      ? { label: 'Ver analytics', route: '/tabs/analytics' }
      : { label: 'Conectar cuenta', route: '/tabs/integrations' },
  );

  readonly heroSecondaryCta = computed(() =>
    this.accountsConnected()
      ? { label: 'Gestionar conexiones', route: '/tabs/integrations' }
      : { label: 'Stats avanzadas', route: '/tabs/analytics' },
  );

  readonly lastUpdatedLabel = computed(() => {
    const stamp = this.lastUpdatedAt();
    if (!stamp) return '';
    return stamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  });

  readonly weekKills = computed(() => this.weekly()?.totalKills ?? this.weekSummary().totalKills);

  readonly weekMatchCount = computed(
    () => this.weekly()?.matchCount ?? this.weekSummary().matchCount,
  );

  readonly playerLevel = computed(() => {
    const kills = this.weekKills();
    return Math.max(1, Math.min(99, Math.floor(kills / 3) + 12));
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

  readonly kpiItems = computed<KpiStripItem[]>(() => {
    const summary = aggregatePlatformMatchStats(this.weekMatches());
    const comparison = this.weekComparison();
    const winsDelta = comparison.find((item) => item.label === 'Victorias');
    const killsDelta = comparison.find((item) => item.label === 'Kills' || item.label === 'Goles');
    const matchesDelta = comparison.find((item) => item.label === 'Partidas');
    const kdDelta = comparison.find((item) => item.label === 'K/D');

    return buildPlatformKpiItems(this.heroPlatform(), summary, {
      deltas: {
        wins: { note: shortComparisonNote(winsDelta?.note), trend: winsDelta?.trend },
        kills: { note: shortComparisonNote(killsDelta?.note), trend: killsDelta?.trend },
        matches: { note: shortComparisonNote(matchesDelta?.note), trend: matchesDelta?.trend },
        kd: { note: shortComparisonNote(kdDelta?.note), trend: kdDelta?.trend },
      },
    });
  });

  readonly effectiveRecentMatches = computed(() => {
    const userId = this.auth.userId() ?? 'mock-user-demo';
    const platform = this.heroPlatform();
    const api = this.recentMatches();
    const source = api.length > 0 ? api : buildMockMatchHistory(userId);
    return filterMockMatchesByPlatform(source, platform);
  });

  readonly historyFeedItems = computed<LiveMatchFeedItem[]>(() =>
    this.weekMatches().slice(0, 8).map((m) => this.toFeedItem(m)),
  );

  readonly achievements = computed<AchievementItem[]>(() => {
    const matches = this.weekMatches();
    const winStreak = computeWinStreak(matches);
    const playStreak = computePlayStreakFromDailyTrend(this.chartDailyTrend());
    const bestKills = computeBestKills(matches);
    const summary = this.weekSummary();

    return [
      {
        id: 'wins',
        title: 'Victorias',
        subtitle: `${summary.winCount} esta semana`,
        icon: 'W',
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
        icon: 'S',
        tone: 'lime',
      },
      {
        id: 'clutch',
        title: 'Record kills',
        subtitle: bestKills > 0 ? `${bestKills} en una partida` : 'Sin datos todavía',
        icon: 'K',
        tone: 'cyan',
      },
      {
        id: 'grind',
        title: 'Actividad',
        subtitle: `${this.weekMatchCount()} partidas esta semana`,
        icon: 'P',
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
    const community = this.communityComparison();
    if (!w || w.matchCount === 0) {
      return 'Vinculá un juego en Integraciones (Riot, Steam, Epic o Roblox) para ver tus stats en vivo.';
    }

    const topWinRate = community.find((item) => item.label === 'Win rate');
    if (topWinRate && topWinRate.betterThanPct >= 65) {
      return `${topWinRate.topPercentLabel} en win rate vs la comunidad. ${topWinRate.comparisonNote}.`;
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

    this.loading.set(true);
    this.error.set(null);
    try {
      const profile = await this.playerService.getPlayerProfileOrNull(userId);
      if (!profile) {
        await this.router.navigateByUrl('/onboarding');
        return;
      }
      this.profile.set(profile);
      void this.avatarService.resolve({
        avatarUrl: profile.avatarUrl,
        robloxId: profile.robloxId,
        gamerTag: profile.gamerTag,
      });

      const uiGame: SelectedGame =
        this.gameContext.activeGame() ??
        selectedGameFromBackend(profile.primaryPlatform) ??
        'fortnite';
      const platform = matchBackendPlatform(uiGame);

      const periodId = currentWeeklyPeriodIdForStats();
      const activePlatform = uiGame;
      void this.hydratePlatformMedia(activePlatform);

      const [matches, weeklyRows, previousWeeklyRows, daily, community, leaderboard] =
        await Promise.all([
        this.matchService.listPlayerMatchesOnce(userId, { limit: 50 }),
        firstValueFrom(
          this.statsService.listPlayerStatsRollups(
            userId,
            'WEEKLY',
            periodId,
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
        firstValueFrom(
          this.statsService.getCommunityBenchmarks(platform ?? 'fortnite', periodId),
        ).catch(() => null),
        firstValueFrom(
          this.statsService.listWeeklyLeaderboard(platform ?? 'fortnite', periodId, 5),
        ).catch(() => null),
      ]);

      this.recentMatches.set(matches);
      this.weekly.set(weeklyRows[0] ?? null);
      this.previousWeekly.set(previousWeeklyRows[0] ?? null);
      this.dailyTrend.set(daily);
      this.lastUpdatedAt.set(new Date());

      if (community && community.sampleSize > 0) {
        this.communityBenchmarksApi.set(mapCommunityBenchmarksFromApi({
          platform: selectedGameFromBackend(community.platform, activePlatform),
          sampleSize: community.sampleSize,
          avgWinRate: community.avgWinRate,
          avgKd: community.avgKd,
          avgKillsPerWeek: community.avgKillsPerWeek,
          avgMatchesPerWeek: community.avgMatchesPerWeek,
          winRateStd: community.winRateStd,
          kdStd: community.kdStd,
          killsStd: community.killsStd,
        }));
        this.communityUsesMock.set(false);
      } else {
        this.communityBenchmarksApi.set(null);
        this.communityUsesMock.set(true);
      }

      if (leaderboard && leaderboard.length > 0) {
        this.leaderboardApi.set(
          leaderboard.map((entry) => ({
            rank: entry.rank,
            gamerTag: entry.gamerTag,
            platform: selectedGameFromBackend(entry.platform, activePlatform),
            score: entry.score,
            delta: entry.delta,
            trend: (entry.trend as 'up' | 'down' | 'flat') ?? 'flat',
          })),
        );
      } else {
        this.leaderboardApi.set(null);
      }
    } catch (err) {
      this.error.set(extractGraphqlErrorMessage(err, 'Error cargando dashboard'));
    } finally {
      this.loading.set(false);
    }
  }

  private async hydratePlatformMedia(platform: SelectedGame): Promise<void> {
    void this.platformMedia.hydrateForPlatform(platform);
    if (platform === 'fortnite') {
      await this.fortniteOfficial.hydrate({ newsLimit: 6, featuredLimit: 8 });
      return;
    }
    if (isRobloxExperienceGame(platform)) {
      await this.robloxExperiencesSvc.load(8);
    }
  }
}

function shortComparisonNote(note?: string): string | undefined {
  if (!note) return undefined;
  if (note === 'igual que la semana pasada') return '≈ sem. pasada';
  return note.replace(' vs semana pasada', '');
}
