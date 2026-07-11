import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import { AnimatedValueComponent } from '../../atoms/animated-value/animated-value.component';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { AmbientPanelComponent } from '../../molecules/ambient-panel/ambient-panel.component';
import { ShareLinkButtonComponent } from '../../molecules/share-link-button/share-link-button.component';

@Component({
  standalone: true,
  selector: 'sg-dashboard-hero',
  encapsulation: ViewEncapsulation.None,
  imports: [
    RouterLink,
    NeonBadgeComponent,
    ShareLinkButtonComponent,
    AmbientPanelComponent,
    AnimatedValueComponent,
  ],
  template: `
    <section
      class="sg-dashboard-hero sg-dashboard-hero--cinematic"
      [class.sg-dashboard-hero--roblox]="platform === 'roblox'"
      [class.sg-dashboard-hero--fortnite]="platform === 'fortnite'"
      [class.sg-dashboard-hero--animating]="animating"
    >
      @for (_platform of [platform]; track _platform) {
        <sg-ambient-panel
          [platform]="_platform"
          variant="hero"
          [artUrl]="artUrl"
          [videoUrl]="ambientVideoUrl"
          [posterUrl]="artUrl"
        />
      }

      <div class="sg-dashboard-hero__stage">
        <div class="sg-dashboard-hero__identity">
          <div
            class="sg-dashboard-hero__avatar"
            [class.sg-dashboard-hero__avatar--photo]="!!avatarUrl"
          >
            @if (avatarUrl) {
              <img
                class="sg-dashboard-hero__avatar-photo"
                [src]="avatarUrl"
                [alt]="'Avatar de ' + gamerTag"
                width="150"
                height="150"
                loading="lazy"
              />
            } @else {
              @if (platformIconUrl) {
                <img
                  class="sg-dashboard-hero__avatar-icon"
                  [src]="platformIconUrl"
                  [alt]=""
                  aria-hidden="true"
                />
              }
              <span class="sg-dashboard-hero__avatar-text">{{ initials }}</span>
            }
          </div>

          <div class="sg-dashboard-hero__info u-min-w-0">
            <p class="sg-dashboard-hero__eyebrow">{{ platformLabel }} · stats</p>
            <p class="sg-dashboard-hero__name">{{ gamerTag }}</p>
            <p class="sg-dashboard-hero__tagline">{{ platformTagline }}</p>
            <div class="sg-dashboard-hero__badges">
              <sg-neon-badge [tone]="platformTone">{{ platform }}</sg-neon-badge>
              @if (live) {
                <sg-neon-badge tone="cyan" [pulse]="true">En vivo</sg-neon-badge>
              }
              @if (playerLevel > 1) {
                <sg-neon-badge tone="lime">Nivel {{ playerLevel }}</sg-neon-badge>
              }
              @if (fortniteId) {
                <sg-neon-badge tone="cyan">FN {{ fortniteId }}</sg-neon-badge>
              }
              @if (robloxId) {
                <sg-neon-badge tone="purple">RBX {{ robloxId }}</sg-neon-badge>
              }
            </div>
          </div>
        </div>

          <div class="sg-dashboard-hero__cta-block">
            <a
              [routerLink]="primaryCtaRoute"
              class="sg-dashboard-hero__cta u-btn u-btn--primary"
              (click)="connectClick.emit()"
            >
              {{ primaryCtaLabel }}
            </a>
            <div class="sg-dashboard-hero__cta-secondary">
              <a [routerLink]="secondaryCtaRoute" class="sg-dashboard-hero__link">{{ secondaryCtaLabel }}</a>
              @if (gamerTag) {
                <sg-share-link-button [gamerTag]="gamerTag" />
              }
            </div>
          </div>
      </div>

      <div class="sg-dashboard-hero__footer sg-dashboard-hero__footer--animated">
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">Victorias</span>
          <sg-animated-value
            class="sg-dashboard-hero__stat-value sg-dashboard-hero__stat-value--animated"
            [value]="winsWeek"
          />
        </div>
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">Win rate</span>
          <sg-animated-value
            class="sg-dashboard-hero__stat-value sg-dashboard-hero__stat-value--animated"
            [value]="winRate"
          />
        </div>
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">Mejor lugar</span>
          <sg-animated-value
            class="sg-dashboard-hero__stat-value sg-dashboard-hero__stat-value--animated"
            [value]="bestPlacementLabel"
          />
        </div>
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">K/D</span>
          <sg-animated-value
            class="sg-dashboard-hero__stat-value sg-dashboard-hero__stat-value--animated"
            [value]="kd"
          />
        </div>
      </div>
    </section>
  `,
})
export class DashboardHeroComponent implements OnChanges {
  @Input({ required: true }) gamerTag!: string;
  @Input() platform: 'fortnite' | 'roblox' = 'fortnite';
  @Input() artUrl = '';
  /** Avatar del jugador (API Roblox / perfil) — ≤150px, player-owned */
  @Input() avatarUrl: string | null = null;
  @Input() fortniteId?: string | null;
  @Input() robloxId?: string | null;
  @Input() live = false;
  @Input() playerLevel = 1;
  @Input() winsWeek = 0;
  @Input() winRate = '—';
  @Input() kd = '—';
  @Input() bestPlacement: number | null = null;
  @Input() primaryCtaLabel = 'Conectar cuenta';
  @Input() primaryCtaRoute = '/tabs/integrations';
  @Input() secondaryCtaLabel = 'Stats avanzadas';
  @Input() secondaryCtaRoute = '/tabs/analytics';

  @Output() readonly connectClick = new EventEmitter<void>();

  animating = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['platform'] || changes['artUrl'] || changes['avatarUrl']) {
      this.animating = true;
      window.setTimeout(() => {
        this.animating = false;
      }, 480);
    }
  }

  get platformIconUrl(): string {
    return gamePlatformMeta(this.platform as SelectedGame).iconUrl;
  }

  get ambientVideoUrl(): string {
    return gamePlatformMeta(this.platform as SelectedGame).ambientVideoUrl ?? '';
  }

  get platformLabel(): string {
    return gamePlatformMeta(this.platform as SelectedGame).label;
  }

  get platformTagline(): string {
    return gamePlatformMeta(this.platform as SelectedGame).tagline;
  }

  get bestPlacementLabel(): string {
    return this.bestPlacement != null && this.bestPlacement > 0 ? `#${this.bestPlacement}` : '—';
  }

  get initials(): string {
    return this.gamerTag.slice(0, 2).toUpperCase();
  }

  get platformTone(): 'cyan' | 'purple' | 'muted' {
    if (this.platform === 'fortnite') return 'cyan';
    if (this.platform === 'roblox') return 'purple';
    return 'muted';
  }
}
