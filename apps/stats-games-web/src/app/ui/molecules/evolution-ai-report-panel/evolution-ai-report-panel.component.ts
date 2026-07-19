import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EvolutionAiReportView } from '../../../services/evolution-ai.service';
import { copyToClipboard } from '../../../utils/match-stats.util';
import { downloadTextFile } from '../../../utils/download-text.util';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

type MarkdownBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

type FocusAction = {
  text: string;
  route: string;
  queryParams?: Record<string, string>;
  cta: string;
};

@Component({
  standalone: true,
  selector: 'sg-evolution-ai-report-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent, RouterLink],
  template: `
    <article
      class="sg-evo-ai u-surface-card u-p-5"
      [class.sg-evo-ai--ready]="!!displayReport && displayReport.status !== 'failed'"
      [class.sg-evo-ai--pending]="isHardPending"
      [class.sg-evo-ai--failed]="isHardFailed"
      aria-label="Informe IA de evolución"
    >
      @if (loading && !displayReport) {
        <div class="sg-evo-ai__state sg-evo-ai__state--loading">
          <span class="sg-evo-ai__pulse" aria-hidden="true"></span>
          <div>
            <p class="sg-evo-ai__state-title u-m-0">Preparando informe…</p>
            <p class="sg-evo-ai__state-body u-m-0">
              Estamos juntando tendencias y KPIs de la semana.
            </p>
          </div>
        </div>
      } @else if (!displayReport) {
        <div class="sg-evo-ai__state">
          <div>
            <p class="sg-evo-ai__state-title u-m-0">Todavía no hay informe esta semana</p>
            <p class="sg-evo-ai__state-body u-m-0">
              Generá un análisis IA de tu evolución táctica y lo guardamos en tu historial.
            </p>
          </div>
          <button type="button" class="u-btn u-btn--gold u-btn--sm" (click)="generate.emit()">
            Generar informe con IA
          </button>
        </div>
      } @else if (isHardPending) {
        <div class="sg-evo-ai__state sg-evo-ai__state--loading">
          <span class="sg-evo-ai__pulse" aria-hidden="true"></span>
          <div>
            <p class="sg-evo-ai__state-title u-m-0">
              {{ report?.headline || 'Analizando tu semana…' }}
            </p>
            <p class="sg-evo-ai__state-body u-m-0">
              {{ report?.summary || 'Bedrock está armando el informe con tus tendencias.' }}
            </p>
            <p class="sg-evo-ai__state-hint u-m-0">Se actualiza solo cuando termina.</p>
          </div>
        </div>
      } @else if (isHardFailed) {
        <div class="sg-evo-ai__state sg-evo-ai__state--failed">
          <div>
            <p class="sg-evo-ai__state-title u-m-0">No se pudo generar el informe</p>
            <p class="sg-evo-ai__state-body u-m-0">
              {{ report?.summary || 'Hubo un error al procesar el análisis. Probá de nuevo.' }}
            </p>
          </div>
          <button type="button" class="u-btn u-btn--gold u-btn--sm" (click)="regenerate.emit()">
            Reintentar
          </button>
        </div>
      } @else {
        @if (displayReport; as view) {
        @if (showUpdatingBanner) {
          <div class="sg-evo-ai__live-banner" role="status">
            <span class="sg-evo-ai__pulse sg-evo-ai__pulse--sm" aria-hidden="true"></span>
            <p class="u-m-0">Actualizando informe… seguís viendo la última versión lista.</p>
          </div>
        } @else if (showFailedBanner) {
          <div class="sg-evo-ai__live-banner sg-evo-ai__live-banner--warn" role="status">
            <p class="u-m-0">
              No se pudo regenerar. Mostramos el último informe listo.
              <button type="button" class="sg-evo-ai__inline-btn" (click)="regenerate.emit()">
                Reintentar
              </button>
            </p>
          </div>
        }

        <header class="sg-evo-ai__header">
          <div class="sg-evo-ai__heading">
            <h3 class="sg-evo-ai__title">{{ view.headline }}</h3>
            <p class="sg-evo-ai__lead u-m-0">{{ view.summary }}</p>
          </div>
          <div class="sg-evo-ai__meta">
            <div
              class="sg-evo-ai__score"
              [class.sg-evo-ai__score--up]="view.verdict === 'ascending'"
              [class.sg-evo-ai__score--down]="view.verdict === 'declining'"
              [class.sg-evo-ai__score--volatile]="view.verdict === 'volatile'"
              [class.sg-evo-ai__score--stable]="view.verdict === 'stable' || !view.verdict"
              [attr.aria-label]="'Nota ' + view.gradeLabel + ', score ' + view.performanceScore"
            >
              <div class="sg-evo-ai__score-ring" [style.--score]="view.performanceScore">
                <span class="sg-evo-ai__score-grade">{{ view.gradeLabel }}</span>
                <span class="sg-evo-ai__score-value">{{ view.performanceScore }}<small>/100</small></span>
              </div>
              <span class="sg-evo-ai__score-verdict">{{ verdictLabel(view.verdict) }}</span>
            </div>
            <sg-neon-badge tone="gold">{{ showUpdatingBanner ? 'Actualizando' : 'Listo' }}</sg-neon-badge>
          </div>
        </header>

        <div class="sg-evo-ai__body">
          @if (view.pros.length || view.cons.length) {
            <div class="sg-evo-ai__split">
              @if (view.pros.length) {
                <article class="sg-evo-ai__card sg-evo-ai__card--pro">
                  <h3 class="sg-evo-ai__card-title">Fortalezas</h3>
                  <ul class="sg-evo-ai__card-list">
                    @for (item of view.pros; track item) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                </article>
              }
              @if (view.cons.length) {
                <article class="sg-evo-ai__card sg-evo-ai__card--con">
                  <h3 class="sg-evo-ai__card-title">Riesgos</h3>
                  <ul class="sg-evo-ai__card-list">
                    @for (item of view.cons; track item) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                </article>
              }
            </div>
          }

          @if (focusActions.length) {
            <article class="sg-evo-ai__plan">
              <div class="sg-evo-ai__plan-head">
                <h3 class="sg-evo-ai__card-title sg-evo-ai__card-title--plan">Plan de foco</h3>
                <span class="sg-evo-ai__plan-count">{{ focusActions.length }} acciones</span>
              </div>
              <ol class="sg-evo-ai__plan-list">
                @for (action of focusActions; track action.text; let i = $index) {
                  <li>
                    <span class="sg-evo-ai__step-num">{{ i + 1 }}</span>
                    <div class="sg-evo-ai__step-body">
                      <span class="sg-evo-ai__step-text">{{ action.text }}</span>
                      <a
                        [routerLink]="action.route"
                        [queryParams]="action.queryParams ?? null"
                        class="sg-evo-ai__step-link"
                      >
                        {{ action.cta }} →
                      </a>
                    </div>
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
              Persistido · {{ formatDate(view.createdAt) }}
            </p>
            <div class="sg-evo-ai__footer-actions">
              <button
                type="button"
                class="u-btn u-btn--ghost-gold u-btn--sm"
                (click)="onCopyMarkdown()"
              >
                {{ exportHint || 'Copiar MD' }}
              </button>
              <button
                type="button"
                class="u-btn u-btn--ghost-gold u-btn--sm"
                (click)="onDownloadMarkdown()"
              >
                Descargar MD
              </button>
            </div>
          </footer>
        </div>
        }
      }
    </article>
  `,
})
export class EvolutionAiReportPanelComponent {
  @Input() title = 'Informe de evolución';
  @Input() subtitle = '';
  @Input() report: EvolutionAiReportView | null = null;
  /** Último informe ready a mostrar mientras regenera / falla. */
  @Input() staleReady: EvolutionAiReportView | null = null;
  @Input() regenerating = false;
  @Input() loading = false;
  @Output() readonly generate = new EventEmitter<void>();
  @Output() readonly regenerate = new EventEmitter<void>();

  exportHint = '';

  get displayReport(): EvolutionAiReportView | null {
    if (this.report?.status === 'ready') return this.report;
    if (this.staleReady?.status === 'ready') return this.staleReady;
    return this.report;
  }

  get showUpdatingBanner(): boolean {
    return (
      Boolean(this.staleReady?.status === 'ready') &&
      (this.regenerating || this.report?.status === 'pending')
    );
  }

  get showFailedBanner(): boolean {
    return this.report?.status === 'failed' && this.staleReady?.status === 'ready';
  }

  get isHardPending(): boolean {
    return (
      (this.report?.status === 'pending' || this.regenerating) &&
      this.staleReady?.status !== 'ready'
    );
  }

  get isHardFailed(): boolean {
    return this.report?.status === 'failed' && this.staleReady?.status !== 'ready';
  }

  get focusActions(): FocusAction[] {
    const plan = this.displayReport?.actionPlan ?? [];
    return plan
      .filter(Boolean)
      .slice(0, 3)
      .map((text, index) => ({ text, ...this.resolveFocusLink(text, index) }));
  }

  get markdownSections(): Array<{ title: string; blocks: MarkdownBlock[] }> {
    const markdown = this.displayReport?.markdown?.trim();
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

  async onCopyMarkdown(): Promise<void> {
    const md = this.buildExportMarkdown();
    if (!md) return;
    const ok = await copyToClipboard(md);
    this.exportHint = ok ? 'Copiado' : 'Error';
    setTimeout(() => {
      this.exportHint = '';
    }, 1600);
  }

  onDownloadMarkdown(): void {
    const md = this.buildExportMarkdown();
    if (!md) return;
    const period = this.displayReport?.periodId ?? 'semana';
    downloadTextFile(`evolucion-${period}.md`, md, 'text/markdown');
  }

  private buildExportMarkdown(): string {
    const view = this.displayReport;
    if (!view) return '';
    if (view.markdown?.trim()) {
      return `# ${view.headline}\n\n${view.summary}\n\n${view.markdown.trim()}\n`;
    }
    const pros = view.pros.map((p) => `- ${p}`).join('\n');
    const cons = view.cons.map((c) => `- ${c}`).join('\n');
    const plan = view.actionPlan.map((a, i) => `${i + 1}. ${a}`).join('\n');
    return [
      `# ${view.headline}`,
      '',
      view.summary,
      '',
      '## Fortalezas',
      pros || '- —',
      '',
      '## Riesgos',
      cons || '- —',
      '',
      '## Plan de foco',
      plan || '1. —',
      '',
    ].join('\n');
  }

  private resolveFocusLink(
    step: string,
    index: number,
  ): { route: string; queryParams?: Record<string, string>; cta: string } {
    const t = step.toLowerCase();
    if (/coach|entren|hábit|habit|mental|tilt/.test(t) && index > 0) {
      return { route: '/tabs/ai-coach', cta: 'Abrir Coach' };
    }

    let topic = 'form';
    if (/muerte|death|die|dying/.test(t)) topic = 'deaths';
    else if (/visi[oó]n|ward|vision/.test(t)) topic = 'vision';
    else if (/\bcs\b|farm|cs\/|minions/.test(t)) topic = 'cs';
    else if (/kda|kill|agres/.test(t)) topic = 'kda';
    else if (/derrota|loss|lose|perdid/.test(t)) {
      return {
        route: '/tabs/matches',
        queryParams: { topic: 'losses', result: 'losses', date: '7d' },
        cta: 'Ver derrotas',
      };
    } else if (/victoria|win|clutch/.test(t)) {
      return {
        route: '/tabs/matches',
        queryParams: { topic: 'wins', result: 'wins', date: '7d' },
        cta: 'Ver victorias',
      };
    }

    return {
      route: '/tabs/matches',
      queryParams: { topic, date: '7d', sort: topic === 'deaths' ? 'kills' : 'newest' },
      cta: 'Revisar en Partidas',
    };
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
