import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import {
  LiveMatchFeedComponent,
  type LiveMatchFeedItem,
  NeonBadgeComponent,
  PremiumUpsellBannerComponent,
  StatValueComponent,
} from '../../ui';

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    NeonBadgeComponent,
    StatValueComponent,
    LiveMatchFeedComponent,
    PremiumUpsellBannerComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>StatsGames</ion-title>
        <ion-button slot="end" fill="clear" (click)="logout()">Salir</ion-button>
      </ion-toolbar>
    </ion-header>

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
                Player profile
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
          </div>

          <div class="u-grid-stats u-mt-2">
            <sg-stat-value label="Matches" [value]="recentMatches().length" accent="lime" />
            <sg-stat-value label="Live feed" [value]="realtime.liveCount()" accent="purple" />
            <sg-stat-value label="Platform" [value]="profile()?.primaryPlatform ?? '—'" />
            <sg-stat-value label="Session" [value]="auth.email() ? 'ON' : '—'" accent="pink" />
          </div>
        </section>

        @if (showPremiumBanner() && realtime.premiumInsight().visible) {
          <sg-premium-upsell-banner
            [headline]="realtime.premiumInsight().headline"
            [body]="realtime.premiumInsight().body"
            (ctaClick)="onPremiumCta()"
            (dismiss)="dismissPremium()"
          />
        }

        @if (showLinkPlatformForm()) {
          <section class="u-surface-card u-p-4">
            <h2 class="u-font-display u-text-md u-fw-bold u-uppercase u-tracking-wide u-mb-2">
              Vincular cuenta
            </h2>
            <p class="u-hint">Para webhooks con platformUserId desde Roblox / Fortnite.</p>
            <form [formGroup]="linkForm" (ngSubmit)="submitLinkPlatform()">
              <ion-list lines="none">
                <ion-item>
                  <ion-select label="Plataforma" labelPlacement="stacked" formControlName="platform">
                    @if (!profile()?.fortniteId) {
                      <ion-select-option value="fortnite">Fortnite</ion-select-option>
                    }
                    @if (!profile()?.robloxId) {
                      <ion-select-option value="roblox">Roblox</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-input label="ID externo" labelPlacement="stacked" formControlName="externalId" />
                </ion-item>
              </ion-list>
              @if (linkError()) {
                <p class="u-error">{{ linkError() }}</p>
              }
              <button
                type="submit"
                class="u-btn u-btn--lime u-btn--block u-mt-3"
                [disabled]="linkForm.invalid || linking()"
              >
                {{ linking() ? 'Vinculando...' : 'Vincular' }}
              </button>
            </form>
          </section>
        }

        <sg-live-match-feed
          title="Partidas recientes"
          [items]="historyFeedItems()"
          [showLiveIndicator]="false"
          emptyMessage="Sin partidas todavía."
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
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly recentMatches = signal<MatchUpdateView[]>([]);
  readonly error = signal<string | null>(null);
  readonly linking = signal(false);
  readonly linkError = signal<string | null>(null);
  readonly showPremiumBanner = signal(true);

  readonly showLinkPlatformForm = computed(() => {
    const p = this.profile();
    if (!p) return false;
    return !p.fortniteId || !p.robloxId;
  });

  readonly platformTone = computed(() => {
    const p = this.profile()?.primaryPlatform?.toLowerCase();
    if (p === 'fortnite') return 'cyan' as const;
    if (p === 'roblox') return 'purple' as const;
    return 'muted' as const;
  });

  readonly historyFeedItems = computed<LiveMatchFeedItem[]>(() =>
    this.recentMatches().map((m) => this.toFeedItem(m, false)),
  );

  readonly liveFeedItems = computed<LiveMatchFeedItem[]>(() =>
    this.realtime.liveMatches().map((m) => this.toFeedItem(m, true)),
  );

  readonly linkForm = this.fb.nonNullable.group({
    platform: ['roblox' as 'fortnite' | 'roblox', Validators.required],
    externalId: ['', [Validators.required, Validators.minLength(1)]],
  });

  ngOnInit(): void {
    void this.loadData();
    this.realtime.ensureConnected();
  }

  async refresh(event: CustomEvent): Promise<void> {
    await this.loadData();
    (event.target as HTMLIonRefresherElement).complete();
  }

  async logout(): Promise<void> {
    this.realtime.reset();
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  dismissPremium(): void {
    this.showPremiumBanner.set(false);
  }

  onPremiumCta(): void {
    // Placeholder de monetización — enrutar a checkout cuando exista.
    console.info('[Dashboard] Premium CTA clicked');
  }

  async submitLinkPlatform(): Promise<void> {
    if (this.linkForm.invalid) return;
    const userId = this.auth.userId();
    if (!userId) return;

    this.linking.set(true);
    this.linkError.set(null);

    try {
      const { platform, externalId } = this.linkForm.getRawValue();
      const updated = await firstValueFrom(
        this.playerService.linkPlatformAccount({
          userId,
          platform,
          externalId: externalId.trim(),
        }),
      );
      this.profile.set(updated);
      this.linkForm.reset({
        platform: updated.fortniteId ? 'roblox' : 'fortnite',
        externalId: '',
      });
    } catch (err) {
      this.linkError.set(err instanceof Error ? err.message : 'No se pudo vincular la cuenta');
    } finally {
      this.linking.set(false);
    }
  }

  private toFeedItem(m: MatchUpdateView, live: boolean): LiveMatchFeedItem {
    return {
      matchId: m.matchId,
      platform: m.platform,
      summary: m.summary,
      updatedAt: m.updatedAt,
      live,
      stats: this.parseStatsFromSummary(m.summary),
    };
  }

  private parseStatsFromSummary(_summary: string): LiveMatchFeedItem['stats'] {
    return {};
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
      this.linkForm.patchValue({
        platform: profile.fortniteId ? 'roblox' : 'fortnite',
      });

      this.matchService.listPlayerMatches(userId).subscribe({
        next: (rows) => {
          this.recentMatches.set(rows);
          this.realtime.seedFromHistory(rows);
        },
        error: (err) =>
          this.error.set(err instanceof Error ? err.message : 'Error cargando partidas'),
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error inesperado');
    }
  }
}
