import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { ShareLinkButtonComponent } from '../../molecules/share-link-button/share-link-button.component';

@Component({
  standalone: true,
  selector: 'sg-dashboard-hero',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent, ShareLinkButtonComponent],
  template: `
    <section
      class="sg-dashboard-hero"
      [class.sg-dashboard-hero--roblox]="platform === 'roblox'"
      [class.sg-dashboard-hero--fortnite]="platform === 'fortnite'"
      [class.sg-dashboard-hero--animating]="animating"
    >
      @if (artUrl) {
        <img
          class="sg-dashboard-hero__art"
          [src]="artUrl"
          [alt]="platform + ' artwork'"
          aria-hidden="true"
        />
      }
      <div class="sg-dashboard-hero__glow" [class]="'sg-dashboard-hero__glow--' + platform"></div>

      <div class="sg-dashboard-hero__main">
        <div class="sg-dashboard-hero__avatar">
          @if (platformIconUrl) {
            <img
              class="sg-dashboard-hero__avatar-icon"
              [src]="platformIconUrl"
              [alt]="platform"
              aria-hidden="true"
            />
          }
          <span class="sg-dashboard-hero__avatar-text">{{ initials }}</span>
        </div>

        <div class="sg-dashboard-hero__info u-min-w-0">
          <p class="sg-dashboard-hero__eyebrow">Tu resumen</p>
          <h1 class="sg-dashboard-hero__name">{{ gamerTag }}</h1>
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

        <div class="sg-dashboard-hero__actions">
          @if (gamerTag) {
            <sg-share-link-button [gamerTag]="gamerTag" />
          }
          <a routerLink="/tabs/analytics" class="u-btn u-btn--ghost">Stats avanzadas</a>
          <a routerLink="/tabs/integrations" class="u-btn u-btn--primary">Conectar</a>
        </div>
      </div>

      <div class="sg-dashboard-hero__footer">
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">Victorias</span>
          <span class="sg-dashboard-hero__stat-value">{{ winsWeek }}</span>
        </div>
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">Win rate</span>
          <span class="sg-dashboard-hero__stat-value">{{ winRate }}</span>
        </div>
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">Mejor lugar</span>
          <span class="sg-dashboard-hero__stat-value">#{{ bestPlacement }}</span>
        </div>
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">K/D</span>
          <span class="sg-dashboard-hero__stat-value">{{ kd }}</span>
        </div>
      </div>
    </section>
  `,
})
export class DashboardHeroComponent implements OnChanges {
  @Input({ required: true }) gamerTag!: string;
  @Input() platform: 'fortnite' | 'roblox' = 'fortnite';
  @Input() artUrl = '';
  @Input() fortniteId?: string | null;
  @Input() robloxId?: string | null;
  @Input() live = false;
  @Input() playerLevel = 1;
  @Input() winsWeek = 0;
  @Input() winRate = '—';
  @Input() kd = '—';
  @Input() bestPlacement = 99;

  @Output() readonly connectClick = new EventEmitter<void>();

  animating = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['platform'] || changes['artUrl']) {
      this.animating = true;
      window.setTimeout(() => {
        this.animating = false;
      }, 480);
    }
  }

  get platformIconUrl(): string {
    return gamePlatformMeta(this.platform as SelectedGame).iconUrl;
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
