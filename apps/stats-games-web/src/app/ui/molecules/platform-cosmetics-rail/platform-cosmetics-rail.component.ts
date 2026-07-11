import { Component, Input, ViewEncapsulation } from '@angular/core';
import type { FortniteCosmeticThumb } from '../../../services/fortnite-cosmetics.service';
import { MEDIA_LEGAL_DISCLAIMER } from '../../../core/media';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

/** Rail de thumbs de shop Fortnite (API) — decoración secundaria. */
@Component({
  standalone: true,
  selector: 'sg-platform-cosmetics-rail',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-cosmetics-rail u-surface-card u-p-5" aria-label="Cosméticos en tienda">
      <header class="sg-panel-header">
        <div>
          <h2 class="sg-panel-header__title">{{ title }}</h2>
          <p class="sg-cosmetics-rail__lead">{{ subtitle }}</p>
        </div>
        <sg-neon-badge tone="cyan">Live API</sg-neon-badge>
      </header>

      @if (loading && !items.length) {
        <p class="u-hint">Cargando shop…</p>
      } @else if (!items.length) {
        <p class="u-hint">Sin ítems por ahora. Reintentá más tarde.</p>
      } @else {
        <ul class="sg-cosmetics-rail__list">
          @for (item of items; track item.id) {
            <li class="sg-cosmetics-rail__item" [title]="item.name">
              <img
                class="sg-cosmetics-rail__icon"
                [src]="item.iconUrl"
                [alt]="item.name"
                width="64"
                height="64"
                loading="lazy"
              />
              <span class="sg-cosmetics-rail__name">{{ item.name }}</span>
              <span class="sg-cosmetics-rail__type">{{ item.type }}</span>
            </li>
          }
        </ul>
      }

      <p class="sg-cosmetics-rail__legal u-hint">{{ legal }}</p>
    </section>
  `,
})
export class PlatformCosmeticsRailComponent {
  @Input() title = 'Item Shop spotlight';
  @Input() subtitle = 'Iconos oficiales del Item Shop · proxy StatsGames / fortnite-api.';
  @Input() items: FortniteCosmeticThumb[] = [];
  @Input() loading = false;

  readonly legal = MEDIA_LEGAL_DISCLAIMER;
}
