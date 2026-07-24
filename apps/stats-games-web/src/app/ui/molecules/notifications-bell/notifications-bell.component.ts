import {
  Component,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  computed,
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
import {
  InAppAlertsStore,
  type InAppAlert,
} from '../../../stores/in-app-alerts.store';
import { matchDetailRoute } from '../../../utils/match-analysis.util';
import { formatMatchRelativeTime } from '../../../utils/match-stats.util';
import { sgFadeSlideIn, sgPulseOnce } from '../../animations/sg-motion';

const PRODUCT_KIND_LABEL: Record<string, string> = {
  forma_down: 'Forma',
  sync_stale: 'Sync',
  rank_up: 'Ranking',
  rank_down: 'Ranking',
  report_ready: 'Coach IA',
};

@Component({
  standalone: true,
  selector: 'sg-notifications-bell',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  animations: [sgPulseOnce, sgFadeSlideIn],
  template: `
    <div
      class="sg-notify"
      [class.sg-notify--open]="panelOpen()"
      [class.sg-notify--alert]="bellAlert()"
    >
      <button
        type="button"
        class="sg-notify__bell"
        [attr.aria-expanded]="panelOpen()"
        aria-controls="sg-notify-panel"
        aria-label="Notificaciones"
        (click)="togglePanel(); $event.stopPropagation()"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/>
          <path d="M9.5 17a2.5 2.5 0 0 0 5 0"/>
        </svg>
        @if (unreadTotal() > 0) {
          <span class="sg-notify__count" [attr.data-count]="unreadTotal()" @sgPulseOnce>
            {{ unreadTotal() > 9 ? '9+' : unreadTotal() }}
          </span>
        }
      </button>

      @if (panelOpen()) {
        <div
          id="sg-notify-panel"
          class="sg-notify__panel"
          role="dialog"
          aria-label="Notificaciones"
          (click)="$event.stopPropagation()"
          @sgFadeSlideIn
        >
          <header class="sg-notify__header">
            <div>
              <p class="sg-notify__eyebrow">Notificaciones</p>
              <h2 class="sg-notify__title">Inbox</h2>
            </div>
            @if (matchStore.items().length || productStore.items().length) {
              <button type="button" class="sg-notify__action" (click)="markAllRead()">
                Marcar leídas
              </button>
            }
          </header>

          @if (productStore.items().length) {
            <p class="sg-notify__section u-m-0">Alertas</p>
            <ul class="sg-notify__list">
              @for (item of productStore.items(); track item.id) {
                <li>
                  <button
                    type="button"
                    class="sg-notify__item"
                    [class.sg-notify__item--unread]="!item.read"
                    [class.sg-notify__item--pending]="
                      item.kind === 'forma_down' || item.kind === 'rank_down' || item.kind === 'sync_stale'
                    "
                    [class.sg-notify__item--ready]="
                      item.kind === 'rank_up' || item.kind === 'report_ready'
                    "
                    (click)="onProductClick(item)"
                  >
                    <div class="sg-notify__item-top">
                      <sg-neon-badge [tone]="productTone(item.kind)">
                        {{ productLabel(item.kind) }}
                      </sg-neon-badge>
                      <span class="sg-notify__time">{{ relative(item.createdAt) }}</span>
                    </div>
                    <p class="sg-notify__summary u-m-0">{{ item.title }}</p>
                    <p class="sg-notify__ai u-m-0">{{ item.body }}</p>
                  </button>
                </li>
              }
            </ul>
          }

          @if (matchStore.items().length) {
            <p class="sg-notify__section u-m-0">Partidas</p>
            <ul class="sg-notify__list">
              @for (item of matchStore.items(); track item.id) {
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
                    (click)="onMatchClick(item)"
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

          @if (!matchStore.items().length && !productStore.items().length) {
            <p class="sg-notify__empty u-m-0">
              Cuando termine una partida o haya un aviso de forma/ranking, aparece acá.
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class NotificationsBellComponent {
  readonly matchStore = inject(MatchNotificationsStore);
  readonly productStore = inject(InAppAlertsStore);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly bellAlert = signal(false);
  private alertTimer: ReturnType<typeof setTimeout> | null = null;

  readonly unreadTotal = computed(
    () => this.matchStore.unreadCount() + this.productStore.unreadCount(),
  );

  readonly panelOpen = computed(
    () => this.matchStore.panelOpen(),
  );

  constructor() {
    effect(() => {
      const tick = this.matchStore.arrivalTick();
      const productUnread = this.productStore.unreadCount();
      if (tick <= 0 && productUnread <= 0) return;
      this.bellAlert.set(true);
      if (this.alertTimer) clearTimeout(this.alertTimer);
      this.alertTimer = setTimeout(() => {
        this.bellAlert.set(false);
        this.alertTimer = null;
      }, 1400);
    });
  }

  togglePanel(): void {
    this.matchStore.togglePanel();
  }

  markAllRead(): void {
    this.matchStore.markAllRead();
    this.productStore.markAllRead();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.panelOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.matchStore.closePanel();
    }
  }

  relative(iso: string): string {
    return formatMatchRelativeTime(iso);
  }

  productLabel(kind: string): string {
    return PRODUCT_KIND_LABEL[kind] ?? 'Alerta';
  }

  productTone(kind: string): 'gold' | 'lime' | 'pink' | 'cyan' | 'muted' {
    if (kind === 'rank_up' || kind === 'report_ready') return 'lime';
    if (kind === 'forma_down' || kind === 'rank_down') return 'pink';
    if (kind === 'sync_stale') return 'gold';
    return 'cyan';
  }

  platformShort(platform: string): string {
    const key = platform.toLowerCase();
    const map: Record<string, string> = {
      valorant: 'VAL',
      league_of_legends: 'LoL',
      rocket_league: 'RL',
      fortnite: 'FN',
      roblox: 'RBX',
      blox_fruits: 'BF',
    };
    return map[key] ?? platform.slice(0, 3).toUpperCase();
  }

  platformTone(platform: string): 'cyan' | 'purple' | 'lime' {
    const key = platform.toLowerCase();
    if (key === 'valorant') return 'purple';
    if (key === 'fortnite' || key === 'rocket_league') return 'cyan';
    return 'lime';
  }

  onMatchClick(item: MatchNotification): void {
    this.matchStore.markRead(item.id);
    this.matchStore.closePanel();
    void this.router.navigateByUrl(matchDetailRoute(item.matchId));
  }

  onProductClick(item: InAppAlert): void {
    this.productStore.markRead(item.id);
    this.matchStore.closePanel();
    void this.router.navigateByUrl(item.route);
  }
}
