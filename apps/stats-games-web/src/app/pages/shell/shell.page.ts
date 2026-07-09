import { Component, OnInit, ViewEncapsulation, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
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
  readonly realtime = inject(AppSyncRealtimeService);

  readonly activeGame = computed(() => this.auth.selectedGame());
  readonly shellGlow = computed(() => gamePlatformMeta(this.activeGame()).shellGlow);

  ngOnInit(): void {
    this.realtime.ensureConnected();
  }

  async logout(): Promise<void> {
    this.realtime.reset();
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}

export { ShellPageComponent as TabsPageComponent };
