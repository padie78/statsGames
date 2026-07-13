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
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import { UserPreferencesService } from '../../../core/preferences/user-preferences.service';
import {
  APP_ACCOUNT_MENU_ITEMS,
  navFocusForRole,
} from '../../../core/navigation/app-nav.config';
import { roleLabel as formatRoleLabel } from '../../../core/auth/user-role';
import { PlayerService } from '../../../services/player.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { NotificationsBellComponent } from '../../molecules/notifications-bell/notifications-bell.component';

/**
 * Fila 2 del chrome:
 * [juego + enfoque del rol] | tabs del portal | cuenta
 */
@Component({
  standalone: true,
  selector: 'sg-app-subnav',
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    NeonBadgeComponent,
    NotificationsBellComponent,
  ],
  template: `
    <header
      class="sg-game-nav"
      aria-label="Navegación del portal"
      [attr.data-game]="game().id"
      [attr.data-role]="auth.userRole()"
    >
      <div class="sg-game-nav__inner">
        <div class="sg-game-nav__game">
          <img class="sg-game-nav__icon" [src]="game().iconUrl" [alt]="game().label" width="28" height="28" />
          <div class="sg-game-nav__titles">
            <span class="sg-game-nav__label">{{ game().label }}</span>
            <span class="sg-game-nav__hint">
              <span class="sg-game-nav__focus">{{ roleFocus() }}</span>
              <span class="sg-game-nav__hint-sep" aria-hidden="true">·</span>
              <span>{{ game().shortLabel }}</span>
            </span>
          </div>
        </div>

        <nav class="sg-game-nav__tabs" [attr.aria-label]="roleNavLabel()">
          @for (item of items(); track item.id) {
            <a
              class="sg-game-nav__tab"
              [routerLink]="item.route"
              routerLinkActive="sg-game-nav__tab--active"
              [routerLinkActiveOptions]="{ exact: item.exact !== false }"
              [attr.title]="item.title + ' — ' + item.description"
              [attr.aria-label]="item.title"
            >
              <span class="sg-game-nav__tab-icon" aria-hidden="true">
                <ng-container [ngTemplateOutlet]="navIcon" [ngTemplateOutletContext]="{ $implicit: item.icon }" />
              </span>
              <span class="sg-game-nav__tab-label">{{ item.label }}</span>
              @if (item.badge) {
                <sg-neon-badge [tone]="item.tone === 'purple' ? 'purple' : 'lime'">{{ item.badge }}</sg-neon-badge>
              }
            </a>
          }
        </nav>

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
                <span class="sg-game-nav__user-role">{{ roleLabel() }} · {{ roleFocus() }}</span>
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
                    <span class="sg-game-nav__user-role">{{ roleLabel() }} · {{ roleFocus() }}</span>
                  </div>
                </div>

                @if (profileRoute(); as profilePath) {
                  <a
                    class="sg-game-nav__account-item"
                    role="menuitem"
                    [routerLink]="profilePath"
                    (click)="closeAccountMenu()"
                  >
                    Perfil público
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
        <div class="sg-game-nav__mobile-head">
          <p class="sg-game-nav__mobile-eyebrow">{{ roleLabel() }} · {{ game().label }}</p>
          <p class="sg-game-nav__mobile-focus">{{ roleFocus() }}</p>
        </div>

        <nav class="sg-game-nav__mobile-nav" [attr.aria-label]="roleNavLabel()">
          @for (item of items(); track item.id) {
            <a
              class="sg-game-nav__mobile-link"
              [routerLink]="item.route"
              routerLinkActive="sg-game-nav__mobile-link--active"
              [routerLinkActiveOptions]="{ exact: item.exact !== false }"
              (click)="closeMobileMenu()"
            >
              <span class="sg-game-nav__mobile-link-main">
                <span class="sg-game-nav__tab-icon" aria-hidden="true">
                  <ng-container [ngTemplateOutlet]="navIcon" [ngTemplateOutletContext]="{ $implicit: item.icon }" />
                </span>
                <span class="sg-game-nav__mobile-copy">
                  <span class="sg-game-nav__mobile-title">{{ item.title }}</span>
                  <span class="sg-game-nav__mobile-desc">{{ item.description }}</span>
                </span>
              </span>
              @if (item.badge) {
                <sg-neon-badge [tone]="item.tone === 'purple' ? 'purple' : 'lime'">{{ item.badge }}</sg-neon-badge>
              }
            </a>
          }
        </nav>

        <div class="sg-game-nav__mobile-footer">
          @if (profileRoute(); as profilePath) {
            <a class="sg-game-nav__mobile-link" [routerLink]="profilePath" (click)="closeMobileMenu()">
              <span class="sg-game-nav__mobile-copy">
                <span class="sg-game-nav__mobile-title">Perfil público</span>
                <span class="sg-game-nav__mobile-desc">Vista scout de tu página</span>
              </span>
            </a>
          }
          @for (item of accountMenuItems; track item.id) {
            <a class="sg-game-nav__mobile-link" [routerLink]="item.route" (click)="closeMobileMenu()">
              <span class="sg-game-nav__mobile-copy">
                <span class="sg-game-nav__mobile-title">{{ item.label }}</span>
              </span>
            </a>
          }
          <button type="button" class="u-btn u-btn--ghost sg-game-nav__mobile-logout" (click)="onMobileLogout()">
            Salir
          </button>
        </div>
      </div>

      <ng-template #navIcon let-icon>
        @switch (icon) {
          @case ('dashboard') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"/>
            </svg>
          }
          @case ('matches') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>
            </svg>
          }
          @case ('analytics') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <path d="M4 19V5M4 19h16"/><path d="m7 14 4-4 3 3 5-6"/>
            </svg>
          }
          @case ('profile') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <circle cx="12" cy="8" r="3.25"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>
            </svg>
          }
          @case ('talent') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5"/><path d="m16.5 16.5 4 4"/>
            </svg>
          }
          @case ('radar') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 4v3.5M12 12l5-3"/>
            </svg>
          }
          @case ('reports') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5V8h4M9 12h6M9 16h4"/>
            </svg>
          }
          @case ('team') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <circle cx="9" cy="8" r="2.5"/><circle cx="16" cy="9" r="2"/><path d="M4.5 18a4.5 4.5 0 0 1 9 0M13 18a3.5 3.5 0 0 1 6.5-1.5"/>
            </svg>
          }
        }
      </ng-template>
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
  readonly roleLabel = computed(() => formatRoleLabel(this.auth.userRole()));
  readonly roleFocus = computed(() => navFocusForRole(this.auth.userRole()));
  readonly roleNavLabel = computed(() =>
    this.auth.userRole() === 'scout' ? 'Menú scout' : 'Menú jugador',
  );
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
