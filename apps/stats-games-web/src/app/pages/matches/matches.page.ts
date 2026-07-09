import { Component, OnInit, ViewEncapsulation, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import {
  LiveMatchFeedComponent,
  PlatformPageBannerComponent,
  type LiveMatchFeedItem,
} from '../../ui';
import { toMatchCardStats } from '../../utils/match-stats.util';

type PlatformFilter = 'all' | 'fortnite' | 'roblox';
type DateFilter = 'all' | '7d' | '30d';

@Component({
  standalone: true,
  selector: 'app-matches-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSelect,
    IonSelectOption,
    LiveMatchFeedComponent,
    PlatformPageBannerComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-4">
        <sg-platform-page-banner
          [platform]="bannerPlatform()"
          title="Partidas"
          subtitle="Historial completo con filtros por plataforma y fecha."
        />

        <section class="u-surface-card u-p-4 u-flex u-gap-3 u-flex-wrap">
          <ion-select
            label="Plataforma"
            labelPlacement="stacked"
            [formControl]="filterForm.controls.platform"
            (ionChange)="applyFilters()"
          >
            <ion-select-option value="all">Todas</ion-select-option>
            <ion-select-option value="fortnite">Fortnite</ion-select-option>
            <ion-select-option value="roblox">Roblox</ion-select-option>
          </ion-select>

          <ion-select
            label="Período"
            labelPlacement="stacked"
            [formControl]="filterForm.controls.dateRange"
            (ionChange)="applyFilters()"
          >
            <ion-select-option value="all">Todo</ion-select-option>
            <ion-select-option value="7d">Últimos 7 días</ion-select-option>
            <ion-select-option value="30d">Últimos 30 días</ion-select-option>
          </ion-select>
        </section>

        @if (error()) {
          <p class="u-error">{{ error() }}</p>
        }

        <sg-live-match-feed
          title="Resultados"
          [items]="feedItems()"
          [showLiveIndicator]="false"
          [emptyMessage]="loading() ? 'Cargando partidas…' : 'No hay partidas con estos filtros.'"
        />
      </div>
    </ion-content>
  `,
})
export class MatchesPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly gameContext = inject(GameContextService);
  private readonly matchService = inject(MatchService);
  private readonly fb = inject(FormBuilder);

  readonly allMatches = signal<MatchUpdateView[]>([]);
  readonly filteredMatches = signal<MatchUpdateView[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  readonly filterForm = this.fb.nonNullable.group({
    platform: ['all' as PlatformFilter],
    dateRange: ['all' as DateFilter],
  });

  readonly bannerPlatform = computed(
    (): 'fortnite' | 'roblox' => {
      const filter = this.filterForm.controls.platform.value;
      if (filter === 'fortnite' || filter === 'roblox') return filter;
      return this.gameContext.activeGame() ?? 'fortnite';
    },
  );

  readonly feedItems = computed<LiveMatchFeedItem[]>(() =>
    this.filteredMatches().map((m) => ({
      matchId: m.matchId,
      platform: m.platform,
      summary: m.summary,
      updatedAt: m.updatedAt,
      stats: toMatchCardStats(m.stats),
    })),
  );

  constructor() {
    effect(() => {
      const tick = this.gameContext.refreshTick();
      if (tick === 0) return;

      const active = this.gameContext.activeGame();
      if (active) {
        this.filterForm.controls.platform.setValue(active, { emitEvent: false });
        this.applyFilters();
      } else {
        void this.loadMatches();
      }
    });
  }

  ngOnInit(): void {
    const active = this.gameContext.activeGame();
    if (active) {
      this.filterForm.controls.platform.setValue(active, { emitEvent: false });
    }
    void this.loadMatches();
  }

  async refresh(event: CustomEvent): Promise<void> {
    await this.loadMatches();
    (event.target as HTMLIonRefresherElement).complete();
  }

  applyFilters(): void {
    const { platform, dateRange } = this.filterForm.getRawValue();
    let rows = [...this.allMatches()];

    if (platform !== 'all') {
      rows = rows.filter((m) => m.platform === platform);
    }

    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : 30;
      const cutoff = Date.now() - days * 86_400_000;
      rows = rows.filter((m) => new Date(m.updatedAt).getTime() >= cutoff);
    }

    this.filteredMatches.set(rows);
  }

  private async loadMatches(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const rows = await this.matchService.listPlayerMatchesOnce(userId, { limit: 100 });
      this.allMatches.set(rows);
      this.applyFilters();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error cargando partidas');
    } finally {
      this.loading.set(false);
    }
  }
}
