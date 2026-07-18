import {
  Component,
  HostListener,
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
import { navFocusForRole } from '../../../core/navigation/app-nav.config';
import { roleLabel as formatRoleLabel } from '../../../core/auth/user-role';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

/**
 * Fila 2 del chrome:
 * [juego + enfoque] | tabs del portal | menú mobile
 * (cuenta y notificaciones viven en la línea 1)
 */
@Component({
  standalone: true,
  selector: 'sg-app-subnav',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, NeonBadgeComponent],
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
                <sg-neon-badge [tone]="badgeTone(item.tone)">{{ item.badge }}</sg-neon-badge>
              }
            </a>
          }
        </nav>

        <div class="sg-game-nav__actions">
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
                <sg-neon-badge [tone]="badgeTone(item.tone)">{{ item.badge }}</sg-neon-badge>
              }
            </a>
          }
        </nav>
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
          @case ('coach') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <path d="M12 3.5 4.5 7v5c0 4.4 3.1 7.8 7.5 9 4.4-1.2 7.5-4.6 7.5-9V7L12 3.5Z"/>
              <path d="M9.5 12.2 11 13.7l3.5-3.5"/>
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
  private readonly router = inject(Router);

  readonly items = this.prefs.visibleNavItems;
  readonly roleLabel = computed(() => formatRoleLabel(this.auth.userRole()));
  readonly roleFocus = computed(() => navFocusForRole(this.auth.userRole()));
  readonly roleNavLabel = computed(() =>
    this.auth.userRole() === 'scout' ? 'Menú scout' : 'Menú jugador',
  );
  readonly game = computed(() => {
    const id = this.auth.selectedGame();
    return id ? gamePlatformMeta(id) : gamePlatformMeta('fortnite');
  });
  readonly mobileMenuOpen = signal(false);

  /** Badges de nav: oro (lime alias). Evita púrpura que pelea con la marca. */
  badgeTone(tone?: 'lime' | 'purple' | 'cyan'): 'lime' | 'cyan' | 'muted' {
    return tone === 'cyan' ? 'cyan' : 'lime';
  }

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      if (userId) this.prefs.load(userId);
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeMobileMenu());

    effect(() => {
      document.body.classList.toggle('sg-nav-lock', this.mobileMenuOpen());
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMobileMenu();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
