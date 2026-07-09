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
      [class]="'sg-dashboard-hero--' + platform"
      [class.sg-dashboard-hero--animating]="animating"
    >
      <div
        class="sg-dashboard-hero__art"
        [style.background-image]="artUrl ? 'url(' + artUrl + ')' : null"
        aria-hidden="true"
      ></div>
      <div class="sg-dashboard-hero__glow" [class]="'sg-dashboard-hero__glow--' + platform"></div>

      <div class="sg-dashboard-hero__main">
        <div class="sg-dashboard-hero__avatar">
          <span
            class="sg-dashboard-hero__avatar-icon"
            [style.background-image]="'url(' + platformIconUrl + ')'"
            aria-hidden="true"
          ></span>
          <span class="sg-dashboard-hero__avatar-text">{{ initials }}</span>
        </div>

        <div class="sg-dashboard-hero__info u-min-w-0">
          <p class="sg-dashboard-hero__eyebrow">Player Command Center</p>
          <h1 class="sg-dashboard-hero__name">{{ gamerTag }}</h1>
          <div class="sg-dashboard-hero__badges">
            <sg-neon-badge [tone]="platformTone">{{ platform }}</sg-neon-badge>
            @if (live) {
              <sg-neon-badge tone="lime" [pulse]="true">STREAM ON</sg-neon-badge>
            }
            <sg-neon-badge tone="cyan">S{{ season }}</sg-neon-badge>
            <sg-neon-badge tone="purple">{{ rankTier }}</sg-neon-badge>
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
          <a routerLink="/tabs/analytics" class="u-btn u-btn--ghost">Ver stats</a>
          <a routerLink="/tabs/integrations" class="u-btn u-btn--lime">Conectar</a>
        </div>
      </div>

      <div class="sg-dashboard-hero__footer">
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">Level</span>
          <span class="sg-dashboard-hero__stat-value">{{ playerLevel }}</span>
        </div>
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">Percentile</span>
          <span class="sg-dashboard-hero__stat-value u-text-lime">{{ percentile }}</span>
        </div>
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">Matches (7d)</span>
          <span class="sg-dashboard-hero__stat-value">{{ matches7d }}</span>
        </div>
        <div class="sg-dashboard-hero__stat-pill">
          <span class="sg-dashboard-hero__stat-label">Best place</span>
          <span class="sg-dashboard-hero__stat-value u-text-purple">#{{ bestPlacement }}</span>
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
  @Input() season = 37;
  @Input() rankTier = 'Diamond II';
  @Input() playerLevel = 42;
  @Input() percentile = 'Top 18%';
  @Input() matches7d = 0;
  @Input() bestPlacement = 4;

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
