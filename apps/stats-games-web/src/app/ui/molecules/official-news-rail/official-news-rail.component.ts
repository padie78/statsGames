import { Component, Input, ViewEncapsulation } from '@angular/core';
import { MEDIA_LEGAL_DISCLAIMER } from '../../../core/media';
import type { FortniteNewsMotd } from '../../../services/fortnite-official-media.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

@Component({
  standalone: true,
  selector: 'sg-official-news-rail',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-news-rail u-surface-card u-p-5" aria-label="News oficial">
      <header class="sg-panel-header">
        <div>
          <h2 class="sg-panel-header__title">{{ title }}</h2>
          <p class="sg-news-rail__lead">{{ subtitle }}</p>
        </div>
        <sg-neon-badge tone="cyan">Oficial</sg-neon-badge>
      </header>

      @if (bannerUrl) {
        <img
          class="sg-news-rail__banner"
          [src]="bannerUrl"
          alt="Fortnite news banner"
          loading="lazy"
        />
      }

      @if (loading && !items.length) {
        <p class="u-hint">Cargando news…</p>
      } @else if (!items.length) {
        <p class="u-hint">Sin news por ahora.</p>
      } @else {
        <ul class="sg-news-rail__list">
          @for (item of items; track item.id) {
            <li class="sg-news-rail__card">
              <img
                class="sg-news-rail__img"
                [src]="item.tileImageUrl || item.imageUrl"
                [alt]="item.title"
                loading="lazy"
              />
              <div class="sg-news-rail__copy">
                <h3 class="sg-news-rail__title">{{ item.title }}</h3>
              </div>
            </li>
          }
        </ul>
      }

      <p class="sg-news-rail__legal u-hint">{{ legal }}</p>
    </section>
  `,
})
export class OfficialNewsRailComponent {
  @Input() title = 'Fortnite News';
  @Input() subtitle = 'Imágenes oficiales del feed in-game (MOTD).';
  @Input() items: FortniteNewsMotd[] = [];
  @Input() bannerUrl: string | null = null;
  @Input() loading = false;
  readonly legal = MEDIA_LEGAL_DISCLAIMER;
}
