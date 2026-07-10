import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import type { MatchCardStats } from '../match-stat-card/match-stat-card.component';

@Component({
  standalone: true,
  selector: 'sg-match-highlight-card',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NeonBadgeComponent],
  template: `
  @if (matchId) {
    <section
      class="sg-match-highlight"
      [class.sg-match-highlight--victory]="isVictory"
      [class.sg-match-highlight--roblox]="platformKey === 'roblox'"
      [class.sg-match-highlight--fortnite]="platformKey === 'fortnite'"
    >
      <img
        class="sg-match-highlight__art"
        [src]="artUrl"
        [alt]="platform + ' highlight'"
        aria-hidden="true"
      />
      <div class="sg-match-highlight__overlay" aria-hidden="true"></div>

      <div class="sg-match-highlight__content">
        <header class="sg-match-highlight__header">
          @if (isVictory) {
            <sg-neon-badge tone="lime" [pulse]="true">Victoria</sg-neon-badge>
          } @else {
            <sg-neon-badge tone="lime">Destacada</sg-neon-badge>
          }
          <sg-neon-badge [tone]="platformKey === 'roblox' ? 'purple' : 'cyan'">
            {{ platformLabel }}
          </sg-neon-badge>
        </header>

        <h2 class="sg-match-highlight__title">{{ headline }}</h2>
        <p class="sg-match-highlight__summary">{{ summary || 'Sin resumen' }}</p>

        <div class="sg-match-highlight__stats">
          <div
            class="sg-match-highlight__stat"
            [class.sg-match-highlight__stat--accent]="isVictory || isPodium"
          >
            <span class="sg-match-highlight__stat-value">{{ stats.placement != null ? '#' + stats.placement : '—' }}</span>
            <span class="sg-match-highlight__stat-label">Placement</span>
          </div>
          <div
            class="sg-match-highlight__stat"
            [class.sg-match-highlight__stat--accent]="isVictory"
          >
            <span class="sg-match-highlight__stat-value">{{ stats.kills ?? '—' }}</span>
            <span class="sg-match-highlight__stat-label">Kills</span>
          </div>
          <div class="sg-match-highlight__stat">
            <span class="sg-match-highlight__stat-value">{{ stats.deaths ?? '—' }}</span>
            <span class="sg-match-highlight__stat-label">Deaths</span>
          </div>
        </div>

        <div class="sg-match-highlight__footer">
          <span class="sg-match-highlight__meta">{{ matchId }} · {{ updatedAt }}</span>
          @if (showHistoryLink) {
            <a routerLink="/tabs/matches" class="u-btn u-btn--ghost">Ver historial</a>
          }
        </div>
      </div>
    </section>
  }
  `,
})
export class MatchHighlightCardComponent {
  @Input() matchId = '';
  @Input() platform = '';
  @Input() summary = '';
  @Input() updatedAt = '';
  @Input() stats: MatchCardStats = {};
  @Input() showHistoryLink = true;

  get isVictory(): boolean {
    return this.stats.placement === 1;
  }

  get isPodium(): boolean {
    const p = this.stats.placement;
    return p != null && p > 1 && p <= 3;
  }

  get headline(): string {
    if (this.isVictory) return '¡Victoria!';
    if (this.isPodium) return 'Podio conseguido';
    return 'Mejor partida reciente';
  }

  get platformKey(): SelectedGame | null {
    const p = this.platform?.toLowerCase();
    if (p === 'roblox' || p === 'fortnite') return p;
    return null;
  }

  get platformLabel(): string {
    if (this.platformKey) return gamePlatformMeta(this.platformKey).label;
    return this.platform;
  }

  get artUrl(): string {
    if (this.platformKey) return gamePlatformMeta(this.platformKey).artUrl;
    return '/assets/games/fortnite-hero.png';
  }
}
