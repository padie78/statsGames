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
import { navFocusForRole } from '../../../core/navigation/app-nav.config';
import { roleLabel as formatRoleLabel } from '../../../core/auth/user-role';
import { PlayerService } from '../../../services/player.service';

/**
 * Control de cuenta OP.GG-style — vive en la línea 1 del chrome (derecha).
 * Compacto: avatar + caret. El menú abre con identidad + acciones.
 */
@Component({
  standalone: true,
  selector: 'sg-chrome-account',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink],
  template: `
    <div class="sg-chrome-account" [class.sg-chrome-account--open]="menuOpen()">
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
          <span class="sg-chrome-account__avatar" aria-hidden="true">{{ initials() }}</span>
          <span class="sg-chrome-account__name u-truncate">{{ displayName() }}</span>
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
              <span class="sg-chrome-account__avatar sg-chrome-account__avatar--lg">{{ initials() }}</span>
              <div class="sg-chrome-account__identity">
                <p class="sg-chrome-account__display u-truncate u-m-0">{{ displayName() }}</p>
                @if (auth.email(); as email) {
                  <p class="sg-chrome-account__email u-truncate u-m-0">{{ email }}</p>
                }
                <p class="sg-chrome-account__badge u-m-0">{{ roleLabel() }} · {{ roleFocus() }}</p>
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
                  <span class="sg-chrome-account__item-label">Perfil público</span>
                  <span class="sg-chrome-account__item-hint">Cómo te ven los scouts</span>
                </a>
              }
              @for (item of accountItems; track item.id) {
                <a
                  class="sg-chrome-account__item"
                  role="menuitem"
                  [routerLink]="item.route"
                  (click)="close()"
                >
                  <span class="sg-chrome-account__item-label">{{ item.label }}</span>
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
                <span class="sg-chrome-account__item-label">Cerrar sesión</span>
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
  readonly roleFocus = computed(() => navFocusForRole(this.auth.userRole()));
  readonly displayName = computed(
    () => this.gamerTag() || this.auth.email()?.split('@')[0] || 'Cuenta',
  );
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
