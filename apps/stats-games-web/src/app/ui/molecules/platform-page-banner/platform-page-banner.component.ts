import { Component, Input, OnChanges, SimpleChanges, ViewEncapsulation } from '@angular/core';
import {
  gamePlatformMeta,
  type GamePlatformMeta,
} from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { AmbientPanelComponent } from '../ambient-panel/ambient-panel.component';

@Component({
  standalone: true,
  selector: 'sg-platform-page-banner',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent, AmbientPanelComponent],
  template: `
    <header
      class="sg-platform-banner"
      [class.sg-platform-banner--roblox]="platform === 'roblox'"
      [class.sg-platform-banner--fortnite]="platform === 'fortnite'"
      [class.sg-platform-banner--animating]="animating"
    >
      <sg-ambient-panel
        [platform]="platform"
        variant="banner"
        [artUrl]="meta.artUrl"
        [videoUrl]="meta.ambientVideoUrl ?? ''"
        [posterUrl]="meta.artUrl"
      />

      <div class="sg-platform-banner__content">
        <div class="sg-platform-banner__brand">
          @if (meta.iconUrl) {
            <img
              class="sg-platform-banner__icon"
              [src]="meta.iconUrl"
              [alt]="platform"
              aria-hidden="true"
            />
          }
          <sg-neon-badge [tone]="badgeTone">{{ meta.badge }}</sg-neon-badge>
        </div>
        <h1 class="sg-platform-banner__title">{{ title }}</h1>
        <p class="sg-platform-banner__subtitle">{{ subtitle || meta.tagline }}</p>
        <span class="sg-platform-banner__hint">{{ meta.statsHint }}</span>
      </div>
    </header>
  `,
})
export class PlatformPageBannerComponent implements OnChanges {
  @Input({ required: true }) platform!: SelectedGame;
  @Input({ required: true }) title!: string;
  @Input() subtitle = '';

  animating = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['platform'] && !changes['platform'].firstChange) {
      this.animating = true;
      window.setTimeout(() => {
        this.animating = false;
      }, 480);
    }
  }

  get meta(): GamePlatformMeta {
    return gamePlatformMeta(this.platform);
  }

  get badgeTone(): 'cyan' | 'purple' | 'lime' {
    return this.platform === 'fortnite' ? 'cyan' : 'lime';
  }
}
