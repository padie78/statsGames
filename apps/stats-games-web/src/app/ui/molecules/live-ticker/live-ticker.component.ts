import { Component, Input, ViewEncapsulation } from '@angular/core';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

export interface LiveTickerItem {
  id: string;
  text: string;
  tone: 'lime' | 'purple' | 'cyan';
}

@Component({
  standalone: true,
  selector: 'sg-live-ticker',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <div class="sg-live-ticker" aria-live="polite">
      <sg-neon-badge tone="lime" [pulse]="live">LIVE</sg-neon-badge>
      <div class="sg-live-ticker__track">
        @for (item of items; track item.id) {
          <span class="sg-live-ticker__item sg-live-ticker__item--{{ item.tone }}">
            {{ item.text }}
          </span>
        }
      </div>
    </div>
  `,
})
export class LiveTickerComponent {
  @Input() items: LiveTickerItem[] = [];
  @Input() live = true;
}
