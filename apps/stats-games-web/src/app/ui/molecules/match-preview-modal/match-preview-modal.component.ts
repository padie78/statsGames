import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { lolMatchesBannerSplashUrl } from '../../../core/game/lol-ddragon.util';
import { sgFadeSlideIn, sgModalIn } from '../../animations/sg-motion';
import { MatchAnalysisViewComponent } from '../../organisms/match-analysis-view/match-analysis-view.component';

@Component({
  standalone: true,
  selector: 'sg-match-preview-modal',
  encapsulation: ViewEncapsulation.None,
  imports: [MatchAnalysisViewComponent],
  animations: [sgModalIn, sgFadeSlideIn],
  template: `
    @if (matchId) {
      <div class="sg-match-modal" role="presentation" (click)="closed.emit()" @sgFadeSlideIn>
        <div class="sg-match-modal__wings" aria-hidden="true">
          <div
            class="sg-match-modal__wing sg-match-modal__wing--left"
            [style.background-image]="'url(' + wingArtUrl + ')'"
          ></div>
          <div
            class="sg-match-modal__wing sg-match-modal__wing--right"
            [style.background-image]="'url(' + wingArtUrl + ')'"
          ></div>
        </div>

        <button
          type="button"
          class="sg-match-modal__close"
          aria-label="Cerrar"
          (click)="closed.emit()"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div
          class="sg-match-modal__dialog page-shell page-shell--fluid"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sg-match-modal-title"
          (click)="$event.stopPropagation()"
          @sgModalIn
        >
          <header class="sg-match-modal__header">
            <div>
              <p class="sg-match-modal__eyebrow">Partida</p>
              <h2 id="sg-match-modal-title" class="sg-match-modal__title">Análisis de partida</h2>
              <p class="sg-match-modal__subtitle">
                Stats al instante. El reporte IA se completa cuando el análisis termina.
              </p>
            </div>
          </header>

          <div class="sg-match-modal__body">
            <sg-match-analysis-view [matchId]="matchId" (ctaClick)="closed.emit()" />
          </div>
        </div>
      </div>
    }
  `,
})
export class MatchPreviewModalComponent implements OnChanges, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);

  @Input() matchId: string | null = null;
  @Output() readonly closed = new EventEmitter<void>();

  get wingArtUrl(): string {
    const id = this.matchId ?? 'lol-match-modal';
    let seed = 17;
    for (let i = 0; i < id.length; i++) seed = (seed + id.charCodeAt(i) * (i + 3)) % 997;
    return lolMatchesBannerSplashUrl(seed);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['matchId']) {
      this.syncPortal();
    }
  }

  ngOnDestroy(): void {
    this.unlockBody();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.matchId) this.closed.emit();
  }

  private syncPortal(): void {
    const el = this.host.nativeElement;
    if (this.matchId) {
      if (el.parentElement !== this.document.body) {
        this.document.body.appendChild(el);
      }
      this.document.body.classList.add('sg-match-modal-lock');
      return;
    }
    this.unlockBody();
  }

  private unlockBody(): void {
    this.document.body.classList.remove('sg-match-modal-lock');
  }
}
