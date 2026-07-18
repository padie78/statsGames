import { Component, ViewEncapsulation, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

export type QuickActionIcon = 'matches' | 'analytics' | 'coach' | 'link';

export interface QuickActionItem {
  id: string;
  label: string;
  route: string;
  icon: QuickActionIcon;
  /** Una línea corta bajo el título. */
  hint?: string;
  /** Párrafo más largo: para qué sirve este atajo. */
  body?: string;
  tone?: 'lime' | 'purple' | 'cyan' | 'pink';
  badge?: string;
  cta?: string;
}

/**
 * Franja compacta de atajos del portal (Inicio).
 */
@Component({
  standalone: true,
  selector: 'sg-quick-actions-bar',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
    <section class="sg-shortcuts" aria-label="Atajos del portal">
      <div class="sg-shortcuts__grid">
        @for (action of actions(); track action.id) {
          <a
            [routerLink]="action.route"
            class="sg-shortcuts__card"
            [attr.data-tone]="action.tone ?? 'cyan'"
          >
            <span class="sg-shortcuts__icon" aria-hidden="true">
              @switch (action.icon) {
                @case ('matches') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <rect x="4" y="5" width="16" height="14" rx="2" />
                    <path d="M8 9h8M8 13h5" />
                  </svg>
                }
                @case ('analytics') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path d="M4 19V5M4 19h16" />
                    <path d="m7 14 4-4 3 3 5-6" />
                  </svg>
                }
                @case ('coach') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path
                      d="M12 3.5 4.5 7v5c0 4.4 3.1 7.8 7.5 9 4.4-1.2 7.5-4.6 7.5-9V7L12 3.5Z"
                    />
                    <path d="M9.5 12.2 11 13.7l3.5-3.5" />
                  </svg>
                }
                @case ('link') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path d="M9.5 14.5 14.5 9.5" />
                    <path
                      d="M11 7.5 12.2 6.3a3.5 3.5 0 0 1 5 5L16 12.5M13 16.5l-1.2 1.2a3.5 3.5 0 0 1-5-5L8 11.5"
                    />
                  </svg>
                }
              }
            </span>

            <span class="sg-shortcuts__copy">
              <span class="sg-shortcuts__label-row">
                <span class="sg-shortcuts__label">{{ action.label }}</span>
                @if (action.badge) {
                  <sg-neon-badge [tone]="action.tone ?? 'lime'">{{ action.badge }}</sg-neon-badge>
                }
              </span>
              <span class="sg-shortcuts__hint">{{ action.hint || action.body }}</span>
            </span>
          </a>
        }
      </div>
    </section>
  `,
})
export class QuickActionsBarComponent {
  readonly actions = input.required<QuickActionItem[]>();
  readonly gameLabel = input('tu juego');
  readonly needsSetup = input(false);
  readonly matchCount = input(0);
  readonly winRate = input('—');
}
