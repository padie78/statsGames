import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  GAME_PLATFORMS,
  gamePlatformMeta,
} from '../../../core/game/game-platform.config';
import {
  isRobloxExperienceGame,
  type SelectedGame,
} from '../../../core/game/selected-game';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

@Component({
  standalone: true,
  selector: 'sg-integration-status-card',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
    <section class="sg-integration-status u-surface-card u-p-5">
      <header class="sg-panel-header">
        <h2 class="sg-panel-header__title">Conexiones</h2>
        <a routerLink="/tabs/integrations" class="sg-panel-header__link">Gestionar</a>
      </header>

      <div class="sg-integration-status__rows">
        @for (row of rows; track row.id) {
          <div class="sg-integration-status__row">
            <div class="sg-integration-status__brand">
              <img class="sg-integration-status__icon" [src]="row.iconUrl" [alt]="row.label" />
              <span>{{ row.label }}</span>
            </div>
            <sg-neon-badge [tone]="row.connected ? 'lime' : 'muted'">
              {{ row.connected ? 'Conectado' : 'Pendiente' }}
            </sg-neon-badge>
          </div>
        }
        <div class="sg-integration-status__row">
          <span>Live feed</span>
          <sg-neon-badge [tone]="liveActive ? 'cyan' : 'muted'" [pulse]="liveActive">
            {{ liveActive ? 'Activo' : 'Idle' }}
          </sg-neon-badge>
        </div>
      </div>
    </section>
  `,
})
export class IntegrationStatusCardComponent {
  @Input() valorantConnected = false;
  @Input() leagueOfLegendsConnected = false;
  @Input() cs2Connected = false;
  @Input() dota2Connected = false;
  @Input() overwatch2Connected = false;
  @Input() rocketLeagueConnected = false;
  @Input() fortniteConnected = false;
  @Input() clashRoyaleConnected = false;
  @Input() brawlStarsConnected = false;
  @Input() robloxConnected = false;
  @Input() liveActive = false;

  get rows(): { id: string; label: string; iconUrl: string; connected: boolean }[] {
    return [
      {
        id: 'valorant',
        label: 'Valorant',
        iconUrl: GAME_PLATFORMS.valorant.iconUrl,
        connected: this.valorantConnected,
      },
      {
        id: 'league_of_legends',
        label: 'League of Legends',
        iconUrl: GAME_PLATFORMS.league_of_legends.iconUrl,
        connected: this.leagueOfLegendsConnected,
      },
      {
        id: 'cs2',
        label: 'Counter-Strike 2',
        iconUrl: GAME_PLATFORMS.cs2.iconUrl,
        connected: this.cs2Connected,
      },
      {
        id: 'dota2',
        label: 'Dota 2',
        iconUrl: GAME_PLATFORMS.dota2.iconUrl,
        connected: this.dota2Connected,
      },
      {
        id: 'overwatch2',
        label: 'Overwatch 2',
        iconUrl: GAME_PLATFORMS.overwatch2.iconUrl,
        connected: this.overwatch2Connected,
      },
      {
        id: 'rocket_league',
        label: 'Rocket League',
        iconUrl: GAME_PLATFORMS.rocket_league.iconUrl,
        connected: this.rocketLeagueConnected,
      },
      {
        id: 'fortnite',
        label: 'Fortnite',
        iconUrl: GAME_PLATFORMS.fortnite.iconUrl,
        connected: this.fortniteConnected,
      },
      {
        id: 'clash_royale',
        label: 'Clash Royale',
        iconUrl: GAME_PLATFORMS.clash_royale.iconUrl,
        connected: this.clashRoyaleConnected,
      },
      {
        id: 'brawl_stars',
        label: 'Brawl Stars',
        iconUrl: GAME_PLATFORMS.brawl_stars.iconUrl,
        connected: this.brawlStarsConnected,
      },
      {
        id: 'roblox',
        label: 'Roblox (BF / AM / BH)',
        iconUrl: GAME_PLATFORMS.blox_fruits.iconUrl,
        connected: this.robloxConnected,
      },
    ];
  }
}

/** Helper for dual-strip connection checks. */
export function isGameAccountConnected(
  game: SelectedGame,
  ids: {
    valorantId?: string | null;
    leagueOfLegendsId?: string | null;
    cs2Id?: string | null;
    dota2Id?: string | null;
    overwatch2Id?: string | null;
    rocketLeagueId?: string | null;
    fortniteId?: string | null;
    clashRoyaleId?: string | null;
    brawlStarsId?: string | null;
    robloxId?: string | null;
  },
): boolean {
  if (game === 'valorant') return !!ids.valorantId;
  if (game === 'league_of_legends') return !!ids.leagueOfLegendsId;
  if (game === 'cs2') return !!ids.cs2Id;
  if (game === 'dota2') return !!ids.dota2Id;
  if (game === 'overwatch2') return !!ids.overwatch2Id;
  if (game === 'rocket_league') return !!ids.rocketLeagueId;
  if (game === 'fortnite') return !!ids.fortniteId;
  if (game === 'clash_royale') return !!ids.clashRoyaleId;
  if (game === 'brawl_stars') return !!ids.brawlStarsId;
  if (isRobloxExperienceGame(game)) return !!ids.robloxId;
  return false;
}

export function shortBadgeForGame(game: SelectedGame): string {
  return gamePlatformMeta(game).shortLabel;
}
