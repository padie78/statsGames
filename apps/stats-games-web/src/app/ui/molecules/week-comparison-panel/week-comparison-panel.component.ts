import { Component, Input, ViewEncapsulation } from '@angular/core';
import type { WeekComparisonItem } from '../../../utils/match-stats.util';

@Component({
  standalone: true,
  selector: 'sg-week-comparison-panel',
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="sg-week-comparison u-surface-card u-p-5" [attr.aria-label]="title">
      <header class="sg-week-comparison__header">
        <p class="sg-week-comparison__eyebrow">Progreso temporal</p>
        <h2 class="sg-week-comparison__title">{{ title }}</h2>
        <p class="sg-week-comparison__subtitle">{{ subtitle }}</p>
      </header>

      @if (!items.length) {
        <p class="sg-week-comparison__empty u-hint u-m-0">
          Jugá más partidas para comparar con la semana pasada.
        </p>
      } @else {
        <ul class="sg-week-comparison__list">
          @for (item of items; track item.label) {
            <li class="sg-week-comparison__row">
              <div class="sg-week-comparison__metric">
                <span class="sg-week-comparison__label">{{ item.label }}</span>
                <span class="sg-week-comparison__value">{{ item.value }}</span>
              </div>
              <span
                class="sg-week-comparison__note"
                [class.sg-week-comparison__note--up]="item.trend === 'up'"
                [class.sg-week-comparison__note--down]="item.trend === 'down'"
              >
                {{ item.note }}
              </span>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class WeekComparisonPanelComponent {
  @Input() title = 'Vs semana pasada';
  @Input() subtitle = 'Diferencia vs los 7 días anteriores.';
  @Input() items: WeekComparisonItem[] = [];
}
