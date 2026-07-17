import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

@Component({
  standalone: true,
  selector: 'sg-ai-insight-card',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-ai-insight u-surface-card u-surface-card--ai u-p-5">
      <header class="sg-panel-header">
        <h2 class="sg-panel-header__title">AI Coach</h2>
        <sg-neon-badge tone="purple">AI</sg-neon-badge>
      </header>

      <p class="sg-ai-insight__headline">{{ headline }}</p>
      <p class="sg-ai-insight__body">{{ body }}</p>

      @if (strengths.length || improvements.length) {
        <div class="sg-ai-insight__lists">
          @if (strengths.length) {
            <div class="sg-ai-insight__list-block">
              <p class="sg-ai-insight__list-title sg-ai-insight__list-title--pro">Lo que mejoraste</p>
              <ul class="sg-ai-insight__list">
                @for (item of strengths; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            </div>
          }
          @if (improvements.length) {
            <div class="sg-ai-insight__list-block">
              <p class="sg-ai-insight__list-title sg-ai-insight__list-title--con">A trabajar</p>
              <ul class="sg-ai-insight__list">
                @for (item of improvements; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            </div>
          }
        </div>
      }

      <button type="button" class="u-btn u-btn--ai" (click)="ctaClick.emit()">
        {{ ctaLabel }}
      </button>
    </section>
  `,
})
export class AiInsightCardComponent {
  @Input() headline = 'Tu mid-game está costando placement';
  @Input() body =
    'En las últimas partidas perdés posición entre minuto 8–14. El coach sugiere rotación más temprana.';
  @Input() strengths: string[] = [];
  @Input() improvements: string[] = [];
  @Input() ctaLabel = 'Ver plan de mejora';

  @Output() readonly ctaClick = new EventEmitter<void>();
}
