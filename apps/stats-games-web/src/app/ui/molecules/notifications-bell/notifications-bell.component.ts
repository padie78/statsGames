import {
  Component,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import {
  MatchNotificationsStore,
  type MatchNotification,
} from '../../../stores/match-notifications.store';
import { matchDetailRoute } from '../../../utils/match-analysis.util';
import { formatMatchRelativeTime } from '../../../utils/match-stats.util';
import { sgFadeSlideIn, sgPulseOnce } from '../../animations/sg-motion';

@Component({
  standalone: true,
  selector: 'sg-notifications-bell',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  animations: [sgPulseOnce, sgFadeSlideIn],
  template: `
    <div
      class="sg-notify"
      [class.sg-notify--open]="store.panelOpen()"
      [class.sg-notify--alert]="bellAlert()"
    >
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
          <span class="sg-notify__count" [attr.data-count]="store.unreadCount()" @sgPulseOnce>
            {{ store.unreadCount() > 9 ? '9+' : store.unreadCount() }}
          </span>
        }
      </button>

      @if (store.panelOpen()) {
        <div
          id="sg-notify-panel"
          class="sg-notify__panel"
          role="dialog"
          aria-label="Partidas recientes"
          (click)="$event.stopPropagation()"
          @sgFadeSlideIn
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
              Cuando termine una partida, aparece acá. Podés abrirla al instante; el análisis IA se completa en segundos.
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
                    [attr.title]="
                      item.aiStatus === 'pending'
                        ? 'Abrir partida · análisis IA en proceso'
                        : 'Abrir partida y análisis'
                    "
                    (click)="onItemClick(item)"
                  >
                    <div class="sg-notify__item-top">
                      <sg-neon-badge [tone]="platformTone(item.platform)">
                        {{ platformShort(item.platform) }}
                      </sg-neon-badge>
                      @if (item.aiStatus === 'pending') {
                        <sg-neon-badge tone="muted">IA en proceso</sg-neon-badge>
                      } @else if (item.aiStatus === 'failed') {
                        <sg-neon-badge tone="muted">IA no disponible</sg-neon-badge>
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
  readonly bellAlert = signal(false);
  private alertTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const tick = this.store.arrivalTick();
      if (tick <= 0) return;
      this.bellAlert.set(true);
      if (this.alertTimer) clearTimeout(this.alertTimer);
      this.alertTimer = setTimeout(() => {
        this.bellAlert.set(false);
        this.alertTimer = null;
      }, 1400);
    });
  }

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
    const key = platform.toLowerCase();
    const map: Record<string, string> = {
      valorant: 'VAL',
      rocket_league: 'RL',
      fortnite: 'FN',
      roblox: 'RBX',
      blox_fruits: 'BF',
      adopt_me: 'AM',
      brookhaven: 'BH',
      bedwars: 'BW',
      arsenal: 'ARS',
    };
    return map[key] ?? platform.slice(0, 3).toUpperCase();
  }

  platformTone(platform: string): 'cyan' | 'purple' | 'lime' {
    const key = platform.toLowerCase();
    if (key === 'valorant') return 'purple';
    if (key === 'fortnite' || key === 'rocket_league') return 'cyan';
    return 'lime';
  }

  onItemClick(item: MatchNotification): void {
    this.store.markRead(item.id);
    this.store.closePanel();
    void this.router.navigateByUrl(matchDetailRoute(item.matchId));
  }
}
