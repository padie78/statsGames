import { Component, ViewEncapsulation, inject } from '@angular/core';
import { AuthService, type SelectedGame } from '../../../core/services/auth.service';
import { GameContextService } from '../../../core/game/game-context.service';
import { GAME_PLATFORM_LIST } from '../../../core/game/game-platform.config';

@Component({
  standalone: true,
  selector: 'sg-game-platform-switcher',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="sg-platform-switch"
      role="tablist"
      aria-label="Seleccionar plataforma"
      [class.sg-platform-switch--loading]="gameContext.switching()"
    >
      @for (platform of platforms; track platform.id) {
        <button
          type="button"
          role="tab"
          class="sg-platform-switch__btn"
          [class.sg-platform-switch__btn--active]="auth.selectedGame() === platform.id"
          [class.sg-platform-switch__btn--roblox]="platform.id === 'roblox'"
          [class.sg-platform-switch__btn--fortnite]="platform.id === 'fortnite'"
          [attr.aria-selected]="auth.selectedGame() === platform.id"
          [disabled]="gameContext.switching()"
          (click)="select(platform.id)"
        >
          <span
            class="sg-platform-switch__thumb"
            [style.background-image]="'url(' + platform.artUrl + ')'"
            aria-hidden="true"
          ></span>
          <span class="sg-platform-switch__label">{{ platform.label }}</span>
        </button>
      }
    </div>
  `,
})
export class GamePlatformSwitcherComponent {
  readonly auth = inject(AuthService);
  readonly gameContext = inject(GameContextService);
  readonly platforms = GAME_PLATFORM_LIST;

  select(game: SelectedGame): void {
    void this.gameContext.switchPlatform(game);
  }
}
