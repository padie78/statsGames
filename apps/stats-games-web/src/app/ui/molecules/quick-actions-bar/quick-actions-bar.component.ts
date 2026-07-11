import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

export interface QuickActionItem {
  id: string;
  label: string;
  route: string;
  icon: string;
  hint?: string;
  tone?: 'lime' | 'purple' | 'cyan' | 'pink';
  badge?: string;
}

@Component({
  standalone: true,
  selector: 'sg-quick-actions-bar',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
    <section class="sg-quick-actions u-surface-card u-p-5" aria-label="Acceso rápido">
      <header class="sg-quick-actions__header">
        <div>
          <p class="sg-quick-actions__eyebrow">Navegación</p>
          <h2 class="sg-quick-actions__title">Acceso rápido</h2>
        </div>
        <p class="sg-quick-actions__lede">Atajos a stats, partidas y coach</p>
      </header>

      <nav class="sg-quick-actions__grid" aria-label="Atajos del dashboard">
        @for (action of actions; track action.id) {
          <a
            [routerLink]="action.route"
            class="sg-quick-actions__item"
            [attr.data-tone]="action.tone ?? 'cyan'"
          >
            <span
              class="sg-quick-actions__icon"
              [attr.data-tone]="action.tone ?? 'cyan'"
              aria-hidden="true"
            >{{ action.icon }}</span>

            <span class="sg-quick-actions__copy">
              <span class="sg-quick-actions__label">{{ action.label }}</span>
              @if (action.hint) {
                <span class="sg-quick-actions__hint">{{ action.hint }}</span>
              }
            </span>

            @if (action.badge) {
              <sg-neon-badge [tone]="action.tone ?? 'muted'" class="sg-quick-actions__badge">
                {{ action.badge }}
              </sg-neon-badge>
            }

            <span class="sg-quick-actions__chevron" aria-hidden="true">→</span>
          </a>
        }
      </nav>
    </section>
  `,
})
export class QuickActionsBarComponent {
  @Input({ required: true }) actions: QuickActionItem[] = [];
}
