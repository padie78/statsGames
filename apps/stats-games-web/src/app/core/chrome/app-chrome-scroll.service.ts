import { Injectable, computed, signal } from '@angular/core';

/** Tracks main page scroll to drive topbar/subnav transparency (Mobalytics-style). */
@Injectable({ providedIn: 'root' })
export class AppChromeScrollService {
  private readonly scrollTop = signal(0);

  readonly scrollProgress = computed(() => Math.min(1, this.scrollTop() / 80));
  readonly isScrolled = computed(() => this.scrollTop() > 8);

  setScrollTop(value: number): void {
    this.scrollTop.set(Math.max(0, value));
  }

  reset(): void {
    this.scrollTop.set(0);
  }
}
