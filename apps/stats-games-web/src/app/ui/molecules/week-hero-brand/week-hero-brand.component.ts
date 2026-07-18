import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/game/selected-game';

/** Logo del juego arriba a la derecha del panel gráfico (estilo Tracker). */
@Component({
  standalone: true,
  selector: 'sg-week-hero-brand',
  encapsulation: ViewEncapsulation.None,
  template: `
    <img
      class="sg-dashboard__week-mark"
      [src]="markSrc()"
      [alt]="meta().label"
      width="96"
      height="96"
      decoding="async"
    />
  `,
})
export class WeekHeroBrandComponent {
  readonly platform = input.required<SelectedGame>();
  readonly meta = computed(() => gamePlatformMeta(this.platform()));
  readonly markSrc = computed(() => this.meta().markUrl ?? this.meta().iconUrl);
}
