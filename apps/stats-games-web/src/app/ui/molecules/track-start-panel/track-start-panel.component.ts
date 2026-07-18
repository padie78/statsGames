import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  GAME_PLATFORMS,
  gamePlatformMeta,
  type GamePlatformMeta,
} from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/game/selected-game';

/**
 * Panel de onboarding visual cuando todavía no hay telemetría conectada.
 */
@Component({
  standalone: true,
  selector: 'sg-track-start-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink],
  template: `
    <section class="sg-track-start" [attr.data-game]="platform()">
      <div
        class="sg-track-start__art"
        [style.background-image]="'url(' + artUrl() + ')'"
        role="presentation"
      ></div>
      <div class="sg-track-start__veil" aria-hidden="true"></div>

      <div class="sg-track-start__body">
        <div class="sg-track-start__copy">
          <p class="sg-track-start__eyebrow">Primer paso</p>
          <h2 class="sg-track-start__title">{{ title() }}</h2>
          <p class="sg-track-start__lede">
            @if (platform() === 'valorant') {
              En Valorant los perfiles nacen privados. Riot bloquea matchlist/match-v1 con API key a
              menos que uses Riot Sign-On o pongas el historial en Público. StatsGames importa
              partidas solo con ese permiso.
            } @else {
              StatsGames importa tus partidas de
              <strong>{{ meta().label }}</strong>
              para armar KPIs, evolución y análisis semanal automático. Sin una cuenta vinculada no
              hay telemetría en vivo: solo vas a ver previews del producto.
            }
          </p>

          <details
            class="sg-track-start__guide"
            [open]="guideOpen()"
            (toggle)="onGuideToggle($event)"
          >
            <summary class="sg-track-start__guide-summary">
              <span class="sg-track-start__guide-icon" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span>{{ guideSummary() }}</span>
              <span class="sg-track-start__guide-caret" aria-hidden="true"></span>
            </summary>
            <ol class="sg-track-start__steps">
              @if (platform() === 'valorant') {
                <li>
                  <strong>Autorizá</strong>
                  con Riot Sign-On (recomendado) o poné el historial en Público en tu cuenta Riot /
                  Tracker.
                </li>
                <li>
                  <strong>Vinculá</strong>
                  desde Integraciones: RSO o Riot ID
                  <code>Nombre#TAG</code>
                  con el checkbox de privacidad.
                </li>
                <li>
                  <strong>Jugá</strong>
                  y revisá Inicio, Partidas y Coach IA cuando el poller importe telemetría (≤3 min).
                </li>
              } @else {
                <li>
                  <strong>Vinculá</strong>
                  Riot, Steam, Epic o Roblox desde Integraciones (un click por plataforma).
                </li>
                <li>
                  <strong>Jugá</strong>
                  una o dos partidas normales; el poller las importa solo, sin subir replays.
                </li>
                <li>
                  <strong>Revisá</strong>
                  Inicio, Partidas, Evolución y Coach IA con tus datos reales de la semana.
                </li>
              }
            </ol>
          </details>

          <div class="sg-track-start__platforms" aria-label="Juegos soportados">
            @for (item of platforms; track item.id) {
              <span
                class="sg-track-start__chip"
                [class.sg-track-start__chip--active]="item.id === platform()"
                [attr.title]="item.label"
              >
                <img [src]="item.iconUrl" [alt]="" width="22" height="22" aria-hidden="true" />
                <span>{{ item.shortLabel }}</span>
              </span>
            }
          </div>

          <div class="sg-track-start__actions">
            <a routerLink="/tabs/integrations" class="u-btn u-btn--primary">{{ ctaLabel() }}</a>
            <a routerLink="/tabs/matches" class="u-btn u-btn--ghost">Ver partidas de ejemplo</a>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class TrackStartPanelComponent {
  readonly platform = input<SelectedGame>('fortnite');

  readonly guideOpen = signal(true);

  readonly platforms: GamePlatformMeta[] = [
    GAME_PLATFORMS.valorant,
    GAME_PLATFORMS.league_of_legends,
    GAME_PLATFORMS.cs2,
    GAME_PLATFORMS.dota2,
    GAME_PLATFORMS.overwatch2,
    GAME_PLATFORMS.rocket_league,
    GAME_PLATFORMS.fortnite,
    GAME_PLATFORMS.clash_royale,
    GAME_PLATFORMS.brawl_stars,
    GAME_PLATFORMS.blox_fruits,
  ];

  readonly meta = computed(() => gamePlatformMeta(this.platform()));
  readonly artUrl = computed(() => this.meta().portraitUrl || this.meta().artUrl);

  readonly title = computed(() =>
    this.platform() === 'valorant'
      ? 'Autorizá Valorant (privado por defecto)'
      : 'Conectá tu cuenta y empezá a trackear',
  );

  readonly guideSummary = computed(() =>
    this.platform() === 'valorant' ? 'Cómo desbloquear Valorant' : 'Cómo funciona en 3 pasos',
  );

  readonly ctaLabel = computed(() =>
    this.platform() === 'valorant' ? 'Conectar Valorant' : 'Conectar cuenta',
  );

  onGuideToggle(event: Event): void {
    const el = event.target as HTMLDetailsElement;
    this.guideOpen.set(el.open);
  }
}
