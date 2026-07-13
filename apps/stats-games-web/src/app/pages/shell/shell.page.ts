import {
  Component,
  DestroyRef,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AppChromeScrollService } from '../../core/chrome/app-chrome-scroll.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { MatchNotificationsStore } from '../../stores/match-notifications.store';
import {
  AppSubnavComponent,
  GamePlatformSwitcherComponent,
  MatchNotificationToastComponent,
} from '../../ui';

@Component({
  standalone: true,
  selector: 'app-shell-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    RouterOutlet,
    GamePlatformSwitcherComponent,
    AppSubnavComponent,
    MatchNotificationToastComponent,
  ],
  template: `
    <div
      class="sg-app-shell sg-app-shell--trn"
      [attr.data-game]="activeGame() ?? 'fortnite'"
      [attr.data-role]="auth.userRole()"
      [class.sg-app-shell--scrolled]="chromeScroll.isScrolled()"
      [style.--sg-chrome-scroll]="chromeScroll.scrollProgress()"
      [style.--sg-shell-glow]="shellGlow()"
    >
      <div class="sg-app-shell__chrome">
        <!-- 1) Logo + games -->
        <sg-game-platform-switcher />
        <!-- 2) Game tabs + per-game search + account -->
        <div class="sg-app-shell__header-block">
          <sg-app-subnav (logout)="logout()" />
        </div>
      </div>
      <main class="sg-app-shell__content">
        <router-outlet />
      </main>
      <sg-match-notification-toast />
    </div>
  `,
})
export class ShellPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly realtime = inject(AppSyncRealtimeService);
  private readonly notifications = inject(MatchNotificationsStore);
  readonly chromeScroll = inject(AppChromeScrollService);

  readonly activeGame = computed(() => this.auth.selectedGame());
  readonly shellGlow = computed(() => gamePlatformMeta(this.activeGame()).shellGlow);

  private scrollCleanup: (() => void) | null = null;

  ngOnInit(): void {
    this.realtime.ensureConnected();

    this.destroyRef.onDestroy(() => this.scrollCleanup?.());

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.chromeScroll.reset();
        requestAnimationFrame(() => void this.bindPageScroll());
      });

    requestAnimationFrame(() => void this.bindPageScroll());
  }

  async logout(): Promise<void> {
    this.notifications.reset();
    this.realtime.reset();
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  private async bindPageScroll(): Promise<void> {
    this.scrollCleanup?.();
    this.scrollCleanup = null;

    const ionContent = document.querySelector(
      '.sg-app-shell__content ion-content.sg-page-content, .sg-app-shell__content ion-content.sg-home-content',
    ) as (HTMLElement & { getScrollElement?: () => Promise<HTMLElement> }) | null;

    if (!ionContent?.getScrollElement) {
      this.chromeScroll.reset();
      return;
    }

    const scrollEl = await ionContent.getScrollElement();
    const onScroll = (): void => this.chromeScroll.setScrollTop(scrollEl.scrollTop);

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    this.scrollCleanup = () => scrollEl.removeEventListener('scroll', onScroll);
  }
}

export { ShellPageComponent as TabsPageComponent };
