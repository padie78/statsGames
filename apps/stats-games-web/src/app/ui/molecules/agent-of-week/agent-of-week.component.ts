import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface AgentOfWeekView {
  agent: string;
  matches: number;
  winRate: string;
  artUrl: string | null;
  mapOfWeek: string | null;
}

@Component({
  standalone: true,
  selector: 'sg-agent-of-week',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink],
  template: `
    <article class="sg-agent-week u-surface-card" aria-label="Agente de la semana">
      @if (view.artUrl) {
        <div class="sg-agent-week__art-wrap" aria-hidden="true">
          <img class="sg-agent-week__art" [src]="view.artUrl" alt="" loading="lazy" decoding="async" />
          <span class="sg-agent-week__veil"></span>
        </div>
      }
      <div class="sg-agent-week__body">
        <p class="sg-agent-week__eyebrow u-m-0">Agente de la semana</p>
        <h3 class="sg-agent-week__title">{{ view.agent }}</h3>
        <p class="sg-agent-week__meta u-m-0">
          {{ view.matches }} partidas · WR {{ view.winRate }}
          @if (view.mapOfWeek) {
            <span>· Mapa top: {{ view.mapOfWeek }}</span>
          }
        </p>
        <a routerLink="/tabs/matches" [queryParams]="{ identity: view.agent }" class="sg-agent-week__cta">
          Ver partidas con {{ view.agent }} →
        </a>
      </div>
    </article>
  `,
})
export class AgentOfWeekComponent {
  @Input({ required: true }) view!: AgentOfWeekView;
}
