import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import type { EvolutionAiReportView } from '../../../services/evolution-ai.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

type MarkdownBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

@Component({
  standalone: true,
  selector: 'sg-evolution-ai-report-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section
      class="sg-evo-ai"
      [class.sg-evo-ai--ready]="report?.status === 'ready'"
      [class.sg-evo-ai--pending]="report?.status === 'pending' || (loading && !report)"
      [class.sg-evo-ai--failed]="report?.status === 'failed'"
      aria-label="Informe IA de evolución"
    >
      <div class="sg-evo-ai__glow" aria-hidden="true"></div>
      <div class="sg-evo-ai__grid" aria-hidden="true"></div>

      @if (loading && !report) {
        <div class="sg-evo-ai__state sg-evo-ai__state--loading">
          <span class="sg-evo-ai__pulse" aria-hidden="true"></span>
          <div>
            <p class="sg-evo-ai__state-title u-m-0">Preparando informe…</p>
            <p class="sg-evo-ai__state-body u-m-0">
              Estamos juntando tendencias y KPIs de la semana.
            </p>
          </div>
        </div>
      } @else if (!report) {
        <header class="sg-evo-ai__empty-head">
          <div class="sg-evo-ai__badges">
            <sg-neon-badge tone="gold">Coach IA</sg-neon-badge>
            <sg-neon-badge tone="muted">Evolución semanal</sg-neon-badge>
          </div>
          <h2 class="sg-evo-ai__title">{{ title }}</h2>
          @if (subtitle) {
            <p class="sg-evo-ai__subtitle u-m-0">{{ subtitle }}</p>
          }
        </header>
        <div class="sg-evo-ai__state">
          <div>
            <p class="sg-evo-ai__state-title u-m-0">Todavía no hay informe esta semana</p>
            <p class="sg-evo-ai__state-body u-m-0">
              Generá un análisis IA de tu evolución táctica y lo guardamos en tu historial.
            </p>
          </div>
          <button type="button" class="sg-evo-ai__btn" (click)="generate.emit()">
            Generar informe con IA
          </button>
        </div>
      } @else if (report.status === 'pending') {
        <header class="sg-evo-ai__empty-head">
          <div class="sg-evo-ai__badges">
            <sg-neon-badge tone="gold">Coach IA</sg-neon-badge>
            <sg-neon-badge tone="gold">Generando</sg-neon-badge>
          </div>
          <h2 class="sg-evo-ai__title">{{ title }}</h2>
        </header>
        <div class="sg-evo-ai__state sg-evo-ai__state--loading">
          <span class="sg-evo-ai__pulse" aria-hidden="true"></span>
          <div>
            <p class="sg-evo-ai__state-title u-m-0">{{ report.headline || 'Analizando tu semana…' }}</p>
            <p class="sg-evo-ai__state-body u-m-0">
              {{ report.summary || 'Bedrock está armando el informe con tus tendencias.' }}
            </p>
            <p class="sg-evo-ai__state-hint u-m-0">Se actualiza solo cuando termina.</p>
          </div>
        </div>
      } @else if (report.status === 'failed') {
        <header class="sg-evo-ai__empty-head">
          <div class="sg-evo-ai__badges">
            <sg-neon-badge tone="gold">Coach IA</sg-neon-badge>
            <sg-neon-badge tone="muted">Falló</sg-neon-badge>
          </div>
          <h2 class="sg-evo-ai__title">{{ title }}</h2>
        </header>
        <div class="sg-evo-ai__state sg-evo-ai__state--failed">
          <div>
            <p class="sg-evo-ai__state-title u-m-0">No se pudo generar el informe</p>
            <p class="sg-evo-ai__state-body u-m-0">
              {{ report.summary || 'Hubo un error al procesar el análisis. Probá de nuevo.' }}
            </p>
          </div>
          <button type="button" class="sg-evo-ai__btn" (click)="regenerate.emit()">
            Reintentar
          </button>
        </div>
      } @else {
        <header class="sg-evo-ai__hero">
          <div
            class="sg-evo-ai__score"
            [class.sg-evo-ai__score--up]="report.verdict === 'ascending'"
            [class.sg-evo-ai__score--down]="report.verdict === 'declining'"
            [class.sg-evo-ai__score--volatile]="report.verdict === 'volatile'"
            [class.sg-evo-ai__score--stable]="report.verdict === 'stable' || !report.verdict"
            [attr.aria-label]="'Nota ' + report.gradeLabel + ', score ' + report.performanceScore"
          >
            <div class="sg-evo-ai__score-ring" [style.--score]="report.performanceScore">
              <span class="sg-evo-ai__score-grade">{{ report.gradeLabel }}</span>
              <span class="sg-evo-ai__score-value">{{ report.performanceScore }}<small>/100</small></span>
            </div>
            <span class="sg-evo-ai__score-verdict">{{ verdictLabel(report.verdict) }}</span>
          </div>

          <div class="sg-evo-ai__hero-copy">
            <div class="sg-evo-ai__badges">
              <sg-neon-badge tone="gold">Coach IA</sg-neon-badge>
              <sg-neon-badge tone="muted">Evolución semanal</sg-neon-badge>
              <sg-neon-badge tone="gold">Listo</sg-neon-badge>
            </div>
            <h2 class="sg-evo-ai__headline">{{ report.headline }}</h2>
            <p class="sg-evo-ai__summary u-m-0">{{ report.summary }}</p>
            @if (subtitle) {
              <p class="sg-evo-ai__meta u-m-0">{{ subtitle }}</p>
            }
          </div>
        </header>

        <div class="sg-evo-ai__body">
          @if (report.pros.length || report.cons.length) {
            <div class="sg-evo-ai__split">
              @if (report.pros.length) {
                <article class="sg-evo-ai__card sg-evo-ai__card--pro">
                  <h3 class="sg-evo-ai__card-title">Fortalezas</h3>
                  <ul class="sg-evo-ai__card-list">
                    @for (item of report.pros; track item) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                </article>
              }
              @if (report.cons.length) {
                <article class="sg-evo-ai__card sg-evo-ai__card--con">
                  <h3 class="sg-evo-ai__card-title">Riesgos</h3>
                  <ul class="sg-evo-ai__card-list">
                    @for (item of report.cons; track item) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                </article>
              }
            </div>
          }

          @if (report.actionPlan.length) {
            <article class="sg-evo-ai__plan">
              <div class="sg-evo-ai__plan-head">
                <h3 class="sg-evo-ai__card-title sg-evo-ai__card-title--plan">Plan de foco</h3>
                <span class="sg-evo-ai__plan-count">{{ report.actionPlan.length }} pasos</span>
              </div>
              <ol class="sg-evo-ai__plan-list">
                @for (step of report.actionPlan; track step; let i = $index) {
                  <li>
                    <span class="sg-evo-ai__step-num">{{ i + 1 }}</span>
                    <span class="sg-evo-ai__step-text">{{ step }}</span>
                  </li>
                }
              </ol>
            </article>
          }

          @if (markdownSections.length) {
            <div class="sg-evo-ai__detail">
              <p class="sg-evo-ai__detail-label">Detalle del informe</p>
              <div class="sg-evo-ai__sections">
                @for (section of markdownSections; track section.title) {
                  <article class="sg-evo-ai__section">
                    <h3 class="sg-evo-ai__section-title">{{ cleanSectionTitle(section.title) }}</h3>
                    <div class="sg-evo-ai__section-body">
                      @for (block of section.blocks; track $index) {
                        @if (block.kind === 'p') {
                          <p [innerHTML]="formatInline(block.text)"></p>
                        } @else if (block.kind === 'ul') {
                          <ul class="sg-evo-ai__md-list">
                            @for (item of block.items; track item) {
                              <li [innerHTML]="formatInline(item)"></li>
                            }
                          </ul>
                        } @else {
                          <ol class="sg-evo-ai__md-list sg-evo-ai__md-list--ordered">
                            @for (item of block.items; track item) {
                              <li [innerHTML]="formatInline(item)"></li>
                            }
                          </ol>
                        }
                      }
                    </div>
                  </article>
                }
              </div>
            </div>
          }

          <footer class="sg-evo-ai__footer">
            <p class="sg-evo-ai__footer-note u-m-0">
              Persistido · {{ formatDate(report.createdAt) }}
            </p>
            <button
              type="button"
              class="sg-evo-ai__btn sg-evo-ai__btn--ghost"
              (click)="regenerate.emit()"
            >
              Regenerar informe
            </button>
          </footer>
        </div>
      }
    </section>
  `,
})
export class EvolutionAiReportPanelComponent {
  @Input() title = 'Informe de evolución';
  @Input() subtitle = '';
  @Input() report: EvolutionAiReportView | null = null;
  @Input() loading = false;
  @Output() readonly generate = new EventEmitter<void>();
  @Output() readonly regenerate = new EventEmitter<void>();

  get markdownSections(): Array<{ title: string; blocks: MarkdownBlock[] }> {
    const markdown = this.report?.markdown?.trim();
    if (!markdown) return [];
    const chunks = markdown.split(/^##\s+/m).slice(1);
    return chunks
      .map((chunk) => {
        const lines = chunk.split('\n');
        const title = (lines[0] ?? '').trim();
        return { title, blocks: this.parseBlocks(lines.slice(1)) };
      })
      .filter((s) => s.title && s.blocks.length);
  }

  cleanSectionTitle(title: string): string {
    return title.replace(/^[^\p{L}\p{N}]+/u, '').trim() || title;
  }

  formatInline(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  verdictLabel(verdict: string): string {
    switch (verdict) {
      case 'ascending':
        return 'Tendencia al alza';
      case 'declining':
        return 'Tendencia a la baja';
      case 'volatile':
        return 'Semana volátil';
      case 'stable':
        return 'Forma estable';
      default:
        return verdict;
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private parseBlocks(lines: string[]): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = [];
    let i = 0;
    while (i < lines.length) {
      const raw = lines[i] ?? '';
      const line = raw.trim();
      if (!line) {
        i += 1;
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length) {
          const t = (lines[i] ?? '').trim();
          if (!/^[-*]\s+/.test(t)) break;
          items.push(t.replace(/^[-*]\s+/, '').trim());
          i += 1;
        }
        if (items.length) blocks.push({ kind: 'ul', items });
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length) {
          const t = (lines[i] ?? '').trim();
          if (!/^\d+\.\s+/.test(t)) break;
          items.push(t.replace(/^\d+\.\s+/, '').trim());
          i += 1;
        }
        if (items.length) blocks.push({ kind: 'ol', items });
        continue;
      }
      blocks.push({ kind: 'p', text: line.replace(/^###\s+/, '') });
      i += 1;
    }
    return blocks;
  }
}
