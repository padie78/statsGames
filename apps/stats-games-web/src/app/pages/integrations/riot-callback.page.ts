import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { RiotRsoService } from '../../core/game/riot-rso.service';
import { PlayerService } from '../../services/player.service';
import { extractGraphqlErrorMessage, mapLinkPlatformError } from '../../utils/graphql-error.util';

/**
 * Callback OAuth de Riot Sign-On (separado de Cognito /auth/callback).
 * Ruta: /integrations/riot/callback
 */
@Component({
  standalone: true,
  selector: 'app-riot-callback-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, IonSpinner, RouterLink],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-4 u-items-start">
        <header class="sg-page-header">
          <h1 class="sg-page-header__title">Riot Sign-On</h1>
          <p class="sg-page-header__subtitle">Vinculando tu cuenta de Valorant…</p>
        </header>

        @if (status() === 'working') {
          <div class="u-flex u-items-center u-gap-3">
            <ion-spinner name="crescent" />
            <p class="u-hint u-m-0">{{ message() }}</p>
          </div>
        } @else if (status() === 'ok') {
          <p class="u-success u-m-0">{{ message() }}</p>
          <a routerLink="/tabs/integrations" class="u-btn u-btn--primary">Ir a Integraciones</a>
        } @else {
          <p class="u-error u-m-0">{{ message() }}</p>
          <a routerLink="/tabs/integrations" class="u-btn u-btn--gold">Volver a Integraciones</a>
        }
      </div>
    </ion-content>
  `,
})
export class RiotCallbackPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly riotRso = inject(RiotRsoService);
  private readonly player = inject(PlayerService);

  readonly status = signal<'working' | 'ok' | 'error'>('working');
  readonly message = signal('Confirmando autorización con Riot…');

  async ngOnInit(): Promise<void> {
    const q = this.route.snapshot.queryParamMap;
    try {
      const userId = this.auth.userId();
      if (!userId) {
        throw new Error('Tenés que iniciar sesión en StatsGames antes de vincular Riot.');
      }

      this.message.set('Intercambiando código con Riot…');
      const account = await this.riotRso.completeLogin({
        code: q.get('code'),
        state: q.get('state'),
        error: q.get('error'),
        errorDescription: q.get('error_description'),
      });

      this.message.set(`Vinculando ${account.riotId}…`);
      await this.ensureProfile(userId);
      await firstValueFrom(
        this.player.linkPlatformAccount({
          userId,
          platform: 'valorant',
          externalId: account.riotId,
        }),
      );

      this.status.set('ok');
      this.message.set(`Valorant vinculado con Riot Sign-On: ${account.riotId}.`);
      window.setTimeout(() => {
        void this.router.navigateByUrl('/tabs/integrations');
      }, 1200);
    } catch (err) {
      this.status.set('error');
      this.message.set(
        mapLinkPlatformError(err) ||
          extractGraphqlErrorMessage(err, err instanceof Error ? err.message : 'Error en RSO'),
      );
    }
  }

  private async ensureProfile(userId: string): Promise<void> {
    const existing = await this.player.getPlayerProfileOrNull(userId);
    if (existing) return;

    const emailPrefix = (this.auth.email() ?? 'player').split('@')[0] ?? 'player';
    const gamerTag = emailPrefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'Player';
    await firstValueFrom(
      this.player.upsertPlayerProfile({
        userId,
        gamerTag,
        primaryPlatform: 'valorant',
      }),
    );
  }
}
