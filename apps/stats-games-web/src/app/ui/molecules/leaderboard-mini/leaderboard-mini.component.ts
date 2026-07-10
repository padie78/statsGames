import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

export interface LeaderboardEntry {
  rank: number;
  gamerTag: string;
  platform: 'fortnite' | 'roblox';
  score: number;
  delta: string;
  trend: 'up' | 'down' | 'flat';
}

@Component({
  standalone: true,
  selector: 'sg-leaderboard-mini',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
    <section class="sg-leaderboard-mini u-surface-card u-p-4">
      <header class="sg-panel-header">
        <h2 class="sg-panel-header__title">{{ title }}</h2>
        <sg-neon-badge tone="muted">Top 5</sg-neon-badge>
      </header>

      <ol class="sg-leaderboard-mini__list">
        @for (entry of entries; track entry.gamerTag) {
          <li>
            <a [routerLink]="['/player', entry.gamerTag]" class="sg-leaderboard-mini__row">
              <span class="sg-leaderboard-mini__rank" [class.sg-leaderboard-mini__rank--top]="entry.rank <= 3">
                #{{ entry.rank }}
              </span>
              <span class="sg-leaderboard-mini__name u-truncate">{{ entry.gamerTag }}</span>
              <img
                class="sg-leaderboard-mini__platform"
                [src]="platformIcon(entry.platform)"
                [alt]="entry.platform"
              />
              <sg-neon-badge [tone]="entry.platform === 'fortnite' ? 'cyan' : 'purple'">
                {{ entry.platform === 'fortnite' ? 'FN' : 'RBX' }}
              </sg-neon-badge>
              <span class="sg-leaderboard-mini__score">{{ entry.score }}</span>
              <span
                class="sg-leaderboard-mini__delta"
                [class.sg-leaderboard-mini__delta--up]="entry.trend === 'up'"
                [class.sg-leaderboard-mini__delta--down]="entry.trend === 'down'"
              >
                {{ entry.delta }}
              </span>
            </a>
          </li>
        }
      </ol>
    </section>
  `,
})
export class LeaderboardMiniComponent {
  @Input() title = 'Leaderboard';
  @Input({ required: true }) entries: LeaderboardEntry[] = [];

  platformIcon(platform: 'fortnite' | 'roblox'): string {
    return gamePlatformMeta(platform).iconUrl;
  }
}
