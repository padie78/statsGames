import { Component, ViewEncapsulation, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserPreferencesService } from '../../../core/preferences/user-preferences.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

@Component({
  standalone: true,
  selector: 'sg-app-subnav',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, RouterLinkActive, NeonBadgeComponent],
  template: `
    <nav class="sg-subnav" aria-label="Secciones del perfil">
      <div class="sg-subnav__scroll">
        @for (item of items(); track item.id) {
          <a
            class="sg-subnav__link"
            [routerLink]="item.route"
            routerLinkActive="sg-subnav__link--active"
            [routerLinkActiveOptions]="{ exact: true }"
            [class.sg-subnav__link--lime]="item.tone === 'lime'"
            [class.sg-subnav__link--purple]="item.tone === 'purple'"
            [class.sg-subnav__link--cyan]="item.tone === 'cyan'"
          >
            {{ item.label }}
            @if (item.badge) {
              <sg-neon-badge [tone]="item.tone === 'purple' ? 'purple' : 'lime'">{{ item.badge }}</sg-neon-badge>
            }
          </a>
        }
      </div>
    </nav>
  `,
})
export class AppSubnavComponent {
  private readonly auth = inject(AuthService);
  private readonly prefs = inject(UserPreferencesService);

  readonly items = this.prefs.visibleNavItems;

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      if (userId) this.prefs.load(userId);
    });
  }
}
