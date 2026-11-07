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
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { APP_ACCOUNT_MENU_ITEMS } from '../../../core/navigation/app-nav.config';
import { roleLabel as formatRoleLabel } from '../../../core/auth/user-role';
import { PlayerService } from '../../../services/player.service';

/**
 * Control de cuenta — vive en la línea 1 del chrome (derecha).
 * Compacto: avatar + nombre. El menú abre con identidad + acciones.
 */
@Component({
  standalone: true,
  selector: 'sg-chrome-account',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink],
  template: `
    <div
      class="sg-chrome-account"
      [class.sg-chrome-account--open]="menuOpen()"
      [attr.data-role]="auth.userRole()"
    >
      @if (auth.isAuthenticated()) {
        <button
          type="button"
          class="sg-chrome-account__trigger"
          [attr.aria-expanded]="menuOpen()"
          aria-haspopup="true"
          aria-controls="sg-chrome-account-menu"
          aria-label="Menú de cuenta"
          (click)="toggle($event)"
        >
          <span class="sg-chrome-account__avatar" aria-hidden="true">
            <span class="sg-chrome-account__avatar-text">{{ initials() }}</span>
            <span class="sg-chrome-account__presence"></span>
          </span>
          <span class="sg-chrome-account__trigger-meta">
            <span class="sg-chrome-account__name u-truncate">{{ triggerName() }}</span>
            <span class="sg-chrome-account__role-chip">{{ roleLabel() }}</span>
          </span>
          <span class="sg-chrome-account__caret" aria-hidden="true"></span>
        </button>

        @if (menuOpen()) {
          <div
            id="sg-chrome-account-menu"
            class="sg-chrome-account__menu"
            role="menu"
            aria-label="Cuenta"
          >
            <div class="sg-chrome-account__head">
              <span class="sg-chrome-account__avatar sg-chrome-account__avatar--lg" aria-hidden="true">
                <span class="sg-chrome-account__avatar-text">{{ initials() }}</span>
                <span class="sg-chrome-account__presence"></span>
              </span>
              <div class="sg-chrome-account__identity">
                <p class="sg-chrome-account__display u-truncate u-m-0">{{ displayName() }}</p>
                @if (secondaryEmail(); as email) {
                  <p class="sg-chrome-account__email u-truncate u-m-0">{{ email }}</p>
                }
              </div>
            </div>

            <div class="sg-chrome-account__group" role="none">
              @if (profileRoute(); as profilePath) {
                <a
                  class="sg-chrome-account__item"
                  role="menuitem"
                  [routerLink]="profilePath"
                  (click)="close()"
                >
                  <span class="sg-chrome-account__item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
                      <circle cx="12" cy="8" r="3.25"/>
                      <path d="M5.5 19.25c1.6-3.1 4-4.65 6.5-4.65s4.9 1.55 6.5 4.65"/>
                    </svg>
                  </span>
                  <span class="sg-chrome-account__item-copy">
                    <span class="sg-chrome-account__item-label">Perfil público</span>
                    <span class="sg-chrome-account__item-hint">Cómo te ven los scouts</span>
                  </span>
                </a>
              }
              @for (item of accountItems; track item.id) {
                <a
                  class="sg-chrome-account__item"
                  role="menuitem"
                  [routerLink]="item.route"
                  (click)="close()"
                >
                  <span class="sg-chrome-account__item-icon" aria-hidden="true">
                    @if (item.id === 'settings') {
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.05 6.05l1.55 1.55M16.4 16.4l1.55 1.55M17.95 6.05l-1.55 1.55M7.6 16.4l-1.55 1.55"/>
                      </svg>
                    } @else if (item.id === 'integrations') {
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M8.5 7.5h7v9h-7z"/>
                        <path d="M5.5 10v4M18.5 10v4"/>
                        <path d="M8.5 12h7"/>
                      </svg>
                    } @else {
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M5 12h14M13 6l6 6-6 6"/>
                      </svg>
                    }
                  </span>
                  <span class="sg-chrome-account__item-copy">
                    <span class="sg-chrome-account__item-label">{{ item.label }}</span>
                    <span class="sg-chrome-account__item-hint">{{ accountItemHint(item.id) }}</span>
                  </span>
                </a>
              }
            </div>

            <div class="sg-chrome-account__footer" role="none">
              <button
                type="button"
                class="sg-chrome-account__item sg-chrome-account__item--danger"
                role="menuitem"
                (click)="onLogout()"
              >
                <span class="sg-chrome-account__item-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"/>
                    <path d="M10 12h9"/>
                    <path d="M15.5 8.5 19 12l-3.5 3.5"/>
                  </svg>
                </span>
                <span class="sg-chrome-account__item-copy">
                  <span class="sg-chrome-account__item-label">Cerrar sesión</span>
                </span>
              </button>
            </div>
          </div>
        }
      } @else {
        <a routerLink="/login" class="sg-chrome-account__login">Iniciar sesión</a>
      }
    </div>
  `,
})
export class ChromeAccountComponent {
  readonly auth = inject(AuthService);
  private readonly playerService = inject(PlayerService);

  @Output() readonly logout = new EventEmitter<void>();

  readonly accountItems = APP_ACCOUNT_MENU_ITEMS;
  readonly menuOpen = signal(false);
  readonly gamerTag = signal<string | null>(null);

  readonly roleLabel = computed(() => formatRoleLabel(this.auth.userRole()));
  readonly displayName = computed(() => {
    const tag = this.gamerTag()?.trim();
    if (tag) return tag;
    const email = this.auth.email()?.trim();
    if (email) return email;
    return 'Cuenta';
  });
  /** Nombre corto para el trigger del chrome (evita emails largos en la barra). */
  readonly triggerName = computed(() => {
    const tag = this.gamerTag()?.trim();
    if (tag) return tag;
    const email = this.auth.email()?.trim();
    if (!email) return 'Cuenta';
    return email.split('@')[0] || email;
  });
  /** Email secundario solo si el título es un gamer tag distinto. */
  readonly secondaryEmail = computed(() => {
    const email = this.auth.email()?.trim() ?? null;
    if (!email) return null;
    return email === this.displayName() ? null : email;
  });
  readonly profileRoute = computed(() => {
    const tag = this.gamerTag();
    return tag ? `/player/${encodeURIComponent(tag)}` : null;
  });

  constructor() {
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
  }

  initials(): string {
    const tag = this.gamerTag();
    if (tag) return tag.slice(0, 2).toUpperCase();
    const email = this.auth.email();
    if (!email) return 'SG';
    return email.slice(0, 2).toUpperCase();
  }

  accountItemHint(id: string): string {
    if (id === 'settings') return 'Preferencias y privacidad';
    if (id === 'integrations') return 'Riot, Steam y cuentas';
    return '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.sg-chrome-account')) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  close(): void {
    this.menuOpen.set(false);
  }

  onLogout(): void {
    this.close();
    this.logout.emit();
  }
}
