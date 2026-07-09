import { Component, Input, ViewEncapsulation } from '@angular/core';
import {
  gamePlatformMeta,
  type GamePlatformMeta,
} from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

@Component({
  standalone: true,
  selector: 'sg-platform-page-banner',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <header
      class="sg-platform-banner"
      [class.sg-platform-banner--roblox]="platform === 'roblox'"
      [class.sg-platform-banner--fortnite]="platform === 'fortnite'"
    >
      <div
        class="sg-platform-banner__art"
        [style.background-image]="'url(' + meta.artUrl + ')'"
        aria-hidden="true"
      ></div>
      <div class="sg-platform-banner__glow" aria-hidden="true"></div>

      <div class="sg-platform-banner__content">
        <div class="sg-platform-banner__brand">
          <span
            class="sg-platform-banner__icon"
            [style.background-image]="'url(' + meta.iconUrl + ')'"
            aria-hidden="true"
          ></span>
          <sg-neon-badge [tone]="badgeTone">{{ meta.badge }}</sg-neon-badge>
        </div>
        <h1 class="sg-platform-banner__title">{{ title }}</h1>
        <p class="sg-platform-banner__subtitle">{{ subtitle || meta.tagline }}</p>
        <span class="sg-platform-banner__hint">{{ meta.statsHint }}</span>
      </div>
    </header>
  `,
})
export class PlatformPageBannerComponent {
  @Input({ required: true }) platform!: SelectedGame;
  @Input({ required: true }) title!: string;
  @Input() subtitle = '';

  get meta(): GamePlatformMeta {
    return gamePlatformMeta(this.platform);
  }

  get badgeTone(): 'cyan' | 'purple' | 'lime' {
    return this.platform === 'fortnite' ? 'cyan' : 'lime';
  }
}
