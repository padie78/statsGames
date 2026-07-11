import {
  Component,
  EventEmitter,
  HostListener,
  Output,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import { UserPreferencesService } from '../../../core/preferences/user-preferences.service';
import { APP_ACCOUNT_MENU_ITEMS } from '../../../core/navigation/app-nav.config';
import { PlayerService } from '../../../services/player.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { NotificationsBellComponent } from '../../molecules/notifications-bell/notifications-bell.component';

/**
 * Fila 2 del chrome:
 * [juego] | tabs | cuenta
 * (el search vive en el body, estilo Fortnite Tracker)
 */
@Component({
  standalone: true,
  selector: 'sg-app-subnav',
  encapsulation: ViewEncapsulation.None,
  imports: [
    RouterLink,
    RouterLinkActive,
    NeonBadgeComponent,
    NotificationsBellComponent,
  ],
  template: `
    <header class="sg-game-nav" aria-label="Navegación del juego" [attr.data-game]="game().id">
      <div class="sg-game-nav__inner">
        <div class="sg-game-nav__game">
          <img class="sg-game-nav__icon" [src]="game().iconUrl" [alt]="game().label" width="28" height="28" />
          <div class="sg-game-nav__titles">
            <span class="sg-game-nav__label">{{ game().label }}</span>
            <span class="sg-game-nav__hint">{{ game().badge }}</span>
          </div>
        </div>

        <div class="sg-game-nav__tabs" role="tablist">
          @for (item of items(); track item.id) {
            <a
              class="sg-game-nav__tab"
              [routerLink]="item.route"
              routerLinkActive="sg-game-nav__tab--active"
              [routerLinkActiveOptions]="{ exact: true }"
              role="tab"
            >
              {{ item.label }}
              @if (item.badge) {
                <sg-neon-badge [tone]="item.tone === 'purple' ? 'purple' : 'lime'">{{ item.badge }}</sg-neon-badge>
              }
            </a>
          }
        </div>

        <div class="sg-game-nav__actions">
          <sg-notifications-bell />

          <div class="sg-game-nav__account" [class.sg-game-nav__account--open]="accountMenuOpen()">
            <button
              type="button"
              class="sg-game-nav__account-trigger"
              [attr.aria-expanded]="accountMenuOpen()"
              aria-haspopup="true"
              aria-controls="sg-game-nav-account-menu"
              aria-label="Menú de cuenta"
              (click)="toggleAccountMenu($event)"
            >
              <span class="sg-game-nav__avatar">{{ userInitials() }}</span>
              <span class="sg-game-nav__account-meta">
                <span class="sg-game-nav__user-email u-truncate">
                  {{ gamerTag() || auth.email() || 'Gamer' }}
                </span>
                <span class="sg-game-nav__user-role">Cuenta</span>
              </span>
              <span class="sg-game-nav__account-caret" aria-hidden="true"></span>
            </button>

            @if (accountMenuOpen()) {
              <div
                id="sg-game-nav-account-menu"
                class="sg-game-nav__account-menu"
                role="menu"
                aria-label="Cuenta"
              >
                <div class="sg-game-nav__account-head">
                  <span class="sg-game-nav__avatar">{{ userInitials() }}</span>
                  <div class="sg-game-nav__user-meta">
                    <span class="sg-game-nav__user-email u-truncate">
                      {{ gamerTag() || auth.email() || 'Gamer' }}
                    </span>
                    <span class="sg-game-nav__user-role">Pro</span>
                  </div>
                </div>

                @if (profileRoute(); as profilePath) {
                  <a
                    class="sg-game-nav__account-item"
                    role="menuitem"
                    [routerLink]="profilePath"
                    (click)="closeAccountMenu()"
                  >
                    Mi perfil
                  </a>
                }
                @for (item of accountMenuItems; track item.id) {
                  <a
                    class="sg-game-nav__account-item"
                    role="menuitem"
                    [routerLink]="item.route"
                    (click)="closeAccountMenu()"
                  >
                    {{ item.label }}
                  </a>
                }
                <button
                  type="button"
                  class="sg-game-nav__account-item sg-game-nav__account-item--danger"
                  role="menuitem"
                  (click)="onAccountLogout()"
                >
                  Salir
                </button>
              </div>
            }
          </div>

          <button
            type="button"
            class="sg-game-nav__menu-btn"
            [class.sg-game-nav__menu-btn--open]="mobileMenuOpen()"
            [attr.aria-expanded]="mobileMenuOpen()"
            aria-controls="sg-game-nav-mobile-panel"
            aria-label="Abrir menú de navegación"
            (click)="toggleMobileMenu()"
          >
            <span class="sg-game-nav__menu-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>

      @if (mobileMenuOpen()) {
        <button
          type="button"
          class="sg-game-nav__backdrop"
          aria-label="Cerrar menú"
          (click)="closeMobileMenu()"
        ></button>
      }

      <div
        id="sg-game-nav-mobile-panel"
        class="sg-game-nav__mobile-panel"
        [class.sg-game-nav__mobile-panel--open]="mobileMenuOpen()"
      >
        <nav class="sg-game-nav__mobile-nav" aria-label="Secciones">
          @for (item of items(); track item.id) {
            <a
              class="sg-game-nav__mobile-link"
              [routerLink]="item.route"
              routerLinkActive="sg-game-nav__mobile-link--active"
              [routerLinkActiveOptions]="{ exact: true }"
              (click)="closeMobileMenu()"
            >
              <span>{{ item.label }}</span>
              @if (item.badge) {
                <sg-neon-badge [tone]="item.tone === 'purple' ? 'purple' : 'lime'">{{ item.badge }}</sg-neon-badge>
              }
            </a>
          }
        </nav>

        <div class="sg-game-nav__mobile-footer">
          @if (profileRoute(); as profilePath) {
            <a class="sg-game-nav__mobile-link" [routerLink]="profilePath" (click)="closeMobileMenu()">
              Mi perfil
            </a>
          }
          @for (item of accountMenuItems; track item.id) {
            <a class="sg-game-nav__mobile-link" [routerLink]="item.route" (click)="closeMobileMenu()">
              {{ item.label }}
            </a>
          }
          <button type="button" class="u-btn u-btn--ghost sg-game-nav__mobile-logout" (click)="onMobileLogout()">
            Salir
          </button>
        </div>
      </div>
    </header>
  `,
})
export class AppSubnavComponent {
  readonly auth = inject(AuthService);
  private readonly prefs = inject(UserPreferencesService);
  private readonly playerService = inject(PlayerService);
  private readonly router = inject(Router);

  @Output() readonly logout = new EventEmitter<void>();

  readonly items = this.prefs.visibleNavItems;
  readonly accountMenuItems = APP_ACCOUNT_MENU_ITEMS;
  readonly game = computed(() => {
    const id = this.auth.selectedGame();
    return id ? gamePlatformMeta(id) : gamePlatformMeta('fortnite');
  });
  readonly gamerTag = signal<string | null>(null);
  readonly profileRoute = computed(() => {
    const tag = this.gamerTag();
    return tag ? `/player/${encodeURIComponent(tag)}` : null;
  });
  readonly mobileMenuOpen = signal(false);
  readonly accountMenuOpen = signal(false);

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      if (userId) this.prefs.load(userId);
    });

    effect(() => {
      const userId = this.auth.userId();
      if (!userId) {
        this.gamerTag.set(null);
        return;
      }
      void this.playerService
        .getPlayerProfileOrNull(userId)
        .then((profile) => this.gamerTag.set(profile?.gamerTag ?? null))
        .catch(() => this.gamerTag.set(null));
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.closeMobileMenu();
        this.closeAccountMenu();
      });

    effect(() => {
      document.body.classList.toggle('sg-nav-lock', this.mobileMenuOpen());
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.sg-game-nav__account')) {
      this.closeAccountMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMobileMenu();
    this.closeAccountMenu();
  }

  userInitials(): string {
    const tag = this.gamerTag();
    if (tag) return tag.slice(0, 2).toUpperCase();
    const email = this.auth.email();
    if (!email) return 'SG';
    return email.slice(0, 2).toUpperCase();
  }

  toggleAccountMenu(event: Event): void {
    event.stopPropagation();
    this.accountMenuOpen.update((open) => !open);
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  onAccountLogout(): void {
    this.closeAccountMenu();
    this.logout.emit();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  onMobileLogout(): void {
    this.closeMobileMenu();
    this.logout.emit();
  }
}
