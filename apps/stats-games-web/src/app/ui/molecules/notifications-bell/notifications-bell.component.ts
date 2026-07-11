import {
  Component,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import {
  MatchNotificationsStore,
  type MatchNotification,
} from '../../../stores/match-notifications.store';
import { matchDetailRoute } from '../../../utils/match-analysis.util';
import { formatMatchRelativeTime } from '../../../utils/match-stats.util';

@Component({
  standalone: true,
  selector: 'sg-notifications-bell',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <div class="sg-notify" [class.sg-notify--open]="store.panelOpen()">
      <button
        type="button"
        class="sg-notify__bell"
        [attr.aria-expanded]="store.panelOpen()"
        aria-controls="sg-notify-panel"
        aria-label="Notificaciones de partidas"
        (click)="store.togglePanel(); $event.stopPropagation()"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/>
          <path d="M9.5 17a2.5 2.5 0 0 0 5 0"/>
        </svg>
        @if (store.unreadCount() > 0) {
          <span class="sg-notify__count">{{ store.unreadCount() > 9 ? '9+' : store.unreadCount() }}</span>
        }
      </button>

      @if (store.panelOpen()) {
        <div
          id="sg-notify-panel"
          class="sg-notify__panel"
          role="dialog"
          aria-label="Partidas recientes"
          (click)="$event.stopPropagation()"
        >
          <header class="sg-notify__header">
            <div>
              <p class="sg-notify__eyebrow">Notificaciones</p>
              <h2 class="sg-notify__title">Partidas en vivo</h2>
            </div>
            @if (store.items().length) {
              <button type="button" class="sg-notify__action" (click)="store.markAllRead()">
                Marcar leídas
              </button>
            }
          </header>

          @if (!store.items().length) {
            <p class="sg-notify__empty u-m-0">
              Cuando termine una partida, aparece acá. La IA tarda unos segundos en generar el análisis.
            </p>
          } @else {
            <ul class="sg-notify__list">
              @for (item of store.items(); track item.id) {
                <li>
                  <button
                    type="button"
                    class="sg-notify__item"
                    [class.sg-notify__item--unread]="!item.read"
                    [class.sg-notify__item--pending]="item.aiStatus === 'pending'"
                    [class.sg-notify__item--ready]="item.aiStatus === 'ready'"
                    [disabled]="item.aiStatus === 'pending'"
                    [attr.title]="
                      item.aiStatus === 'pending'
                        ? 'Esperá a que la IA termine el análisis'
                        : 'Abrir partida y estadísticas'
                    "
                    (click)="onItemClick(item)"
                  >
                    <div class="sg-notify__item-top">
                      <sg-neon-badge [tone]="platformTone(item.platform)">
                        {{ platformShort(item.platform) }}
                      </sg-neon-badge>
                      @if (item.aiStatus === 'pending') {
                        <sg-neon-badge tone="muted">IA pendiente</sg-neon-badge>
                      } @else {
                        <sg-neon-badge tone="lime">IA lista</sg-neon-badge>
                      }
                      <span class="sg-notify__time">{{ relative(item.createdAt) }}</span>
                    </div>
                    <p class="sg-notify__summary u-m-0">{{ item.summary }}</p>
                    <p class="sg-notify__ai u-m-0">{{ item.aiHeadline }}</p>
                    @if (item.stats; as stats) {
                      <p class="sg-notify__stats u-m-0">
                        {{ stats.kills ?? 0 }}K · {{ stats.deaths ?? 0 }}D
                        @if (stats.placement != null) {
                          · Top {{ stats.placement }}
                        }
                      </p>
                    }
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
})
export class NotificationsBellComponent {
  readonly store = inject(MatchNotificationsStore);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.store.panelOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.store.closePanel();
    }
  }

  relative(iso: string): string {
    return formatMatchRelativeTime(iso);
  }

  platformShort(platform: string): string {
    return platform.toLowerCase() === 'roblox' ? 'RBX' : 'FN';
  }

  platformTone(platform: string): 'cyan' | 'purple' {
    return platform.toLowerCase() === 'roblox' ? 'purple' : 'cyan';
  }

  onItemClick(item: MatchNotification): void {
    if (item.aiStatus !== 'ready') return;
    this.store.markRead(item.id);
    this.store.closePanel();
    void this.router.navigateByUrl(matchDetailRoute(item.matchId));
  }
}
