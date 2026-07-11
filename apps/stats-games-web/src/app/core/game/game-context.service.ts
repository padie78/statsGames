import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService, type SelectedGame } from '../services/auth.service';
import { PlayerService } from '../../services/player.service';

/**
 * Contexto global del juego activo — sincroniza Cognito, perfil y UI.
 * Las páginas pueden reaccionar a `refreshTick` para recargar stats.
 */
@Injectable({ providedIn: 'root' })
export class GameContextService {
  private readonly auth = inject(AuthService);
  private readonly player = inject(PlayerService);

  private readonly _refreshTick = signal(0);
  private readonly _switching = signal(false);

  readonly refreshTick = computed(() => this._refreshTick());
  readonly switching = computed(() => this._switching());
  readonly activeGame = computed(() => this.auth.selectedGame());

  async switchPlatform(game: SelectedGame): Promise<void> {
    if (this.auth.selectedGame() === game) return;

    this._switching.set(true);
    try {
      await this.auth.updateSelectedGame(game);
      this._refreshTick.update((n) => n + 1);

      const userId = this.auth.userId();
      if (!userId) return;

      void this.player.getPlayerProfileOrNull(userId).then((profile) => {
        if (!profile) return;
        void firstValueFrom(
          this.player.upsertPlayerProfile({
            userId,
            gamerTag: profile.gamerTag,
            primaryPlatform: game,
            fortniteId: profile.fortniteId ?? undefined,
            robloxId: profile.robloxId ?? undefined,
          }),
        ).catch(() => undefined);
      });
    } finally {
      this._switching.set(false);
    }
  }
}
