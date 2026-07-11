import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import {
  GAME_PLATFORMS,
  type GamePlatformMeta,
} from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'sg-game-selection-card',
  encapsulation: ViewEncapsulation.None,
  template: `
    <button
      type="button"
      class="sg-game-tile"
      [class.sg-game-tile--selected]="selected"
      [attr.data-game]="game"
      [attr.aria-pressed]="selected"
      (click)="select.emit(game)"
    >
      <div class="sg-game-tile__art-wrap">
        @if (meta.artUrl) {
          <img
            class="sg-game-tile__art"
            [src]="meta.artUrl"
            [alt]="meta.label"
          />
        }
        <span class="sg-game-tile__art-overlay" aria-hidden="true"></span>
        @if (meta.iconUrl) {
          <img
            class="sg-game-tile__platform-icon"
            [src]="meta.iconUrl"
            [alt]="meta.label + ' icon'"
            aria-hidden="true"
          />
        }
      </div>

      <div class="sg-game-tile__body">
        <span class="sg-game-tile__glow" aria-hidden="true"></span>
        <span class="sg-game-tile__badge">{{ meta.badge }}</span>
        <span class="sg-game-tile__title">{{ meta.label }}</span>
        <span class="sg-game-tile__subtitle">{{ meta.tagline }}</span>
        <span class="sg-game-tile__stats">{{ meta.statsHint }}</span>
      </div>
    </button>
  `,
})
export class GameSelectionCardComponent {
  @Input({ required: true }) game!: SelectedGame;
  @Input() selected = false;

  @Output() readonly select = new EventEmitter<SelectedGame>();

  get meta(): GamePlatformMeta {
    return GAME_PLATFORMS[this.game];
  }
}
