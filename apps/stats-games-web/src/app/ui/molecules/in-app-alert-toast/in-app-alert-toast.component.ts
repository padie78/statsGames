import { Component, ViewEncapsulation, inject } from '@angular/core';
import { Router } from '@angular/router';
import { InAppAlertsStore } from '../../../stores/in-app-alerts.store';
import { sgToastPop } from '../../animations/sg-motion';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

const KIND_LABEL: Record<string, string> = {
  forma_down: 'Forma',
  sync_stale: 'Sync',
  rank_up: 'Ranking',
  rank_down: 'Ranking',
  report_ready: 'Coach IA',
};

const KIND_TONE: Record<string, 'gold' | 'lime' | 'pink' | 'cyan' | 'muted'> = {
  forma_down: 'pink',
  sync_stale: 'gold',
  rank_up: 'lime',
  rank_down: 'pink',
  report_ready: 'cyan',
};

@Component({
  standalone: true,
  selector: 'sg-in-app-alert-toast',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  animations: [sgToastPop],
  template: `
    @if (store.toast(); as toast) {
      <aside
        class="sg-notify-toast sg-notify-toast--product"
        [class.sg-notify-toast--ready]="toast.kind === 'rank_up' || toast.kind === 'report_ready'"
        [class.sg-notify-toast--pending]="
          toast.kind === 'forma_down' || toast.kind === 'rank_down' || toast.kind === 'sync_stale'
        "
        @sgToastPop
        role="status"
        aria-live="polite"
      >
        <span class="sg-notify-toast__ring" aria-hidden="true"></span>
        <div class="sg-notify-toast__body">
          <div class="sg-notify-toast__badges">
            <sg-neon-badge [tone]="toneFor(toast.kind)">
              {{ labelFor(toast.kind) }}
            </sg-neon-badge>
          </div>
          <p class="sg-notify-toast__title u-m-0">{{ toast.title }}</p>
          <p class="sg-notify-toast__meta u-m-0">{{ toast.body }}</p>
        </div>
        <div class="sg-notify-toast__actions">
          <button type="button" class="u-btn u-btn--primary" (click)="open(toast.id, toast.route)">
            Ver
          </button>
          <button
            type="button"
            class="sg-notify-toast__close"
            aria-label="Cerrar"
            (click)="store.dismissToast()"
          >
            ×
          </button>
        </div>
      </aside>
    }
  `,
})
export class InAppAlertToastComponent {
  readonly store = inject(InAppAlertsStore);
  private readonly router = inject(Router);

  labelFor(kind: string): string {
    return KIND_LABEL[kind] ?? 'Alerta';
  }

  toneFor(kind: string): 'gold' | 'lime' | 'pink' | 'cyan' | 'muted' {
    return KIND_TONE[kind] ?? 'muted';
  }

  open(id: string, route: string): void {
    this.store.markRead(id);
    this.store.dismissToast();
    void this.router.navigateByUrl(route);
  }
}
