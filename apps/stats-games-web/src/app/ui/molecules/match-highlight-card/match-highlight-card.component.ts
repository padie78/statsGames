import { Component, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import type { SelectedGame } from '../../../core/services/auth.service';
import { matchDetailRoute } from '../../../utils/match-analysis.util';
import {
  buildMatchCardStatCells,
  isMatchWin,
  normalizeStatsPlatform,
} from '../../../utils/platform-stats.util';
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
      [class.sg-match-highlight--compact]="compact"
      [class.sg-match-highlight--victory]="isVictory"
      [attr.data-game]="platformKey"
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
          <sg-neon-badge [tone]="platformTone">
            {{ platformLabel }}
          </sg-neon-badge>
        </header>

        <h2 class="sg-match-highlight__title">{{ headline }}</h2>
        <p class="sg-match-highlight__summary">{{ summary || 'Sin resumen' }}</p>

        <div class="sg-match-highlight__stats">
          @for (cell of highlightCells; track cell.label) {
            <div
              class="sg-match-highlight__stat"
              [class.sg-match-highlight__stat--accent]="isVictory || isPodium"
            >
              <span class="sg-match-highlight__stat-value">{{ cell.value }}</span>
              <span class="sg-match-highlight__stat-label">{{ cell.label }}</span>
            </div>
          }
        </div>

        <div class="sg-match-highlight__footer">
          @if (!compact) {
            <span class="sg-match-highlight__meta">{{ matchId }} · {{ updatedAt }}</span>
          } @else {
            <span class="sg-match-highlight__meta">{{ updatedAt }}</span>
          }
          <div class="sg-match-highlight__actions">
            @if (matchId) {
              <a
                [routerLink]="detailLink"
                class="u-btn"
                [class.u-btn--sm]="compact"
                [class.u-btn--gold]="compact"
                [class.u-btn--primary]="!compact"
              >
                {{ compact ? 'Ver partida' : 'Ver análisis IA' }}
              </a>
            }
            @if (showHistoryLink) {
              <a
                routerLink="/tabs/matches"
                class="u-btn"
                [class.u-btn--sm]="compact"
                [class.u-btn--ghost-gold]="compact"
                [class.u-btn--ghost]="!compact"
              >
                Ver historial
              </a>
            }
          </div>
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
  /** Variante densa para Inicio (menos alto / menos padding). */
  @Input() compact = false;

  get isVictory(): boolean {
    return isMatchWin(this.stats);
  }

  get isPodium(): boolean {
    const p = this.stats.placement;
    return (
      p != null &&
      p > 1 &&
      p <= 3 &&
      normalizeStatsPlatform(this.platform) === 'fortnite'
    );
  }

  get headline(): string {
    if (this.isVictory) return '¡Victoria!';
    if (this.isPodium) return 'Podio conseguido';
    return 'Mejor partida reciente';
  }

  get highlightCells() {
    return buildMatchCardStatCells(this.platform, this.stats, false).slice(0, 3);
  }

  get platformKey(): SelectedGame | null {
    const p = normalizeStatsPlatform(this.platform);
    if (
      p === 'fortnite' ||
      p === 'valorant' ||
      p === 'rocket_league' ||
      p === 'league_of_legends' ||
      p === 'cs2' ||
      p === 'dota2' ||
      p === 'overwatch2' ||
      p === 'clash_royale' ||
      p === 'brawl_stars' ||
      p === 'blox_fruits' ||
      p === 'adopt_me' ||
      p === 'brookhaven'
    ) {
      return p;
    }
    return null;
  }

  get platformLabel(): string {
    if (this.platformKey) return gamePlatformMeta(this.platformKey).label;
    return this.platform;
  }

  get platformTone(): 'cyan' | 'purple' | 'lime' {
    const g = this.platformKey;
    if (g === 'valorant' || g === 'adopt_me') return 'purple';
    if (g === 'blox_fruits' || g === 'brookhaven' || g === 'league_of_legends') return 'lime';
    return 'cyan';
  }

  get artUrl(): string {
    if (this.platformKey) return gamePlatformMeta(this.platformKey).artUrl;
    return '/assets/games/fortnite-hero.png';
  }

  get detailLink(): string {
    return matchDetailRoute(this.matchId);
  }
}
