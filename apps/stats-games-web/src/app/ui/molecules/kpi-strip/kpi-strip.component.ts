import { Component, Input, OnChanges, SimpleChanges, ViewEncapsulation } from '@angular/core';
import {
  gamePlatformMeta,
  type GamePlatformMeta,
} from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import { StatValueComponent, type StatAccent } from '../../atoms/stat-value/stat-value.component';

export type KpiMetricIcon = 'matches' | 'kd' | 'kills' | 'deaths' | 'placement' | 'live';

export interface KpiStripItem {
  label: string;
  value: string | number;
  accent?: StatAccent;
  delta?: string;
  deltaTrend?: 'up' | 'down' | 'flat';
  icon?: KpiMetricIcon;
}

@Component({
  standalone: true,
  selector: 'sg-kpi-strip',
  encapsulation: ViewEncapsulation.None,
  imports: [StatValueComponent],
  template: `
    <section
      class="sg-kpi-strip"
      [class.sg-kpi-strip--roblox]="platform === 'roblox'"
      [class.sg-kpi-strip--fortnite]="platform === 'fortnite'"
      [class.sg-kpi-strip--animating]="animating"
      [attr.aria-label]="title"
    >
      @if (title || platform) {
        <header class="sg-kpi-strip__header">
          @if (title) {
            <h2 class="sg-kpi-strip__title">{{ title }}</h2>
          }
          @if (platform) {
            <div class="sg-kpi-strip__platform">
              <img
                class="sg-kpi-strip__platform-icon"
                [src]="platformMeta.iconUrl"
                [alt]="platformMeta.label"
                aria-hidden="true"
              />
              <span class="sg-kpi-strip__platform-label">{{ platformMeta.label }}</span>
            </div>
          }
        </header>
      }

      <div class="sg-kpi-strip__grid">
        @for (kpi of items; track kpi.label) {
          <div class="sg-kpi-strip__cell u-p-4" [class.u-surface-card]="!embedded" [class.sg-kpi-strip__cell--embedded]="embedded">
            @if (kpi.icon) {
              <span
                class="sg-kpi-strip__metric-icon"
                [class]="'sg-kpi-strip__metric-icon--' + kpi.icon"
                aria-hidden="true"
              ></span>
            }
            <sg-stat-value
              [label]="kpi.label"
              [value]="kpi.value"
              [accent]="kpi.accent ?? 'default'"
              [delta]="kpi.delta"
              [deltaTrend]="kpi.deltaTrend ?? 'flat'"
            />
          </div>
        }
      </div>
    </section>
  `,
})
export class KpiStripComponent implements OnChanges {
  @Input() title = '';
  @Input() platform?: SelectedGame | null;
  @Input({ required: true }) items: KpiStripItem[] = [];
  @Input() embedded = false;

  animating = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['platform'] && !changes['platform'].firstChange) {
      this.animating = true;
      window.setTimeout(() => {
        this.animating = false;
      }, 480);
    }
  }

  get platformMeta(): GamePlatformMeta {
    return gamePlatformMeta(this.platform ?? 'fortnite');
  }
}
