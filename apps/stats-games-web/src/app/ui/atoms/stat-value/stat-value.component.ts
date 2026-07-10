import { Component, Input, ViewEncapsulation } from '@angular/core';

export type StatAccent = 'default' | 'lime' | 'purple' | 'pink' | 'cyan';

/**
 * Átomo — valor de KPI compacto (KDA, Win%, Rank).
 */
@Component({
  standalone: true,
  selector: 'sg-stat-value',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="sg-stat">
      <span class="sg-stat__label">{{ label }}</span>
      <span class="sg-stat__value" [class]="valueClass">{{ value }}</span>
      @if (delta) {
        <span
          class="sg-stat__delta"
          [class.sg-stat__delta--up]="deltaTrend === 'up'"
          [class.sg-stat__delta--down]="deltaTrend === 'down'"
        >
          {{ delta }}
        </span>
      }
    </div>
  `,
})
export class StatValueComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  @Input() accent: StatAccent = 'default';
  @Input() delta?: string;
  @Input() deltaTrend: 'up' | 'down' | 'flat' = 'flat';

  get valueClass(): string {
    return this.accent === 'default' ? '' : `sg-stat__value--${this.accent}`;
  }
}
