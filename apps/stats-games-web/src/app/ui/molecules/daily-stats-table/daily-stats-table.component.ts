import { Component, Input, ViewEncapsulation } from '@angular/core';

export interface DailyStatsTableRow {
  periodId: string;
  label: string;
  matchCount: number;
  kills: number;
  deaths: number;
  kd: string;
  avgPlacement: string;
  killsPerMatch: string;
}

@Component({
  standalone: true,
  selector: 'sg-daily-stats-table',
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="sg-daily-table u-surface-card u-p-5" [attr.aria-label]="title">
      <header class="sg-daily-table__header">
        <div>
          <p class="sg-daily-table__eyebrow">Detalle diario</p>
          <h3 class="sg-daily-table__title">{{ title }}</h3>
          @if (subtitle) {
            <p class="sg-daily-table__subtitle u-m-0">{{ subtitle }}</p>
          }
        </div>
        @if (footnote) {
          <p class="sg-daily-table__meta u-m-0">{{ footnote }}</p>
        }
      </header>

      @if (!rows.length) {
        <p class="sg-daily-table__empty u-hint u-m-0">Sin días con actividad en el período.</p>
      } @else {
        <div class="sg-daily-table__scroll">
          <table class="sg-daily-table__table">
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Partidas</th>
                <th scope="col">Kills</th>
                <th scope="col" class="sg-daily-table__col--optional">Deaths</th>
                <th scope="col">K/D</th>
                <th scope="col" class="sg-daily-table__col--optional">K/partida</th>
                <th scope="col">Placement</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track row.periodId) {
                <tr [class.sg-daily-table__row--active]="row.matchCount > 0">
                  <th scope="row">{{ row.label }}</th>
                  <td>{{ row.matchCount }}</td>
                  <td>{{ row.kills }}</td>
                  <td class="sg-daily-table__col--optional">{{ row.deaths }}</td>
                  <td>{{ row.kd }}</td>
                  <td class="sg-daily-table__col--optional">{{ row.killsPerMatch }}</td>
                  <td>{{ row.avgPlacement }}</td>
                </tr>
              }
            </tbody>
            @if (totals) {
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{{ totals.matchCount }}</td>
                  <td>{{ totals.kills }}</td>
                  <td class="sg-daily-table__col--optional">{{ totals.deaths }}</td>
                  <td>{{ totals.kd }}</td>
                  <td class="sg-daily-table__col--optional">{{ totals.killsPerMatch }}</td>
                  <td>{{ totals.avgPlacement }}</td>
                </tr>
              </tfoot>
            }
          </table>
        </div>
      }
    </section>
  `,
})
export class DailyStatsTableComponent {
  @Input() title = 'Desglose por día';
  @Input() subtitle = 'Actividad diaria de los últimos 7 días.';
  @Input() footnote = '';
  @Input() rows: DailyStatsTableRow[] = [];
  @Input() totals: DailyStatsTableRow | null = null;
}
