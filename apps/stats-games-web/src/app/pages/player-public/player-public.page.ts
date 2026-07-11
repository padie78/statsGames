import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { MatchService, type MatchUpdateView } from '../../services/match.service';
import { PlayerService, type PublicPlayerProfileView } from '../../services/player.service';
import {
  LiveMatchFeedComponent,
  type LiveMatchFeedItem,
  NeonBadgeComponent,
  ShareLinkButtonComponent,
  StatValueComponent,
} from '../../ui';
import { toMatchCardStats } from '../../utils/match-stats.util';

@Component({
  standalone: true,
  selector: 'app-player-public-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    RouterLink,
    IonContent,
    NeonBadgeComponent,
    StatValueComponent,
    LiveMatchFeedComponent,
    ShareLinkButtonComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-6">
        <a routerLink="/" class="u-hint">← Volver al inicio</a>

        @if (loading()) {
          <p class="u-hint">Cargando perfil…</p>
        } @else if (notFound()) {
          <section class="u-surface-card u-p-5">
            <h1 class="u-font-display u-text-lg">Jugador no encontrado</h1>
            <p class="u-hint">No existe un perfil público para "{{ gamerTag() }}".</p>
          </section>
        } @else if (profile()) {
          <section class="sg-player-hero">
            <p class="u-text-xs u-text-muted u-mb-2">Perfil público</p>
            <h1 class="sg-player-hero__name">{{ profile()!.gamerTag }}</h1>
            <div class="sg-player-hero__meta u-mt-3">
              <sg-neon-badge [tone]="platformTone()">{{ profile()!.primaryPlatform }}</sg-neon-badge>
            </div>
            <div class="u-grid-stats u-mt-3">
              <sg-stat-value label="Partidas" [value]="matches().length" />
              <sg-stat-value label="Miembro desde" [value]="memberSince()" />
            </div>
            <div class="u-mt-3">
              <sg-share-link-button [gamerTag]="profile()!.gamerTag" />
            </div>
          </section>

          <sg-live-match-feed
            title="Partidas recientes"
            [items]="feedItems()"
            emptyMessage="Este jugador aún no tiene partidas públicas."
          />
        }
      </div>
    </ion-content>
  `,
})
export class PlayerPublicPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly playerService = inject(PlayerService);
  private readonly matchService = inject(MatchService);

  readonly gamerTag = signal('');
  readonly profile = signal<PublicPlayerProfileView | null>(null);
  readonly matches = signal<MatchUpdateView[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  readonly feedItems = computed<LiveMatchFeedItem[]>(() =>
    this.matches().map((m) => ({
      matchId: m.matchId,
      platform: m.platform,
      summary: m.summary,
      updatedAt: m.updatedAt,
      stats: toMatchCardStats(m.stats),
    })),
  );

  readonly platformTone = computed(() => {
    const p = this.profile()?.primaryPlatform?.toLowerCase();
    if (p === 'fortnite') return 'cyan' as const;
    if (p === 'roblox') return 'purple' as const;
    return 'muted' as const;
  });

  readonly memberSince = computed(() => {
    const iso = this.profile()?.createdAtIso;
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const tag = params.get('gamerTag') ?? '';
      this.gamerTag.set(tag);
      void this.loadProfile(tag);
    });
  }

  private async loadProfile(gamerTag: string): Promise<void> {
    if (!gamerTag) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.notFound.set(false);

    try {
      const profile = await this.playerService.getProfileByGamerTagOrNull(gamerTag);
      if (!profile) {
        this.notFound.set(true);
        this.profile.set(null);
        return;
      }

      this.profile.set(profile);
      const rows = await this.matchService.listPlayerMatchesOnce(profile.userId, { limit: 20 });
      this.matches.set(rows);
    } catch {
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
