import { Component, Input, ViewEncapsulation } from '@angular/core';

export interface AchievementItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: 'lime' | 'purple' | 'pink' | 'cyan';
}

@Component({
  standalone: true,
  selector: 'sg-achievement-strip',
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="sg-achievement-strip u-surface-card u-p-4">
      <header class="sg-panel-header">
        <h2 class="sg-panel-header__title">{{ title }}</h2>
      </header>

      <div class="sg-achievement-strip__grid">
        @for (item of items; track item.id) {
          <article class="sg-achievement-strip__card sg-achievement-strip__card--{{ item.tone }}">
            <span class="sg-achievement-strip__icon" aria-hidden="true">{{ item.icon }}</span>
            <div>
              <h3 class="sg-achievement-strip__title">{{ item.title }}</h3>
              <p class="sg-achievement-strip__subtitle">{{ item.subtitle }}</p>
            </div>
          </article>
        }
      </div>
    </section>
  `,
})
export class AchievementStripComponent {
  @Input() title = 'Highlights';
  @Input({ required: true }) items: AchievementItem[] = [];
}
