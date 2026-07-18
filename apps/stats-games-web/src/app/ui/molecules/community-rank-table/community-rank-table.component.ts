import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CommunityRankRow } from '../../../data/community-mock.data';
import { trackerLolProfileUrl } from '../../../utils/tracker-profile.util';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

/** snapshot = Inicio (compacto); deep = Evolución (detalle completo). */
export type CommunityRankVariant = 'snapshot' | 'deep';

@Component({
  standalone: true,
  selector: 'sg-community-rank-table',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
    <section
      class="sg-community-rank u-surface-card u-p-5"
      [class.sg-community-rank--snapshot]="isSnapshot"
      [class.sg-community-rank--deep]="!isSnapshot"
      aria-label="Ranking vs comunidad"
    >
      <header class="sg-community-rank__header">
        <div class="sg-community-rank__heading">
          <p class="sg-community-rank__eyebrow">{{ eyebrow }}</p>
          <h3 class="sg-community-rank__title">{{ title }}</h3>
          @if (subtitle) {
            <p class="sg-community-rank__subtitle u-m-0">{{ subtitle }}</p>
          }
        </div>
        <div class="sg-community-rank__meta">
          @if (yourRank > 0) {
            <sg-neon-badge tone="gold">Tu puesto #{{ yourRank }}</sg-neon-badge>
          }
          @if (sampleLabel) {
            <sg-neon-badge tone="gold">{{ sampleLabel }}</sg-neon-badge>
          }
        </div>
      </header>

      @if (!rows.length) {
        <p class="sg-community-rank__empty u-hint u-m-0">
          Todavía no hay ranking para esta semana.
        </p>
      } @else {
        @if (!isSnapshot) {
          <p class="sg-community-rank__legend u-m-0">
            Ordenado por score justo. Fila dorada = vos. Tocá un jugador para ver el detalle.
          </p>
        }
        <div class="sg-community-rank__scroll">
          <table class="sg-community-rank__table">
            <thead>
              <tr>
                <th scope="col" title="Puesto en la muestra">#</th>
                <th scope="col">Jugador</th>
                <th scope="col" [attr.title]="kdColumnLabel + ' medio de la ventana'">{{ kdColumnLabel }}</th>
                <th scope="col" title="Win rate %">WR</th>
                @if (!isSnapshot) {
                  <th scope="col" class="sg-community-rank__col--optional" title="Kills / muertes / asistencias">
                    K/D/A
                  </th>
                  <th
                    scope="col"
                    class="sg-community-rank__col--optional"
                    [attr.title]="perGameLabel + ' promedio'"
                  >
                    {{ perGameLabel }}
                  </th>
                  @if (isLol) {
                    <th scope="col" class="sg-community-rank__col--optional" title="League Points">
                      LP
                    </th>
                  }
                  <th scope="col" class="sg-community-rank__col--optional" title="Partidas en la ventana">
                    Partidas
                  </th>
                }
                <th scope="col" title="Score justo: KDA + WR + kills/partida">Score</th>
                @if (!isSnapshot) {
                  <th scope="col" class="sg-community-rank__col--delta" title="Cambio de puesto">
                    Δ puesto
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track row.rank + row.gamerTag) {
                <tr
                  class="sg-community-rank__row"
                  [class.sg-community-rank__row--you]="row.isYou"
                  [class.sg-community-rank__row--top]="row.rank <= 3 && !row.isYou"
                  [class.sg-community-rank__row--open]="expandedTag === row.gamerTag"
                >
                  <td class="sg-community-rank__rank">
                    <span [class.sg-community-rank__rank-pill--you]="row.isYou">#{{ row.rank }}</span>
                  </td>
                  <td class="sg-community-rank__player">
                    <button
                      type="button"
                      class="sg-community-rank__player-btn"
                      (click)="toggleRow(row.gamerTag)"
                      [attr.aria-expanded]="expandedTag === row.gamerTag"
                    >
                      @if (row.avatarUrl) {
                        <img
                          class="sg-community-rank__avatar"
                          [src]="row.avatarUrl"
                          [alt]="''"
                          width="28"
                          height="28"
                          loading="lazy"
                          decoding="async"
                        />
                      } @else {
                        <span class="sg-community-rank__avatar sg-community-rank__avatar--fallback" aria-hidden="true">
                          {{ row.gamerTag.slice(0, 1).toUpperCase() }}
                        </span>
                      }
                      @if (externalProfileUrl(row); as externalUrl) {
                        <a
                          class="sg-community-rank__name"
                          [href]="externalUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          [attr.title]="'Ver ' + row.gamerTag + ' en Tracker.gg'"
                          (click)="$event.stopPropagation()"
                        >
                          {{ row.gamerTag }}
                        </a>
                      } @else {
                        <a
                          [routerLink]="['/player', row.gamerTag]"
                          class="sg-community-rank__name"
                          (click)="$event.stopPropagation()"
                        >
                          {{ row.gamerTag }}
                        </a>
                      }
                      @if (row.isYou) {
                        <sg-neon-badge tone="gold">Vos</sg-neon-badge>
                      }
                      @if (externalProfileUrl(row); as externalUrl) {
                        <a
                          class="sg-community-rank__ext"
                          [href]="externalUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Abrir en Tracker.gg"
                          title="Tracker.gg"
                          (click)="$event.stopPropagation()"
                        >
                          ↗
                        </a>
                      }
                    </button>
                  </td>
                  <td>{{ formatKd(row.kd) }}</td>
                  <td>{{ row.winRate }}%</td>
                  @if (!isSnapshot) {
                    <td class="sg-community-rank__col--optional sg-community-rank__kda">
                      {{ row.kills }}/{{ row.deaths }}/{{ row.assists }}
                    </td>
                    <td class="sg-community-rank__col--optional">{{ formatKd(row.killsPerGame) }}</td>
                    @if (isLol) {
                      <td class="sg-community-rank__col--optional">
                        {{ row.leaguePoints != null ? row.leaguePoints : '—' }}
                      </td>
                    }
                    <td class="sg-community-rank__col--optional">{{ row.matches }}</td>
                  }
                  <td class="sg-community-rank__score">{{ row.score }}</td>
                  @if (!isSnapshot) {
                    <td
                      class="sg-community-rank__delta sg-community-rank__col--delta"
                      [class.sg-community-rank__delta--up]="row.trend === 'up'"
                      [class.sg-community-rank__delta--down]="row.trend === 'down'"
                    >
                      {{ row.delta }}
                    </td>
                  }
                </tr>
                @if (expandedTag === row.gamerTag) {
                  <tr class="sg-community-rank__detail-row" [class.sg-community-rank__row--you]="row.isYou">
                    <td [attr.colspan]="detailColspan">
                      <div class="sg-community-rank__detail">
                        <span><strong>{{ kdColumnLabel }}</strong> {{ formatKd(row.kd) }}</span>
                        <span><strong>WR</strong> {{ row.winRate }}%</span>
                        <span><strong>K/D/A</strong> {{ row.kills }}/{{ row.deaths }}/{{ row.assists }}</span>
                        <span><strong>{{ perGameLabel }}</strong> {{ formatKd(row.killsPerGame) }}</span>
                        @if (isLol && row.leaguePoints != null) {
                          <span><strong>LP</strong> {{ row.leaguePoints }}</span>
                        }
                        <span><strong>Partidas</strong> {{ row.matches }}</span>
                        <span><strong>Score</strong> {{ row.score }}</span>
                        @if (externalProfileUrl(row); as externalUrl) {
                          <a
                            class="sg-community-rank__detail-link"
                            [href]="externalUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ver en Tracker.gg →
                          </a>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <p class="sg-community-rank__footnote u-m-0">
          @if (isSnapshot) {
            Snapshot: {{ rows.length }} rivales cerca de tu puesto (de {{ totalPlayers }} en la muestra).
            Score = KDA + WR + kills/partida.
            @if (deepLink) {
              <a [routerLink]="deepLink" class="sg-community-rank__footnote-link">Ver ranking completo en Evolución →</a>
            }
          } @else {
            Detalle de la muestra: {{ rows.length }} de {{ totalPlayers }} jugadores.
            @if (isLol) {
              Riot ID → Tracker.gg.
            }
            Score justo = KDA + win rate + kills/partida (misma ventana; sin premio por volumen).
          }
        </p>
      }
    </section>
  `,
})
export class CommunityRankTableComponent {
  @Input() title = 'Tu lugar en la comunidad';
  @Input() subtitle = '';
  @Input() sampleLabel = '';
  @Input() rows: CommunityRankRow[] = [];
  @Input() yourRank = 0;
  @Input() totalPlayers = 0;
  /** Plataforma activa para etiquetas (KDA vs KD, Goles vs Kills). */
  @Input() platform = '';
  /** Inicio = snapshot compacto; Evolución = deep con todas las columnas. */
  @Input() variant: CommunityRankVariant = 'deep';
  /** Link opcional al detalle (solo snapshot). */
  @Input() deepLink: string | null = '/tabs/analytics';

  expandedTag: string | null = null;

  get isSnapshot(): boolean {
    return this.variant === 'snapshot';
  }

  get isLol(): boolean {
    return this.platform?.toLowerCase() === 'league_of_legends';
  }

  get eyebrow(): string {
    return this.isSnapshot ? 'Snapshot semanal' : 'Tabla de jugadores';
  }

  get detailColspan(): number {
    if (this.isSnapshot) return 5;
    return this.isLol ? 10 : 9;
  }

  get kdColumnLabel(): string {
    const p = this.platform?.toLowerCase();
    if (p === 'valorant' || p === 'league_of_legends') return 'KDA';
    return 'KD';
  }

  get perGameLabel(): string {
    const p = this.platform?.toLowerCase();
    if (p === 'rocket_league') return 'Goles/p';
    if (p === 'fortnite') return 'Elims/p';
    return 'Kills/p';
  }

  externalProfileUrl(row: CommunityRankRow): string | null {
    if (!this.isLol) return null;
    return trackerLolProfileUrl(row.gamerTag);
  }

  toggleRow(tag: string): void {
    this.expandedTag = this.expandedTag === tag ? null : tag;
  }

  formatKd(value: number): string {
    return value.toFixed(2);
  }
}
