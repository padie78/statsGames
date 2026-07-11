import { Component, Input, ViewEncapsulation } from '@angular/core';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import {
  isRobloxExperienceGame,
  selectedGameFromBackend,
  type SelectedGame,
} from '../../../core/game/selected-game';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

export interface WeeklyOverviewMetric {
  label: string;
  value: string | number;
  percent: number;
  tone: 'lime' | 'purple' | 'pink' | 'cyan';
}

@Component({
  standalone: true,
  selector: 'sg-weekly-overview-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-weekly-overview u-surface-card u-p-5">
      <header class="sg-panel-header">
        <div>
          <h2 class="sg-panel-header__title">Resumen semanal</h2>
          <p class="sg-weekly-overview__period">{{ periodLabel }}</p>
        </div>
        <sg-neon-badge [tone]="badgeTone">
          {{ platformLabel }}
        </sg-neon-badge>
      </header>

      <div class="sg-weekly-overview__hero-stat">
        <span class="sg-weekly-overview__hero-value">{{ headlineValue }}</span>
        <span class="sg-weekly-overview__hero-label">{{ headlineLabel }}</span>
      </div>

      <div class="sg-weekly-overview__metrics">
        @for (metric of metrics; track metric.label) {
          <div class="sg-weekly-overview__metric">
            <div class="sg-weekly-overview__metric-head">
              <span>{{ metric.label }}</span>
              <span class="sg-weekly-overview__metric-value">{{ metric.value }}</span>
            </div>
            <div class="sg-weekly-overview__bar-track">
              <div
                class="sg-weekly-overview__bar-fill"
                [class]="'sg-weekly-overview__bar-fill--' + metric.tone"
                [style.width.%]="metric.percent"
              ></div>
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class WeeklyOverviewPanelComponent {
  @Input() platform: SelectedGame = 'fortnite';
  @Input() periodLabel = 'Esta semana';
  @Input() headlineValue: string | number = '—';
  @Input() headlineLabel = 'Partidas jugadas';
  @Input() metrics: WeeklyOverviewMetric[] = [];

  get platformLabel(): string {
    return gamePlatformMeta(selectedGameFromBackend(this.platform)).label;
  }

  get badgeTone(): 'lime' | 'purple' | 'cyan' {
    const g = selectedGameFromBackend(this.platform);
    if (isRobloxExperienceGame(g)) return 'lime';
    if (g === 'valorant') return 'purple';
    return 'cyan';
  }
}
