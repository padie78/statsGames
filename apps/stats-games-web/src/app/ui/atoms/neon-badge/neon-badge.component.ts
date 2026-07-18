import { Component, Input, ViewEncapsulation } from '@angular/core';

export type NeonBadgeTone = 'lime' | 'purple' | 'pink' | 'cyan' | 'muted' | 'gold';

/**
 * Átomo — Badge neón estilo Tracker Network.
 * Sin styles locales: ViewEncapsulation.None + clases globales `.sg-badge*`.
 */
@Component({
  standalone: true,
  selector: 'sg-neon-badge',
  encapsulation: ViewEncapsulation.None,
  template: `
    <span class="sg-badge" [class]="toneClass" [attr.aria-label]="label || null">
      @if (pulse) {
        <span class="sg-badge__dot pulse-live" aria-hidden="true"></span>
      }
      <ng-content />
    </span>
  `,
})
export class NeonBadgeComponent {
  @Input() tone: NeonBadgeTone = 'lime';
  @Input() pulse = false;
  @Input() label = '';

  get toneClass(): string {
    return `sg-badge--${this.tone}`;
  }
}
