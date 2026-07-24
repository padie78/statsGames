import { Component, Input, ViewEncapsulation, signal } from '@angular/core';
import { buildPlayerShareUrl, copyToClipboard } from '../../../utils/match-stats.util';

@Component({
  standalone: true,
  selector: 'sg-share-link-button',
  encapsulation: ViewEncapsulation.None,
  template: `
    <button
      type="button"
      class="u-btn u-btn--ghost sg-share-link"
      (click)="share()"
      [disabled]="!gamerTag"
    >
      {{ label() }}
    </button>
  `,
})
export class ShareLinkButtonComponent {
  @Input({ required: true }) gamerTag!: string;
  /** Texto opcional del share nativo / clipboard hint. */
  @Input() shareText = 'Mi ficha en Stats Games';
  @Input() idleLabel = 'Compartir ficha';
  @Input() copiedLabel = '¡Link copiado!';

  readonly copied = signal(false);

  label(): string {
    return this.copied() ? this.copiedLabel : this.idleLabel;
  }

  async share(): Promise<void> {
    if (!this.gamerTag) return;
    const url = buildPlayerShareUrl(this.gamerTag);
    const title = this.shareText;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch {
        /* cancelado o no soportado → clipboard */
      }
    }

    const ok = await copyToClipboard(url);
    if (ok) {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }
  }
}
