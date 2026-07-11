import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CommunityRankRow } from '../../../data/community-mock.data';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

@Component({
  standalone: true,
  selector: 'sg-community-rank-table',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
    <section class="sg-community-rank u-surface-card u-p-5" aria-label="Ranking vs comunidad">
      <header class="sg-community-rank__header">
        <div class="sg-community-rank__heading">
          <p class="sg-community-rank__eyebrow">Ranking semanal</p>
          <h3 class="sg-community-rank__title">{{ title }}</h3>
          @if (subtitle) {
            <p class="sg-community-rank__subtitle u-m-0">{{ subtitle }}</p>
          }
        </div>
        <div class="sg-community-rank__meta">
          @if (yourRank > 0) {
            <sg-neon-badge tone="lime">Tu puesto #{{ yourRank }}</sg-neon-badge>
          }
          @if (sampleLabel) {
            <sg-neon-badge tone="cyan">{{ sampleLabel }}</sg-neon-badge>
          }
        </div>
      </header>

      @if (!rows.length) {
        <p class="sg-community-rank__empty u-hint u-m-0">
          Todavía no hay ranking para esta semana.
        </p>
      } @else {
        <div class="sg-community-rank__scroll">
          <table class="sg-community-rank__table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Jugador</th>
                <th scope="col" class="sg-community-rank__col--optional">KD</th>
                <th scope="col" class="sg-community-rank__col--optional">WR</th>
                <th scope="col" class="sg-community-rank__col--optional">Kills</th>
                <th scope="col" class="sg-community-rank__col--optional">Partidas</th>
                <th scope="col">Score</th>
                <th scope="col" class="sg-community-rank__col--delta">Δ</th>
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
                      <a
                        [routerLink]="['/player', row.gamerTag]"
                        class="sg-community-rank__name"
                        (click)="$event.stopPropagation()"
                      >
                        {{ row.gamerTag }}
                      </a>
                      @if (row.isYou) {
                        <sg-neon-badge tone="lime">Vos</sg-neon-badge>
                      }
                    </button>
                  </td>
                  <td class="sg-community-rank__col--optional">{{ formatKd(row.kd) }}</td>
                  <td class="sg-community-rank__col--optional">{{ row.winRate }}%</td>
                  <td class="sg-community-rank__col--optional">{{ row.kills }}</td>
                  <td class="sg-community-rank__col--optional">{{ row.matches }}</td>
                  <td class="sg-community-rank__score">{{ row.score }}</td>
                  <td
                    class="sg-community-rank__delta sg-community-rank__col--delta"
                    [class.sg-community-rank__delta--up]="row.trend === 'up'"
                    [class.sg-community-rank__delta--down]="row.trend === 'down'"
                  >
                    {{ row.delta }}
                  </td>
                </tr>
                @if (expandedTag === row.gamerTag) {
                  <tr class="sg-community-rank__detail-row" [class.sg-community-rank__row--you]="row.isYou">
                    <td colspan="8">
                      <div class="sg-community-rank__detail">
                        <span><strong>KD</strong> {{ formatKd(row.kd) }}</span>
                        <span><strong>WR</strong> {{ row.winRate }}%</span>
                        <span><strong>Kills</strong> {{ row.kills }}</span>
                        <span><strong>Partidas</strong> {{ row.matches }}</span>
                        <span><strong>Δ</strong> {{ row.delta }}</span>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <p class="sg-community-rank__footnote u-m-0">
          Mostramos jugadores cerca de tu puesto ({{ rows.length }} de {{ totalPlayers }} en el board).
          Score = KD + win rate + kills + volumen de partidas.
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

  expandedTag: string | null = null;

  toggleRow(tag: string): void {
    this.expandedTag = this.expandedTag === tag ? null : tag;
  }

  formatKd(value: number): string {
    return value.toFixed(2);
  }
}
