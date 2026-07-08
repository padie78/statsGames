import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

/**
 * Organismo — banner de conversión Premium / IA coaching (TRN upsell).
 */
@Component({
  standalone: true,
  selector: 'sg-premium-upsell-banner',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <aside class="sg-premium-banner" role="complementary">
      <sg-neon-badge tone="purple">AI COACHING</sg-neon-badge>
      <p class="sg-premium-banner__eyebrow">{{ eyebrow }}</p>
      <h2 class="sg-premium-banner__headline">{{ headline }}</h2>
      <p class="sg-premium-banner__body">{{ body }}</p>
      <div class="sg-premium-banner__actions">
        <button type="button" class="u-btn u-btn--ai" (click)="ctaClick.emit()">
          {{ ctaLabel }}
        </button>
        <button type="button" class="u-btn u-btn--ghost" (click)="dismiss.emit()">
          Más tarde
        </button>
      </div>
    </aside>
  `,
})
export class PremiumUpsellBannerComponent {
  @Input() eyebrow = 'PERFORMANCE INSIGHT';
  @Input() headline = 'Estás en el Top 10% de tu rango';
  @Input() body =
    'Suscribite a Premium para desbloquear el análisis de IA, coaching personalizado y breakdown de cada death.';
  @Input() ctaLabel = 'Desbloquear IA Coach';

  @Output() readonly ctaClick = new EventEmitter<void>();
  @Output() readonly dismiss = new EventEmitter<void>();
}
