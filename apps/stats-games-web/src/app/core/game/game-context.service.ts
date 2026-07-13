import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { PlayerService } from '../../services/player.service';
import {
  backendPlatformForGame,
  type SelectedGame,
} from './selected-game';
import { gamePlatformMeta } from './game-platform.config';

/**
 * Contexto global del juego activo — sincroniza Cognito, perfil y UI.
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
  readonly activeMeta = computed(() => gamePlatformMeta(this.activeGame()));

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
            primaryPlatform: backendPlatformForGame(game),
            fortniteId: profile.fortniteId ?? undefined,
            robloxId: profile.robloxId ?? undefined,
            valorantId: profile.valorantId ?? undefined,
            leagueOfLegendsId: profile.leagueOfLegendsId ?? undefined,
            cs2Id: profile.cs2Id ?? undefined,
            rocketLeagueId: profile.rocketLeagueId ?? undefined,
          }),
        ).catch(() => undefined);
      });
    } finally {
      this._switching.set(false);
    }
  }
}
