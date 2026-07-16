import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

export type QuickActionIcon = 'matches' | 'analytics' | 'coach' | 'link';

export interface QuickActionItem {
  id: string;
  label: string;
  route: string;
  icon: QuickActionIcon;
  /** Una línea corta bajo el título. */
  hint?: string;
  /** Párrafo más largo: para qué sirve este atajo. */
  body?: string;
  tone?: 'lime' | 'purple' | 'cyan' | 'pink';
  badge?: string;
  cta?: string;
}

export interface PlaybookStep {
  id: string;
  title: string;
  body: string;
  route: string;
  cta: string;
}

/**
 * Panel lateral de Inicio: narrativa + foco + pasos + destinos.
 * (Reemplaza el grid seco de “Acceso rápido”.)
 */
@Component({
  standalone: true,
  selector: 'sg-quick-actions-bar',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
    <section class="sg-playbook" aria-label="Tu ruta en StatsGames">
      <header class="sg-playbook__header">
        <p class="sg-playbook__eyebrow">Tu ruta</p>
        <h2 class="sg-playbook__title">{{ headline() }}</h2>
        <p class="sg-playbook__lede">{{ lede() }}</p>
      </header>

      <article class="sg-playbook__focus" [attr.data-tone]="needsSetup() ? 'purple' : 'lime'">
        <div class="sg-playbook__focus-top">
          <span class="sg-playbook__focus-label">{{ focusLabel() }}</span>
          <sg-neon-badge [tone]="needsSetup() ? 'purple' : 'lime'">
            {{ needsSetup() ? 'Setup' : 'Hoy' }}
          </sg-neon-badge>
        </div>
        <p class="sg-playbook__focus-text">{{ focusBody() }}</p>
      </article>

      <div class="sg-playbook__steps-wrap">
        <h3 class="sg-playbook__section-title">Próximos pasos</h3>
        <ol class="sg-playbook__steps">
          @for (step of steps(); track step.id; let i = $index) {
            <li class="sg-playbook__step">
              <span class="sg-playbook__step-num" aria-hidden="true">{{ i + 1 }}</span>
              <div class="sg-playbook__step-copy">
                <p class="sg-playbook__step-title">{{ step.title }}</p>
                <p class="sg-playbook__step-body">{{ step.body }}</p>
                <a [routerLink]="step.route" class="sg-playbook__step-link">{{ step.cta }} →</a>
              </div>
            </li>
          }
        </ol>
      </div>

      <div class="sg-playbook__dest-wrap">
        <h3 class="sg-playbook__section-title">Explorar</h3>
        <p class="sg-playbook__section-desc">
          Cada sección tiene un trabajo distinto. Abrí la que necesitás ahora.
        </p>

        <div class="sg-playbook__destinations">
          @for (action of actions(); track action.id) {
            <a
              [routerLink]="action.route"
              class="sg-playbook__dest"
              [attr.data-tone]="action.tone ?? 'cyan'"
            >
              <span class="sg-playbook__dest-icon" aria-hidden="true">
                @switch (action.icon) {
                  @case ('matches') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                      <rect x="4" y="5" width="16" height="14" rx="2" />
                      <path d="M8 9h8M8 13h5" />
                    </svg>
                  }
                  @case ('analytics') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                      <path d="M4 19V5M4 19h16" />
                      <path d="m7 14 4-4 3 3 5-6" />
                    </svg>
                  }
                  @case ('coach') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                      <path
                        d="M12 3.5 4.5 7v5c0 4.4 3.1 7.8 7.5 9 4.4-1.2 7.5-4.6 7.5-9V7L12 3.5Z"
                      />
                      <path d="M9.5 12.2 11 13.7l3.5-3.5" />
                    </svg>
                  }
                  @case ('link') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                      <path d="M9.5 14.5 14.5 9.5" />
                      <path
                        d="M11 7.5 12.2 6.3a3.5 3.5 0 0 1 5 5L16 12.5M13 16.5l-1.2 1.2a3.5 3.5 0 0 1-5-5L8 11.5"
                      />
                    </svg>
                  }
                }
              </span>

              <span class="sg-playbook__dest-copy">
                <span class="sg-playbook__dest-label-row">
                  <span class="sg-playbook__dest-label">{{ action.label }}</span>
                  @if (action.badge) {
                    <sg-neon-badge [tone]="action.tone ?? 'lime'">{{ action.badge }}</sg-neon-badge>
                  }
                </span>
                @if (action.body || action.hint) {
                  <span class="sg-playbook__dest-body">{{ action.body || action.hint }}</span>
                }
                <span class="sg-playbook__dest-cta">{{ action.cta || 'Abrir' }} →</span>
              </span>
            </a>
          }
        </div>
      </div>
    </section>
  `,
})
export class QuickActionsBarComponent {
  readonly actions = input.required<QuickActionItem[]>();
  readonly gameLabel = input('tu juego');
  readonly needsSetup = input(false);
  readonly matchCount = input(0);
  readonly winRate = input('—');

  readonly headline = computed(() =>
    this.needsSetup() ? 'Empezá a trackear en serio' : 'Seguí desde acá',
  );

  readonly lede = computed(() => {
    if (this.needsSetup()) {
      return `Todavía no hay telemetría viva de ${this.gameLabel()}. Conectá la cuenta, jugá un par de partidas y StatsGames arma solo el resumen semanal, el historial y el coach.`;
    }
    const n = this.matchCount();
    return `Esta semana llevás ${n} partida${n === 1 ? '' : 's'} en ${this.gameLabel()} (WR ${this.winRate()}). Usá estos atajos para revisar el detalle, mirar la curva o pedir un plan al coach.`;
  });

  readonly focusLabel = computed(() => (this.needsSetup() ? 'Prioridad' : 'Foco de hoy'));

  readonly focusBody = computed(() => {
    if (this.needsSetup()) {
      return `Vinculá Riot, Steam, Epic o Roblox. Sin eso, Inicio solo muestra previews: no hay KPIs reales ni coaching basado en tus matches.`;
    }
    if (this.matchCount() === 0) {
      return `No hay partidas nuevas en la ventana semanal. Jugá una sesión o abrí Partidas para revisar el historial importado.`;
    }
    return `Revisá la última destacada, mirá si Evolución confirma la tendencia y pedile al Coach un foco concreto para la próxima cola.`;
  });

  readonly steps = computed((): PlaybookStep[] => {
    if (this.needsSetup()) {
      return [
        {
          id: 'connect',
          title: 'Conectar cuenta',
          body: 'Elegí la plataforma del juego activo y autorizá el acceso.',
          route: '/tabs/integrations',
          cta: 'Ir a Integraciones',
        },
        {
          id: 'play',
          title: 'Jugar 1–2 partidas',
          body: 'El poller importa solo; no hace falta subir replays.',
          route: '/tabs/matches',
          cta: 'Ver Partidas',
        },
        {
          id: 'review',
          title: 'Volver a Inicio',
          body: 'Cuando haya datos, acá aparecen KPIs, insight y la destacada.',
          route: '/tabs/dashboard',
          cta: 'Quedarme en Inicio',
        },
      ];
    }
    return [
      {
        id: 'match',
        title: 'Mirar una partida clave',
        body: 'Abrí el historial y entrá al match donde más aprendiste (o fallaste).',
        route: '/tabs/matches',
        cta: 'Abrir Partidas',
      },
      {
        id: 'trend',
        title: 'Chequear la curva',
        body: 'Evolución muestra si el WR y el K/D van para arriba o se estancaron.',
        route: '/tabs/analytics',
        cta: 'Ver Evolución',
      },
      {
        id: 'coach',
        title: 'Pedir un plan corto',
        body: 'El Coach traduce la telemetría en 2–3 acciones concretas para hoy.',
        route: '/tabs/ai-coach',
        cta: 'Abrir AI Coach',
      },
    ];
  });
}
