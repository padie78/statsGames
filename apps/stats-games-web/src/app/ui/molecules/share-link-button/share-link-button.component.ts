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
      (click)="copyLink()"
      [disabled]="!gamerTag"
    >
      {{ copied() ? '¡Copiado!' : 'Compartir perfil' }}
    </button>
  `,
})
export class ShareLinkButtonComponent {
  @Input({ required: true }) gamerTag!: string;

  readonly copied = signal(false);

  async copyLink(): Promise<void> {
    if (!this.gamerTag) return;
    const url = buildPlayerShareUrl(this.gamerTag);
    const ok = await copyToClipboard(url);
    if (ok) {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }
  }
}
