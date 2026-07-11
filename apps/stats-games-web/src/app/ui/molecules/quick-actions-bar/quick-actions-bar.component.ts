import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

export interface QuickActionItem {
  id: string;
  label: string;
  route: string;
  icon: string;
  tone?: 'lime' | 'purple' | 'cyan' | 'pink';
  badge?: string;
}

@Component({
  standalone: true,
  selector: 'sg-quick-actions-bar',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
    <section class="sg-quick-actions u-surface-card u-p-5" aria-label="Acciones rápidas">
      <header class="sg-panel-header">
        <h2 class="sg-panel-header__title">Acceso rápido</h2>
      </header>

      <div class="sg-quick-actions__grid">
        @for (action of actions; track action.id) {
          <a [routerLink]="action.route" class="sg-quick-actions__item">
            <span
              class="sg-quick-actions__icon"
              [class]="action.tone ? 'sg-quick-actions__icon--' + action.tone : ''"
            >{{ action.icon }}</span>
            <span class="sg-quick-actions__label">{{ action.label }}</span>
            @if (action.badge) {
              <sg-neon-badge [tone]="action.tone ?? 'muted'" class="sg-quick-actions__badge">{{ action.badge }}</sg-neon-badge>
            }
          </a>
        }
      </div>
    </section>
  `,
})
export class QuickActionsBarComponent {
  @Input({ required: true }) actions: QuickActionItem[] = [];
}
