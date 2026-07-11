import { Component, Input, ViewEncapsulation, inject, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import {
  MEDIA_LEGAL_DISCLAIMER,
  buildYouTubeEmbedUrl,
  formatYouTubeAttribution,
  isAllowedEmbedHost,
} from '../../../core/media';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

/**
 * Embed YouTube bajo demanda (click → iframe youtube-nocookie).
 * No hostea trailers oficiales; solo tips de creadores con atribución.
 */
@Component({
  standalone: true,
  selector: 'sg-youtube-tip-card',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-yt-tip u-surface-card u-p-4" [attr.aria-label]="title">
      <header class="sg-yt-tip__header">
        <div>
          <h3 class="sg-yt-tip__title">{{ title }}</h3>
          <p class="sg-yt-tip__subtitle u-m-0">{{ subtitle }}</p>
        </div>
          <sg-neon-badge tone="purple">{{ badgeLabel }}</sg-neon-badge>
      </header>

      <div class="sg-yt-tip__media">
        @if (!playing()) {
          <button type="button" class="sg-yt-tip__poster" (click)="play()">
            <img [src]="thumbnailUrl" [alt]="title" loading="lazy" width="480" height="270" />
            <span class="sg-yt-tip__play" aria-hidden="true">▶</span>
            <span class="sg-yt-tip__play-label">Reproducir</span>
          </button>
        } @else if (embedUrl) {
          <iframe
            class="sg-yt-tip__iframe"
            [src]="embedUrl"
            title="{{ title }}"
            loading="lazy"
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowfullscreen
          ></iframe>
        }
      </div>

      <p class="sg-yt-tip__attribution u-m-0">{{ attribution }}</p>
      <p class="sg-yt-tip__legal u-hint u-m-0">{{ legalDisclaimer }}</p>
    </section>
  `,
})
export class YoutubeTipCardComponent {
  private readonly sanitizer = inject(DomSanitizer);

  @Input({ required: true }) videoId!: string;
  @Input() title = 'Tip del coach';
  @Input() subtitle = 'Rotación, endgame y decisiones clave.';
  @Input() creatorName = 'creador';
  @Input() badgeLabel = 'Video';

  readonly playing = signal(false);
  readonly legalDisclaimer = MEDIA_LEGAL_DISCLAIMER;

  embedUrl: SafeResourceUrl | null = null;

  get thumbnailUrl(): string {
    return `https://i.ytimg.com/vi/${this.videoId}/hqdefault.jpg`;
  }

  get attribution(): string {
    return formatYouTubeAttribution(this.creatorName);
  }

  play(): void {
    const resolved = buildYouTubeEmbedUrl(this.videoId);
    if (!resolved || !isAllowedEmbedHost(resolved.embedUrl)) return;
    this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(resolved.embedUrl);
    this.playing.set(true);
  }
}
