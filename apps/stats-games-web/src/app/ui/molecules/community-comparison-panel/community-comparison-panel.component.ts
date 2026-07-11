import { Component, Input, ViewEncapsulation } from '@angular/core';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import {
  summarizeCommunityComparison,
  type CommunityComparisonItem,
  type CommunityPercentileTone,
} from '../../../utils/community-stats.util';

@Component({
  standalone: true,
  selector: 'sg-community-comparison-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-community-comparison u-surface-card u-p-5" [attr.aria-label]="title">
      <header class="sg-community-comparison__header">
        <div class="sg-community-comparison__headline">
          <div>
            <p class="sg-community-comparison__eyebrow">Percentiles</p>
            <h2 class="sg-community-comparison__title">{{ title }}</h2>
          </div>
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
        @if (summary; as overview) {
          <div
            class="sg-community-comparison__overview"
            [attr.data-tone]="overview.overallTone"
          >
            <div class="sg-community-comparison__overview-score">
              <span class="sg-community-comparison__overview-top">{{ overview.overallTopLabel }}</span>
              <span class="sg-community-comparison__overview-better">
                Mejor que el {{ overview.overallBetterThanPct }}%
              </span>
            </div>
            <p class="sg-community-comparison__overview-copy u-m-0">{{ overview.headline }}</p>
          </div>
        }

        <ul class="sg-community-comparison__list">
          @for (item of items; track item.id) {
            <li class="sg-community-comparison__row" [attr.data-tone]="item.tone">
              <div class="sg-community-comparison__row-top">
                <div class="sg-community-comparison__metric">
                  <span class="sg-community-comparison__label">{{ item.label }}</span>
                  <div class="sg-community-comparison__values">
                    <span class="sg-community-comparison__value">{{ item.playerValue }}</span>
                    <span class="sg-community-comparison__vs">vs</span>
                    <span class="sg-community-comparison__avg">prom. {{ item.communityAvg }}</span>
                  </div>
                </div>

                <div class="sg-community-comparison__badge-stack">
                  <span
                    class="sg-community-comparison__top"
                    [class.sg-community-comparison__top--up]="item.trend === 'up'"
                    [class.sg-community-comparison__top--down]="item.trend === 'down'"
                    [class.sg-community-comparison__top--flat]="item.trend === 'flat'"
                  >
                    {{ item.topPercentLabel }}
                  </span>
                  <span class="sg-community-comparison__better">{{ item.betterThanLabel }}</span>
                </div>
              </div>

              <div
                class="sg-community-comparison__track"
                role="img"
                [attr.aria-label]="item.betterThanLabel + '. ' + item.comparisonNote"
              >
                <span
                  class="sg-community-comparison__bar-fill"
                  [style.width.%]="item.betterThanPct"
                  [attr.data-tone]="item.tone"
                ></span>
                <span
                  class="sg-community-comparison__avg-marker"
                  [style.left.%]="item.avgMarkerPct"
                  title="Promedio comunidad"
                ></span>
                <span
                  class="sg-community-comparison__you-marker"
                  [style.left.%]="item.betterThanPct"
                  title="Tu posición"
                ></span>
              </div>

              <div class="sg-community-comparison__row-foot">
                <span class="sg-community-comparison__note">{{ item.comparisonNote }}</span>
                <span class="sg-community-comparison__tone-label">{{ toneLabel(item.tone) }}</span>
              </div>
            </li>
          }
        </ul>

        <div class="sg-community-comparison__legend" aria-hidden="true">
          <span><i class="sg-community-comparison__legend-you"></i> Vos</span>
          <span><i class="sg-community-comparison__legend-avg"></i> Promedio</span>
        </div>
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

  get summary() {
    return summarizeCommunityComparison(this.items);
  }

  toneLabel(tone: CommunityPercentileTone): string {
    switch (tone) {
      case 'elite':
        return 'Elite';
      case 'strong':
        return 'Fuerte';
      case 'average':
        return 'Promedio';
      default:
        return 'A mejorar';
    }
  }
}
