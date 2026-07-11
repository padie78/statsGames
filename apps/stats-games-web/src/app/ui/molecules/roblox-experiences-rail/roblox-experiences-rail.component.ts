import { Component, Input, ViewEncapsulation } from '@angular/core';
import { MEDIA_LEGAL_DISCLAIMER } from '../../../core/media';
import type { RobloxExperienceThumb } from '../../../services/roblox-experiences.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

@Component({
  standalone: true,
  selector: 'sg-roblox-experiences-rail',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-rbx-rail u-surface-card u-p-5" aria-label="Experiences Roblox">
      <header class="sg-panel-header">
        <div>
          <h2 class="sg-panel-header__title">{{ title }}</h2>
          <p class="sg-rbx-rail__lead">{{ subtitle }}</p>
        </div>
        <sg-neon-badge tone="purple">API</sg-neon-badge>
      </header>

      @if (loading && !items.length) {
        <p class="u-hint">Cargando experiences…</p>
      } @else if (!items.length) {
        <p class="u-hint">Sin icons por ahora.</p>
      } @else {
        <ul class="sg-rbx-rail__list">
          @for (item of items; track item.placeId) {
            <li class="sg-rbx-rail__item" [title]="item.name">
              <img
                class="sg-rbx-rail__icon"
                [src]="item.imageUrl"
                [alt]="item.name"
                width="96"
                height="96"
                loading="lazy"
              />
              <span class="sg-rbx-rail__name">{{ item.name }}</span>
            </li>
          }
        </ul>
      }

      <p class="sg-rbx-rail__legal u-hint">{{ legal }}</p>
    </section>
  `,
})
export class RobloxExperiencesRailComponent {
  @Input() title = 'Experiences en tendencia';
  @Input() subtitle = 'Icons oficiales vía Roblox Thumbnails API.';
  @Input() items: RobloxExperienceThumb[] = [];
  @Input() loading = false;
  readonly legal = MEDIA_LEGAL_DISCLAIMER;
}
