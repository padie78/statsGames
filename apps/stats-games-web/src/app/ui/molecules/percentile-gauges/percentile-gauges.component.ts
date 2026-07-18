import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import type { PercentileGaugeItem } from '../../../core/charts/echart-theme.util';
import type { CommunityComparisonItem } from '../../../utils/community-stats.util';

@Component({
  standalone: true,
  selector: 'sg-percentile-gauges',
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="sg-percentile-gauges u-surface-card u-p-5" aria-label="Percentiles de un vistazo">
      <header class="sg-percentile-gauges__header">
        <div>
          <p class="sg-percentile-gauges__eyebrow">Vs comunidad</p>
          <h3 class="sg-percentile-gauges__title">{{ title }}</h3>
          @if (subtitle) {
            <p class="sg-percentile-gauges__subtitle u-m-0">{{ subtitle }}</p>
          }
        </div>
        @if (gaugeItems.length) {
          <div class="sg-percentile-gauges__overall" [attr.data-tone]="overallTone">
            <span class="sg-percentile-gauges__overall-value">{{ overallPct }}%</span>
            <span class="sg-percentile-gauges__overall-label">promedio</span>
          </div>
        }
      </header>

      @if (!gaugeItems.length) {
        <p class="sg-percentile-gauges__empty u-m-0">
          Sin percentiles para graficar. Jugá partidas esta semana para comparar vs la comunidad.
        </p>
      } @else {
        <ul class="sg-percentile-gauges__rings" aria-label="Percentiles">
          @for (item of gaugeItems; track item.name) {
            <li class="sg-percentile-gauges__ring" [attr.data-tone]="item.tone ?? 'strong'">
              <div
                class="sg-percentile-gauges__dial"
                [style.--pct]="item.value"
                role="meter"
                [attr.aria-valuenow]="item.value"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-label]="item.name + ': mejor que el ' + item.value + '%'"
              >
                <span class="sg-percentile-gauges__dial-value">{{ item.value }}%</span>
              </div>
              <div class="sg-percentile-gauges__ring-copy">
                <span class="sg-percentile-gauges__ring-name">{{ item.name }}</span>
                <span class="sg-percentile-gauges__ring-hint">Mejor que el {{ item.value }}%</span>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class PercentileGaugesComponent implements OnInit, OnChanges {
  @Input() title = 'Percentiles de un vistazo';
  @Input() subtitle = 'Cuánto de la comunidad superás en cada KPI.';
  @Input() items: CommunityComparisonItem[] = [];

  gaugeItems: PercentileGaugeItem[] = [];
  overallPct = 0;
  overallTone: PercentileGaugeItem['tone'] = 'strong';

  ngOnInit(): void {
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) this.refresh();
  }

  private refresh(): void {
    this.gaugeItems = (this.items ?? [])
      .filter((item) => Number.isFinite(item.betterThanPct))
      .slice(0, 4)
      .map((item) => ({
        name: item.label.replace(' / semana', ''),
        value: Math.max(0, Math.min(100, Math.round(item.betterThanPct))),
        tone: item.tone,
      }));

    if (!this.gaugeItems.length) {
      this.overallPct = 0;
      this.overallTone = 'strong';
      return;
    }

    this.overallPct = Math.round(
      this.gaugeItems.reduce((sum, item) => sum + item.value, 0) / this.gaugeItems.length,
    );
    if (this.overallPct >= 85) this.overallTone = 'elite';
    else if (this.overallPct >= 60) this.overallTone = 'strong';
    else if (this.overallPct >= 40) this.overallTone = 'average';
    else this.overallTone = 'weak';
  }
}
