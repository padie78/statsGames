import { Component, ViewEncapsulation, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { MatchNotificationsStore } from '../../../stores/match-notifications.store';
import { matchDetailRoute } from '../../../utils/match-analysis.util';

@Component({
  standalone: true,
  selector: 'sg-match-notification-toast',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    @if (store.toast(); as toast) {
      <aside
        class="sg-notify-toast"
        [class.sg-notify-toast--pending]="toast.aiStatus === 'pending'"
        [class.sg-notify-toast--ready]="toast.aiStatus === 'ready'"
        role="status"
        aria-live="polite"
      >
        <div class="sg-notify-toast__body">
          <div class="sg-notify-toast__badges">
            <sg-neon-badge [tone]="toast.platform.toLowerCase() === 'roblox' ? 'purple' : 'cyan'">
              Nueva partida
            </sg-neon-badge>
            @if (toast.aiStatus === 'pending') {
              <sg-neon-badge tone="muted">IA en proceso</sg-neon-badge>
            } @else if (toast.aiStatus === 'failed') {
              <sg-neon-badge tone="muted">IA no disponible</sg-neon-badge>
            } @else {
              <sg-neon-badge tone="lime">IA lista</sg-neon-badge>
            }
          </div>
          <p class="sg-notify-toast__title u-m-0">{{ toast.summary }}</p>
          <p class="sg-notify-toast__meta u-m-0">{{ toast.aiHeadline }}</p>
        </div>
        <div class="sg-notify-toast__actions">
          <button type="button" class="u-btn u-btn--primary" (click)="open(toast.id, toast.matchId)">
            {{ toast.aiStatus === 'ready' ? 'Ver análisis' : 'Ver partida' }}
          </button>
          <button type="button" class="sg-notify-toast__close" aria-label="Cerrar" (click)="store.dismissToast()">
            ×
          </button>
        </div>
      </aside>
    }
  `,
})
export class MatchNotificationToastComponent {
  readonly store = inject(MatchNotificationsStore);
  private readonly router = inject(Router);

  open(id: string, matchId: string): void {
    this.store.markRead(id);
    this.store.dismissToast();
    void this.router.navigateByUrl(matchDetailRoute(matchId));
  }
}
