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
import { AppSubnavComponent, AppTopbarComponent } from '../../ui';

@Component({
  standalone: true,
  selector: 'app-shell-page',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, AppTopbarComponent, AppSubnavComponent],
  template: `
    <div
      class="sg-app-shell sg-app-shell--dual-topbar"
      [class.sg-app-shell--roblox]="activeGame() === 'roblox'"
      [class.sg-app-shell--fortnite]="activeGame() === 'fortnite'"
      [class.sg-app-shell--scrolled]="chromeScroll.isScrolled()"
      [style.--sg-chrome-scroll]="chromeScroll.scrollProgress()"
      [style.--sg-shell-glow]="shellGlow()"
    >
      <sg-app-topbar [live]="realtime.isLive()" (logout)="logout()" />
      <sg-app-subnav />
      <main class="sg-app-shell__content">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly realtime = inject(AppSyncRealtimeService);
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
