import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { gamePlatformMeta } from '../../core/game/game-platform.config';
import { NeonBadgeComponent } from '../../ui';

interface TalentHit {
  gamerTag: string;
  rank: string;
  kd: number;
  winRate: number;
  resilience: number;
  region: string;
}

const MOCK_TALENT: TalentHit[] = [
  { gamerTag: 'NovaPulse', rank: 'Immortal', kd: 1.42, winRate: 54, resilience: 78, region: 'EU' },
  { gamerTag: 'AshCircuit', rank: 'Diamond', kd: 1.21, winRate: 49, resilience: 71, region: 'NA' },
  { gamerTag: 'DriftKernel', rank: 'Ascendant', kd: 1.35, winRate: 52, resilience: 84, region: 'LATAM' },
  { gamerTag: 'QuietStorm', rank: 'Immortal', kd: 1.58, winRate: 57, resilience: 69, region: 'EU' },
  { gamerTag: 'LowOrbit', rank: 'Platinum', kd: 1.08, winRate: 46, resilience: 88, region: 'BR' },
];

@Component({
  standalone: true,
  selector: 'app-talent-search-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, RouterLink, NeonBadgeComponent],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-5 u-py-4">
        <header class="sg-page-header">
          <sg-neon-badge tone="cyan">Scout · {{ game().label }}</sg-neon-badge>
          <h1 class="sg-page-header__title u-mt-2">Buscador de Talento</h1>
          <p class="sg-page-header__subtitle">
            Exploración con filtros por métricas, rangos y resiliencia bajo presión.
          </p>
        </header>

        <section class="sg-portal-card sg-talent-filters">
          <div class="sg-talent-filters__grid">
            <label class="sg-talent-filters__field">
              <span>Query</span>
              <input
                type="search"
                [value]="query()"
                (input)="query.set(($any($event.target).value))"
                placeholder="Gamer tag / región"
              />
            </label>
            <label class="sg-talent-filters__field">
              <span>K/D mín.</span>
              <input
                type="number"
                step="0.05"
                [value]="minKd()"
                (input)="minKd.set(+$any($event.target).value || 0)"
              />
            </label>
            <label class="sg-talent-filters__field">
              <span>Win % mín.</span>
              <input
                type="number"
                [value]="minWinRate()"
                (input)="minWinRate.set(+$any($event.target).value || 0)"
              />
            </label>
            <label class="sg-talent-filters__field">
              <span>Resiliencia mín.</span>
              <input
                type="number"
                [value]="minResilience()"
                (input)="minResilience.set(+$any($event.target).value || 0)"
              />
            </label>
          </div>
        </section>

        <section class="sg-portal-card">
          <div class="sg-portal-card__head">
            <h2 class="sg-portal-card__title">Resultados</h2>
            <span class="sg-portal-card__meta">{{ filtered().length }} candidatos</span>
          </div>
          <div class="sg-talent-table">
            <div class="sg-talent-table__row sg-talent-table__row--head">
              <span>Jugador</span>
              <span>Rank</span>
              <span>K/D</span>
              <span>Win%</span>
              <span>Resiliencia</span>
              <span></span>
            </div>
            @for (hit of filtered(); track hit.gamerTag) {
              <div class="sg-talent-table__row">
                <span>
                  <strong>{{ hit.gamerTag }}</strong>
                  <small>{{ hit.region }}</small>
                </span>
                <span>{{ hit.rank }}</span>
                <span>{{ hit.kd.toFixed(2) }}</span>
                <span>{{ hit.winRate }}%</span>
                <span>{{ hit.resilience }}</span>
                <a [routerLink]="['/player', hit.gamerTag]" class="u-btn u-btn--ghost">Ficha</a>
              </div>
            }
          </div>
        </section>
      </div>
    </ion-content>
  `,
})
export class TalentSearchPageComponent {
  private readonly auth = inject(AuthService);

  readonly query = signal('');
  readonly minKd = signal(1.0);
  readonly minWinRate = signal(45);
  readonly minResilience = signal(60);

  readonly game = computed(() => {
    const id = this.auth.selectedGame();
    return id ? gamePlatformMeta(id) : gamePlatformMeta('fortnite');
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const kd = this.minKd();
    const wr = this.minWinRate();
    const res = this.minResilience();
    return MOCK_TALENT.filter((h) => {
      if (q && !h.gamerTag.toLowerCase().includes(q) && !h.region.toLowerCase().includes(q)) {
        return false;
      }
      return h.kd >= kd && h.winRate >= wr && h.resilience >= res;
    });
  });
}
