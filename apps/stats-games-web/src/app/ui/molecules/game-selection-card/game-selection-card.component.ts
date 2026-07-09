import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

export type GameSelection = 'roblox' | 'fortnite';

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
      <span class="sg-game-tile__glow" aria-hidden="true"></span>
      <span class="sg-game-tile__badge">{{ badge }}</span>
      <span class="sg-game-tile__title">{{ title }}</span>
      <span class="sg-game-tile__subtitle">{{ subtitle }}</span>
      <span class="sg-game-tile__stats">{{ stats }}</span>
    </button>
  `,
})
export class GameSelectionCardComponent {
  @Input({ required: true }) game!: GameSelection;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) subtitle!: string;
  @Input({ required: true }) stats!: string;
  @Input({ required: true }) badge!: string;
  @Input() selected = false;

  @Output() readonly select = new EventEmitter<GameSelection>();
}
