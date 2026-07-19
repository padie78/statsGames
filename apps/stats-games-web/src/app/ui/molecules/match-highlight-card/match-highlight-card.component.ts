import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import {
  lolChampionSplashFallbackUrl,
  lolChampionSplashUrl,
} from '../../../core/game/lol-ddragon.util';
import {
  normalizeSelectedGame,
  type SelectedGame,
} from '../../../core/game/selected-game';
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
  imports: [NgTemplateOutlet, RouterLink, NeonBadgeComponent],
  template: `
  @if (matchId) {
    @if (compact) {
      @if (openMode === 'event') {
        <button
          type="button"
          class="sg-match-card-link sg-match-card-link--button"
          aria-label="Ver partida destacada"
          (click)="openMatch.emit()"
        >
          <ng-container *ngTemplateOutlet="compactPanel" />
        </button>
      } @else {
        <a
          [routerLink]="detailLink"
          class="sg-match-card-link"
          aria-label="Ver partida destacada"
        >
          <ng-container *ngTemplateOutlet="compactPanel" />
        </a>
      }

      <ng-template #compactPanel>
        <section
          class="sg-match-panel sg-match-highlight sg-match-highlight--panel sg-match-card--panel u-surface-card"
          [class.sg-match-highlight--victory]="isVictory"
          [class.sg-match-card--defeat]="isDefeat"
          [class.sg-match-card--fresh]="fresh"
          [class.sg-match-card--with-art]="!!activePanelArtUrl"
          [attr.data-game]="platformKey"
          aria-label="Partida destacada"
        >
          @if (fresh) {
            <span class="sg-match-card__fresh-badge" aria-hidden="true">Nueva</span>
          }
          @if (activePanelArtUrl) {
            <div class="sg-match-card__art-fx" aria-hidden="true">
              <img
                class="sg-match-card__art"
                [src]="activePanelArtUrl"
                alt=""
                (error)="onPanelArtError()"
              />
              <span class="sg-match-card__art-fx-sweep"></span>
            </div>
            <div class="sg-match-card__art-overlay" aria-hidden="true"></div>
          }
          @if (resultKind === 'win' || resultKind === 'loss') {
            <div
              class="sg-match-card__award"
              [attr.data-outcome]="resultKind"
              [attr.aria-label]="resultKind === 'win' ? 'Victoria' : 'Derrota'"
            >
              <span class="sg-match-card__award-band">
                {{ resultKind === 'win' ? 'Victoria' : 'Derrota' }}
              </span>
            </div>
          }

          <div class="sg-match-panel__body">
            <header class="sg-match-panel__head">
              <div class="sg-match-panel__head-copy">
                @if (panelEyebrow) {
                  <p class="sg-match-panel__eyebrow">{{ panelEyebrow }}</p>
                }
                <h3 class="sg-match-panel__title">{{ panelTitle }}</h3>
                @if (summary) {
                  <p class="sg-match-panel__summary">{{ summary }}</p>
                }
              </div>

              @if (primaryKda; as kda) {
                <div
                  class="sg-match-panel__score"
                  [attr.aria-label]="'KDA ' + kda.k + '/' + kda.d + '/' + kda.a"
                >
                  <div class="sg-match-panel__score-part">
                    <span class="sg-match-panel__score-num">{{ kda.k }}</span>
                    <span class="sg-match-panel__score-label">K</span>
                  </div>
                  <span class="sg-match-panel__score-slash" aria-hidden="true">/</span>
                  <div class="sg-match-panel__score-part">
                    <span class="sg-match-panel__score-num">{{ kda.d }}</span>
                    <span class="sg-match-panel__score-label">D</span>
                  </div>
                  <span class="sg-match-panel__score-slash" aria-hidden="true">/</span>
                  <div class="sg-match-panel__score-part">
                    <span class="sg-match-panel__score-num">{{ kda.a }}</span>
                    <span class="sg-match-panel__score-label">A</span>
                  </div>
                </div>
              } @else if (primaryMetric) {
                <div class="sg-match-panel__score">
                  <div class="sg-match-panel__score-part">
                    <span class="sg-match-panel__score-num">{{ primaryMetric.value }}</span>
                    <span class="sg-match-panel__score-label">{{ primaryMetric.label }}</span>
                  </div>
                </div>
              }
            </header>

            @if (secondaryMetrics.length > 0) {
              <ul class="sg-match-panel__strip" aria-label="Estadísticas de la partida">
                @for (cell of secondaryMetrics; track cell.label) {
                  <li class="sg-match-panel__strip-item">
                    <span class="sg-match-panel__strip-value">{{ cell.value }}</span>
                    <span class="sg-match-panel__strip-label">{{ cell.label }}</span>
                  </li>
                }
              </ul>
            }

            <footer class="sg-match-panel__foot">
              <span class="sg-match-panel__time">{{ updatedAt }}</span>
              <span class="sg-match-panel__platform">{{ platformLabel }}</span>
            </footer>
          </div>
        </section>
      </ng-template>
    } @else {
      <section
        class="sg-match-highlight"
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
            <span class="sg-match-highlight__meta-text">{{ matchId }} · {{ updatedAt }}</span>
            <div class="sg-match-highlight__actions">
              <a [routerLink]="detailLink" class="u-btn u-btn--primary">Ver análisis IA</a>
              @if (showHistoryLink) {
                <a routerLink="/tabs/matches" class="u-btn u-btn--ghost">Ver historial</a>
              }
            </div>
          </div>
        </div>
      </section>
    }
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
  /** Variante panel (Inicio): misma cáscara que ranking / análisis semanal. */
  @Input() compact = false;
  /** Partida recién llegada por realtime. */
  @Input() fresh = false;
  /** `route` navega al detalle; `event` emite openMatch (modal). */
  @Input() openMode: 'route' | 'event' = 'route';
  @Output() readonly openMatch = new EventEmitter<void>();

  private panelArtFallback: string | null | undefined = undefined;

  get isVictory(): boolean {
    return isMatchWin(this.stats);
  }

  get isDefeat(): boolean {
    return this.stats.won === false && !this.isVictory;
  }

  get resultKind(): 'win' | 'loss' | 'other' {
    if (this.isVictory) return 'win';
    if (this.isDefeat) return 'loss';
    return 'other';
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

  get panelTitle(): string {
    const champion = this.stats.champion ?? this.stats.agent;
    if (champion) return champion;
    return this.headline;
  }

  get panelEyebrow(): string | null {
    const bits: string[] = ['Destacada'];
    if (this.stats.role?.trim()) bits.push(this.stats.role.trim());
    if (this.stats.mode?.trim()) bits.push(this.stats.mode.trim());
    return bits.join(' · ');
  }

  get highlightCells() {
    const cells = buildMatchCardStatCells(this.platform, this.stats, this.compact).filter(
      (cell) => cell.label !== 'Rol',
    );
    return cells.slice(0, this.compact ? 8 : 3);
  }

  get primaryMetric() {
    return this.highlightCells[0] ?? null;
  }

  get secondaryMetrics() {
    return this.compact ? this.highlightCells.slice(1) : [];
  }

  get primaryKda(): { k: string; d: string; a: string } | null {
    const primary = this.primaryMetric;
    if (!primary || primary.label !== 'K/D/A') return null;
    const parts = String(primary.value)
      .split('/')
      .map((part) => part.trim());
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) return null;
    return { k: parts[0], d: parts[1], a: parts[2] };
  }

  get platformKey(): SelectedGame | null {
    return (
      normalizeSelectedGame(this.platform) ??
      normalizeSelectedGame(normalizeStatsPlatform(this.platform))
    );
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
    if (this.platformKey === 'league_of_legends') {
      return (
        lolChampionSplashUrl(this.stats.champion) ??
        gamePlatformMeta('league_of_legends').artUrl
      );
    }
    if (this.platformKey) return gamePlatformMeta(this.platformKey).artUrl;
    return '/assets/games/fortnite-hero.png';
  }

  get panelArtUrl(): string | null {
    if (this.platformKey !== 'league_of_legends') return null;
    return (
      lolChampionSplashUrl(this.stats.champion) ??
      gamePlatformMeta('league_of_legends').artUrl
    );
  }

  get activePanelArtUrl(): string | null {
    if (this.panelArtFallback === null) return null;
    if (this.panelArtFallback !== undefined) return this.panelArtFallback;
    return this.panelArtUrl;
  }

  onPanelArtError(): void {
    if (this.panelArtFallback !== undefined) {
      this.panelArtFallback = null;
      return;
    }
    this.panelArtFallback =
      lolChampionSplashFallbackUrl(this.stats.champion) ??
      gamePlatformMeta('league_of_legends').artUrl;
  }

  get detailLink(): string {
    return matchDetailRoute(this.matchId);
  }
}
