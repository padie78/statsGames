import { Component, Input, ViewEncapsulation } from '@angular/core';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

export interface TrendingItem {
  id: string;
  label: string;
  meta: string;
  tone: 'lime' | 'purple' | 'cyan' | 'pink';
}

@Component({
  standalone: true,
  selector: 'sg-trending-rail',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-trending-rail u-surface-card u-p-5">
      <header class="sg-panel-header">
        <h2 class="sg-panel-header__title">{{ title }}</h2>
        <sg-neon-badge tone="cyan">TRENDING</sg-neon-badge>
      </header>

      <ul class="sg-trending-rail__list">
        @for (item of items; track item.id) {
          <li class="sg-trending-rail__item">
            <span class="sg-trending-rail__dot sg-trending-rail__dot--{{ item.tone }}"></span>
            <div class="u-min-w-0">
              <p class="sg-trending-rail__label">{{ item.label }}</p>
              <p class="sg-trending-rail__meta">{{ item.meta }}</p>
            </div>
          </li>
        }
      </ul>
    </section>
  `,
})
export class TrendingRailComponent {
  @Input() title = 'En tendencia';
  @Input({ required: true }) items: TrendingItem[] = [];
}
