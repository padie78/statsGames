import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gamePlatformMeta } from '../../../core/game/game-platform.config';
import {
  lolChampionKey,
  lolChampionSplashFallbackUrl,
  lolChampionSplashUrl,
} from '../../../core/game/lol-ddragon.util';
import {
  normalizeSelectedGame,
  type SelectedGame,
} from '../../../core/game/selected-game';
import { formatMatchRelativeTime } from '../../../utils/match-stats.util';
import {
  buildMatchCardStatCells,
  getMatchOutcomeForPlatform,
  isMatchWin,
  normalizeStatsPlatform,
} from '../../../utils/platform-stats.util';
import { matchDetailRoute } from '../../../utils/match-analysis.util';
import { parseMatchSummary } from '../../../utils/match-display.util';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';
import { StatValueComponent } from '../../atoms/stat-value/stat-value.component';

export interface MatchCardStats {
  kills?: number | null;
  deaths?: number | null;
  placement?: number | null;
  assists?: number | null;
  headshotPct?: number | null;
  roundsWon?: number | null;
  roundsLost?: number | null;
  map?: string | null;
  agent?: string | null;
  mode?: string | null;
  won?: boolean | null;
  score?: number | null;
  adr?: number | null;
  champion?: string | null;
  role?: string | null;
  cs?: number | null;
  visionScore?: number | null;
  goals?: number | null;
  saves?: number | null;
  shots?: number | null;
  shotPct?: number | null;
  durationSec?: number | null;
  goldEarned?: number | null;
  champLevel?: number | null;
  teamBarons?: number | null;
  teamDragons?: number | null;
  teamTowers?: number | null;
}

@Component({
  standalone: true,
  selector: 'sg-match-stat-card',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, RouterLink, NeonBadgeComponent, StatValueComponent],
  template: `
    @if (clickable && !live && openMode === 'route' && detailLink) {
      <a [routerLink]="detailLink" class="sg-match-card-link">
        <ng-container *ngTemplateOutlet="cardInner" />
      </a>
    } @else if (clickable && !live && openMode === 'event') {
      <button
        type="button"
        class="sg-match-card-link sg-match-card-link--button"
        (click)="openMatch.emit()"
      >
        <ng-container *ngTemplateOutlet="cardInner" />
      </button>
    } @else {
      <ng-container *ngTemplateOutlet="cardInner" />
    }

    <ng-template #cardInner>
      @if (detailed) {
        <article
          class="sg-match-panel sg-match-card sg-match-card--panel u-surface-card"
          [class.sg-match-panel--hero]="hero"
          [class.sg-match-card--victory]="isVictory"
          [class.sg-match-card--defeat]="isDefeat"
          [class.sg-match-card--live]="live"
          [class.sg-match-card--fresh]="fresh"
          [class.sg-match-card--with-art]="!!activePanelArtUrl"
          [attr.data-game]="platformKey"
          [class.sg-match-card--clickable]="clickable"
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
                @if (displaySummary) {
                  <p class="sg-match-panel__summary">{{ displaySummary }}</p>
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
              <span class="sg-match-panel__time">{{ displayTime }}</span>
              @if (live) {
                <span class="sg-match-panel__live">Live</span>
              } @else {
                <span class="sg-match-panel__platform">{{ platformLabel }}</span>
              }
            </footer>
          </div>
        </article>
      } @else {
        <article
          class="sg-match-card"
          [class.sg-match-card--live]="live"
          [class.sg-match-card--fresh]="fresh"
          [class.sg-match-card--victory]="isVictory"
          [class.sg-match-card--podium]="isPodium"
          [class.sg-match-card--fortnite]="platformKey === 'fortnite'"
          [attr.data-game]="platformKey"
          [class.sg-match-card--clickable]="clickable"
        >
          @if (fresh) {
            <span class="sg-match-card__fresh-badge" aria-hidden="true">Nueva</span>
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
                    <h3 class="sg-match-card__title">{{ modeLabel }}</h3>
                    <p class="sg-match-card__subtitle">{{ displayTime }}</p>
                  </div>
                </div>
              </div>
              <div class="sg-match-card__badges">
                @if (live) {
                  <sg-neon-badge tone="gold" [pulse]="true">Live</sg-neon-badge>
                }
                <sg-neon-badge tone="gold">{{ outcome.label }}</sg-neon-badge>
              </div>
            </header>

            @if (displaySummary) {
              <p class="sg-match-card__summary">{{ displaySummary }}</p>
            }

            <div class="sg-match-card__stats">
              @for (cell of statCells; track cell.label) {
                <sg-stat-value
                  [label]="cell.label"
                  [value]="cell.value"
                  [accent]="cell.accent ?? 'default'"
                />
              }
            </div>
          </div>
        </article>
      }
    </ng-template>
  `,
})
export class MatchStatCardComponent {
  @Input({ required: true }) matchId!: string;
  @Input({ required: true }) platform!: string;
  @Input() summary = '';
  @Input() updatedAt = '';
  @Input() relativeTime = '';
  @Input() live = false;
  /** Partida recién llegada por realtime — anima entrada. */
  @Input() fresh = false;
  @Input() detailed = false;
  @Input() clickable = false;
  /** Vista detalle: panel más alto con splash más presente. */
  @Input() hero = false;
  /** `route` navega al detalle; `event` emite openMatch (modal). */
  @Input() openMode: 'route' | 'event' = 'route';
  @Input() stats: MatchCardStats = {};
  @Output() readonly openMatch = new EventEmitter<void>();

  /** Tras fallo del splash centered, probar Data Dragon. */
  private panelArtFallback: string | null | undefined = undefined;

  get detailLink(): string | null {
    if (!this.clickable || this.live || this.openMode !== 'route') return null;
    return matchDetailRoute(this.matchId);
  }

  get isVictory(): boolean {
    return isMatchWin(this.stats);
  }

  get isDefeat(): boolean {
    if (this.stats.won === false) return true;
    if (this.isVictory) return false;
    return this.outcome.label === 'Derrota';
  }

  get resultKind(): 'win' | 'loss' | 'other' {
    if (this.isVictory) return 'win';
    if (this.isDefeat) return 'loss';
    return 'other';
  }

  get isPodium(): boolean {
    const p = this.stats.placement;
    return p != null && p > 1 && p <= 3 && normalizeStatsPlatform(this.platform) === 'fortnite';
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

  get platformIconUrl(): string | null {
    if (!this.platformKey) return null;
    return gamePlatformMeta(this.platformKey).iconUrl;
  }

  get displayTime(): string {
    return this.relativeTime || formatMatchRelativeTime(this.updatedAt);
  }

  get outcome() {
    return getMatchOutcomeForPlatform(this.platform, this.stats);
  }

  get statCells() {
    return buildMatchCardStatCells(this.platform, this.stats, false);
  }

  /** KPIs del panel (Rol va en eyebrow). */
  get panelStatCells() {
    return buildMatchCardStatCells(this.platform, this.stats, true)
      .filter((cell) => cell.label !== 'Rol')
      .slice(0, 8);
  }

  get primaryMetric() {
    return this.panelStatCells[0] ?? null;
  }

  get secondaryMetrics() {
    return this.panelStatCells.slice(1);
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

  /** Campeón desde stats o summary (ej. "Ranked Solo · Jinx · ADC"). */
  get resolvedChampion(): string | null {
    const direct = this.stats.champion ?? this.stats.agent;
    if (direct?.trim()) return direct.trim();
    if (this.platformKey !== 'league_of_legends') return null;

    const skip =
      /^(victoria|derrota|ranked|flex|aram|normal|solo|duo|draft|blind|top|jungle|mid|middle|adc|bot|support|supp|win|loss|ranked solo|ranked flex)/i;
    for (const seg of this.summary
      .split('·')
      .map((part) => part.trim())
      .filter(Boolean)) {
      if (skip.test(seg)) continue;
      if (lolChampionKey(seg)) return seg;
    }
    return null;
  }

  /**
   * Splash del campeón jugado (LoL).
   * Sin campeón: arte genérico del juego — nunca otro campeón al azar.
   */
  get panelArtUrl(): string | null {
    if (this.platformKey !== 'league_of_legends') return null;
    return (
      lolChampionSplashUrl(this.resolvedChampion) ??
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
      lolChampionSplashFallbackUrl(this.resolvedChampion) ??
      gamePlatformMeta('league_of_legends').artUrl;
  }

  get modeLabel(): string {
    if (this.isVictory) return '¡Victoria!';
    if (this.isPodium) return 'Podio conseguido';
    if (!this.detailed) {
      const agent = this.stats.agent ?? this.stats.champion;
      const map = this.stats.map;
      if (agent && map) return `${agent} · ${map}`;
      if (agent) return agent;
      if (map) return map;
      return `${this.platformLabel} · ${this.matchId}`;
    }

    return parseMatchSummary(this.platform, this.summary).primaryLabel || 'Partida';
  }

  /** Título del panel: campeón/modo (el listón ya marca victoria/derrota). */
  get panelTitle(): string {
    if (this.resolvedChampion) return this.resolvedChampion;
    return parseMatchSummary(this.platform, this.summary).primaryLabel || 'Partida';
  }

  get panelEyebrow(): string | null {
    const bits: string[] = [];
    if (this.stats.role?.trim()) bits.push(this.stats.role.trim());
    const mode =
      this.stats.mode?.trim() ||
      parseMatchSummary(this.platform, this.summary).modeLabel ||
      null;
    if (mode && mode.toLowerCase() !== this.panelTitle.toLowerCase()) {
      bits.push(mode);
    }
    if (bits.length === 0) return null;
    return bits.join(' · ');
  }

  get displaySummary(): string | null {
    const parsed = parseMatchSummary(this.platform, this.summary);
    if (parsed.detailLine) return parsed.detailLine;
    // Si el título ya es el modo/campeón, no repetir el summary crudo entero.
    if (this.summary?.trim() && this.summary.trim() !== this.panelTitle) {
      return this.summary.trim();
    }
    return null;
  }
}
