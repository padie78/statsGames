import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import { NeonBadgeComponent } from '../../ui';

@Component({
  standalone: true,
  selector: 'app-settings-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, NeonBadgeComponent],
  template: `
    <ion-content class="ion-padding">
      <div class="page-shell u-flex u-flex-col u-gap-4 u-py-4">
        <section class="u-surface-card u-p-5">
          <sg-neon-badge tone="lime">CUENTA</sg-neon-badge>
          <h2 class="u-font-display u-text-lg u-fw-bold u-mt-3 u-mb-4">Configuración</h2>

          <dl class="sg-settings-list">
            <div class="sg-settings-list__row">
              <dt>Email</dt>
              <dd>{{ auth.email() ?? '—' }}</dd>
            </div>
            <div class="sg-settings-list__row">
              <dt>Juego activo</dt>
              <dd>{{ gameLabel() }}</dd>
            </div>
            <div class="sg-settings-list__row">
              <dt>Gamer tag</dt>
              <dd>{{ profile()?.gamerTag ?? '—' }}</dd>
            </div>
            <div class="sg-settings-list__row">
              <dt>User ID</dt>
              <dd class="u-font-mono u-text-xs">{{ auth.userId() ?? '—' }}</dd>
            </div>
          </dl>
        </section>

        <section class="u-surface-card u-p-5">
          <h3 class="u-font-display u-text-sm u-fw-bold u-uppercase u-mb-3">Sesión</h3>
          <button type="button" class="u-btn u-btn--ghost u-btn--block" (click)="logout()">
            Cerrar sesión
          </button>
        </section>
      </div>
    </ion-content>
  `,
})
export class SettingsPageComponent {
  readonly auth = inject(AuthService);
  private readonly player = inject(PlayerService);
  private readonly router = inject(Router);
  private readonly realtime = inject(AppSyncRealtimeService);

  readonly profile = signal<PlayerProfileView | null>(null);

  constructor() {
    void this.loadProfile();
  }

  gameLabel(): string {
    const game = this.auth.selectedGame();
    if (game === 'fortnite') return 'Fortnite';
    if (game === 'roblox') return 'Roblox';
    return '—';
  }

  async logout(): Promise<void> {
    this.realtime.reset();
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  private async loadProfile(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    const profile = await this.player.getPlayerProfileOrNull(userId);
    this.profile.set(profile);
  }
}
