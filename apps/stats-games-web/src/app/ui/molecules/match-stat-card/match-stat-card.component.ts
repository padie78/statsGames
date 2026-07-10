import { Component, Input, ViewEncapsulation } from '@angular/core';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import {
  computeKdRatio,
  formatMatchRelativeTime,
  getMatchOutcome,
} from '../../../utils/match-stats.util';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { StatValueComponent } from '../../atoms/stat-value/stat-value.component';

export interface MatchCardStats {
  kills?: number | null;
  deaths?: number | null;
  placement?: number | null;
  assists?: number | null;
}

@Component({
  standalone: true,
  selector: 'sg-match-stat-card',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent, StatValueComponent],
  template: `
    <article
      class="sg-match-card"
      [class.sg-match-card--live]="live"
      [class.sg-match-card--detailed]="detailed"
      [class.sg-match-card--victory]="isVictory"
      [class.sg-match-card--podium]="isPodium"
      [class.sg-match-card--fortnite]="platformKey === 'fortnite'"
      [class.sg-match-card--roblox]="platformKey === 'roblox'"
    >
      @if (isVictory) {
        <div class="sg-match-card__victory-glow" aria-hidden="true"></div>
      }

      @if (detailed && artUrl) {
        <img class="sg-match-card__art" [src]="artUrl" [alt]="" aria-hidden="true" />
        <div class="sg-match-card__art-overlay" aria-hidden="true"></div>
      }

      <div class="sg-match-card__body">
        <header class="sg-match-card__header">
          <div class="sg-match-card__meta">
            <div class="sg-match-card__title-row">
              @if (platformIconUrl) {
                <img
                  class="sg-match-card__thumb"
                  [src]="platformIconUrl"
                  [alt]="platformLabel"
                  aria-hidden="true"
                />
              }
              <div class="sg-match-card__title-block">
                <h3 class="sg-match-card__title">
                  @if (isVictory) {
                    <span class="sg-match-card__victory-icon" aria-hidden="true">🏆</span>
                  }
                  {{ modeLabel }}
                </h3>
                <p class="sg-match-card__subtitle">
                  {{ displayTime }}
                  @if (detailed) {
                    <span class="sg-match-card__id">· {{ matchId }}</span>
                  }
                </p>
              </div>
            </div>
          </div>

          <div class="sg-match-card__badges">
            @if (live) {
              <sg-neon-badge tone="cyan" [pulse]="true">Live</sg-neon-badge>
            }
            <sg-neon-badge [tone]="outcome.tone" [pulse]="isVictory">
              {{ outcome.label }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="platformTone">{{ platformLabel }}</sg-neon-badge>
          </div>
        </header>

        @if (summary) {
          <p class="sg-match-card__summary">{{ summary }}</p>
        }

        <div
          class="sg-match-card__stats"
          [class.sg-match-card__stats--detailed]="detailed"
        >
          <sg-stat-value
            label="Placement"
            [value]="stats.placement != null ? '#' + stats.placement : '—'"
            [accent]="isVictory || isPodium ? 'lime' : 'default'"
          />
          <sg-stat-value
            label="Kills"
            [value]="stats.kills ?? '—'"
            [accent]="isVictory ? 'lime' : 'default'"
          />
          <sg-stat-value label="Deaths" [value]="stats.deaths ?? '—'" />
          @if (detailed) {
            <sg-stat-value label="Assists" [value]="stats.assists ?? '—'" />
            <sg-stat-value label="K/D" [value]="kdRatio" accent="purple" />
          }
        </div>
      </div>
    </article>
  `,
})
export class MatchStatCardComponent {
  @Input({ required: true }) matchId!: string;
  @Input({ required: true }) platform!: string;
  @Input() summary = '';
  @Input() updatedAt = '';
  @Input() relativeTime = '';
  @Input() live = false;
  @Input() detailed = false;
  @Input() stats: MatchCardStats = {};

  get isVictory(): boolean {
    return this.stats.placement === 1;
  }

  get isPodium(): boolean {
    const p = this.stats.placement;
    return p != null && p > 1 && p <= 3;
  }

  get platformTone(): 'cyan' | 'purple' | 'muted' {
    if (this.platformKey === 'fortnite') return 'cyan';
    if (this.platformKey === 'roblox') return 'purple';
    return 'muted';
  }

  get platformKey(): SelectedGame | null {
    const p = this.platform?.toLowerCase();
    if (p === 'fortnite' || p === 'roblox') return p;
    return null;
  }

  get platformLabel(): string {
    if (this.platformKey) return gamePlatformMeta(this.platformKey).label;
    return this.platform;
  }

  get platformIconUrl(): string | null {
    if (!this.platformKey) return null;
    return gamePlatformMeta(this.platformKey).iconUrl;
  }

  get artUrl(): string | null {
    if (!this.detailed || !this.platformKey) return null;
    return gamePlatformMeta(this.platformKey).artUrl;
  }

  get displayTime(): string {
    return this.relativeTime || formatMatchRelativeTime(this.updatedAt);
  }

  get outcome() {
    return getMatchOutcome(this.stats.placement);
  }

  get kdRatio(): string {
    const kills = this.stats.kills ?? 0;
    const deaths = this.stats.deaths ?? 0;
    return computeKdRatio(kills, deaths);
  }

  get modeLabel(): string {
    if (this.isVictory) return 'Victoria';
    if (!this.detailed) return `${this.platformLabel} · ${this.matchId}`;

    const summary = this.summary?.trim();
    if (!summary) return this.platformLabel;

    const segment = summary.split('·')[0]?.trim();
    return segment || this.platformLabel;
  }
}
