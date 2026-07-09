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
      [class.sg-game-tile--roblox]="game === 'roblox'"
      [class.sg-game-tile--fortnite]="game === 'fortnite'"
      [attr.aria-pressed]="selected"
      (click)="select.emit(game)"
    >
      <div class="sg-game-tile__art" [style.background-image]="'url(' + meta.artUrl + ')'">
        <span class="sg-game-tile__art-overlay"></span>
        <span class="sg-game-tile__icon">{{ game === 'roblox' ? '◆' : '◎' }}</span>
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
