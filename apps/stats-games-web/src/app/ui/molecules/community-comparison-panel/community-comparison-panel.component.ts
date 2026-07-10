import { Component, Input, ViewEncapsulation } from '@angular/core';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import type { CommunityComparisonItem } from '../../../utils/community-stats.util';

@Component({
  standalone: true,
  selector: 'sg-community-comparison-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-community-comparison u-surface-card u-p-5" [attr.aria-label]="title">
      <header class="sg-community-comparison__header">
        <div class="sg-community-comparison__headline">
          <h2 class="sg-community-comparison__title">{{ title }}</h2>
          @if (sampleLabel) {
            <sg-neon-badge tone="cyan">{{ sampleLabel }}</sg-neon-badge>
          }
        </div>
        <p class="sg-community-comparison__subtitle">{{ subtitle }}</p>
      </header>

      @if (!items.length) {
        <p class="sg-community-comparison__empty u-hint u-m-0">
          Jugá partidas esta semana para ver cómo te comparás con la comunidad.
        </p>
      } @else {
        <ul class="sg-community-comparison__list">
          @for (item of items; track item.label) {
            <li class="sg-community-comparison__row">
              <div class="sg-community-comparison__metric">
                <span class="sg-community-comparison__label">{{ item.label }}</span>
                <div class="sg-community-comparison__values">
                  <span class="sg-community-comparison__value">{{ item.playerValue }}</span>
                  <span class="sg-community-comparison__avg">Prom. {{ item.communityAvg }}</span>
                </div>
              </div>

              <div class="sg-community-comparison__rank">
                <span
                  class="sg-community-comparison__top"
                  [class.sg-community-comparison__top--up]="item.trend === 'up'"
                  [class.sg-community-comparison__top--down]="item.trend === 'down'"
                >
                  {{ item.topPercentLabel }}
                </span>
                <div class="sg-community-comparison__bar" aria-hidden="true">
                  <span
                    class="sg-community-comparison__bar-fill"
                    [style.width.%]="item.betterThanPct"
                    [class.sg-community-comparison__bar-fill--up]="item.trend === 'up'"
                    [class.sg-community-comparison__bar-fill--down]="item.trend === 'down'"
                  ></span>
                </div>
                <span class="sg-community-comparison__note">{{ item.comparisonNote }}</span>
              </div>
            </li>
          }
        </ul>
      }

      <p class="sg-community-comparison__disclaimer u-m-0">{{ disclaimer }}</p>
    </section>
  `,
})
export class CommunityComparisonPanelComponent {
  @Input() title = 'Vs comunidad';
  @Input() subtitle = 'Tu rendimiento en percentiles comunitarios.';
  @Input() sampleLabel = '';
  @Input() items: CommunityComparisonItem[] = [];
  @Input() disclaimer =
    'Datos de comunidad en preview (mock). Los percentiles reales llegarán con el backend agregado.';
}
