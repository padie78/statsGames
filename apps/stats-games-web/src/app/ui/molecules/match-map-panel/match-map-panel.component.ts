import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewEncapsulation,
  signal,
} from '@angular/core';
import type {
  MatchMapEvent,
  MatchMapEventType,
  MatchMapPoint,
  MatchMapTelemetry,
} from '../../../core/telemetry/match-map-telemetry.types';
import {
  formatMapTime,
  interpolatePath,
} from '../../../utils/match-map-telemetry.mock';
import { NeonBadgeComponent } from '../../atoms/neon-badge/neon-badge.component';

const EVENT_META: Record<
  MatchMapEventType,
  { label: string; color: string; tone: 'cyan' | 'lime' | 'purple' | 'muted' }
> = {
  spawn: { label: 'Spawn', color: '#8fa3c4', tone: 'muted' },
  kill: { label: 'Kill', color: '#f5d075', tone: 'lime' },
  death: { label: 'Death', color: '#ff9a9a', tone: 'muted' },
  storm: { label: 'Storm', color: '#22d3ee', tone: 'cyan' },
  rotate: { label: 'Rotate', color: '#a78bfa', tone: 'purple' },
  damage: { label: 'Damage', color: '#fb923c', tone: 'muted' },
  loot: { label: 'Cierre', color: '#86efac', tone: 'lime' },
};

@Component({
  standalone: true,
  selector: 'sg-match-map-panel',
  encapsulation: ViewEncapsulation.None,
  imports: [NeonBadgeComponent],
  template: `
    <section class="sg-match-map u-surface-card u-p-5" aria-label="Mapa de partida Fortnite">
      <header class="sg-match-map__header">
        <div>
          <h3 class="sg-match-map__title">Mapa de la partida</h3>
          <p class="sg-match-map__subtitle u-m-0">
            Reproducí o mové el timeline · cada etapa se describe abajo · {{ telemetry.seasonLabel }}
          </p>
        </div>
        @if (telemetry.isPreview) {
          <sg-neon-badge tone="purple">Preview telemetría</sg-neon-badge>
        }
      </header>

      @if (telemetry.isPreview) {
        <p class="sg-match-map__preview u-m-0">
          Datos simulados localmente. El companion enviará path real + eventos por webhook/S3.
        </p>
      }

      <div class="sg-match-map__layout">
        <div class="sg-match-map__map-column">
          <div class="sg-match-map__canvas-wrap">
            <img
              class="sg-match-map__base"
              [src]="telemetry.mapAssetUrl"
              alt=""
              aria-hidden="true"
            />
            <svg class="sg-match-map__overlay" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              <polyline
                class="sg-match-map__path sg-match-map__path--outline"
                [attr.points]="pathPoints()"
                fill="none"
              />
              <polyline
                class="sg-match-map__path"
                [attr.points]="pathPoints()"
                fill="none"
              />
              <polyline
                class="sg-match-map__path sg-match-map__path--progress-outline"
                [attr.points]="progressPathPoints()"
                fill="none"
              />
              <polyline
                class="sg-match-map__path sg-match-map__path--progress"
                [attr.points]="progressPathPoints()"
                fill="none"
              />

              @for (event of telemetry.events; track eventKey(event)) {
                <g
                  class="sg-match-map__event"
                  [class.sg-match-map__event--active]="isEventActive(event)"
                  [class.sg-match-map__event--selected]="isEventSelected(event)"
                  [attr.transform]="'translate(' + toSvg(event.x) + ',' + toSvg(event.y) + ')'"
                  (click)="selectEvent(event); $event.stopPropagation()"
                  role="button"
                  tabindex="0"
                  [attr.aria-label]="(event.label ?? eventLabel(event.type)) + ' en ' + (event.poi ?? 'mapa')"
                >
                  <circle class="sg-match-map__event-hit" r="4" />
                  <circle r="2.2" [attr.fill]="eventColor(event.type)" opacity="0.28" />
                  <circle r="1.2" [attr.fill]="eventColor(event.type)" />
                </g>
              }

              <g [attr.transform]="'translate(' + toSvg(playerPosition().x) + ',' + toSvg(playerPosition().y) + ')'">
                <circle class="sg-match-map__player-halo" r="2.8" />
                <circle class="sg-match-map__player" r="1.35" />
              </g>
            </svg>
          </div>

          @if (currentStage(); as event) {
            <article class="sg-match-map__node-summary u-surface-card u-p-4" aria-live="polite">
              <header class="sg-match-map__node-summary-header">
                <div>
                  <p class="sg-match-map__node-summary-time u-m-0">
                    {{ stagePhase(event.t) }}
                    · {{ formatMapTime(event.t) }}
                    @if (event.poi) {
                      <span>· {{ event.poi }}</span>
                    }
                    <span class="sg-match-map__node-summary-step">
                      · Etapa {{ stageIndex(event) }} / {{ telemetry.events.length }}
                    </span>
                  </p>
                  <h4 class="sg-match-map__node-summary-title">
                    {{ event.label ?? eventLabel(event.type) }}
                  </h4>
                </div>
                <div class="sg-match-map__node-summary-badges">
                  <sg-neon-badge [tone]="eventTone(event.type)">{{ eventLabel(event.type) }}</sg-neon-badge>
                  @if (event.impact) {
                    <sg-neon-badge tone="lime">{{ event.impact }}</sg-neon-badge>
                  }
                </div>
              </header>
              <p class="sg-match-map__node-summary-body u-m-0">
                {{ event.detail ?? defaultDetail(event) }}
              </p>
              <div class="sg-match-map__node-summary-actions">
                <button type="button" class="u-btn u-btn--ghost" (click)="seekToPrevStage()">
                  Etapa anterior
                </button>
                <button type="button" class="u-btn u-btn--ghost" (click)="seekToNextStage()">
                  Siguiente etapa
                </button>
              </div>
            </article>
          }
        </div>

        <aside class="sg-match-map__sidebar">
          <div class="sg-match-map__timeline">
            <div class="sg-match-map__timeline-labels">
              <span>0:00</span>
              <span class="sg-match-map__timeline-current">{{ formatMapTime(currentTime()) }}</span>
              <span>{{ formatMapTime(telemetry.durationSec) }}</span>
            </div>
            <input
              type="range"
              class="sg-match-map__slider"
              min="0"
              [max]="telemetry.durationSec"
              [value]="currentTime()"
              (input)="onTimelineInput($event)"
            />
            <div class="sg-match-map__timeline-actions">
              <button type="button" class="u-btn u-btn--ghost" (click)="step(-15)">−15s</button>
              <button type="button" class="u-btn u-btn--ghost" (click)="togglePlayback()">
                {{ playing() ? 'Pausar' : 'Reproducir' }}
              </button>
              <button type="button" class="u-btn u-btn--ghost" (click)="step(15)">+15s</button>
            </div>
          </div>

          <div class="sg-match-map__legend">
            @for (type of legendTypes; track type) {
              <span class="sg-match-map__legend-item">
                <span class="sg-match-map__legend-dot" [style.background]="eventColor(type)"></span>
                {{ eventLabel(type) }}
              </span>
            }
          </div>

          <div class="sg-match-map__events">
            <h4 class="sg-match-map__events-title">Qué pasó en el mapa</h4>
            <ul class="sg-match-map__event-list">
              @for (event of sortedEvents(); track eventKey(event)) {
                <li
                  class="sg-match-map__event-row"
                  [class.sg-match-map__event-row--active]="isEventActive(event)"
                  [class.sg-match-map__event-row--selected]="isEventSelected(event)"
                >
                  <button
                    type="button"
                    class="sg-match-map__event-button"
                    (click)="selectEvent(event)"
                  >
                    <span class="sg-match-map__event-time">{{ formatMapTime(event.t) }}</span>
                    <span class="sg-match-map__event-copy">
                      <strong>{{ event.label ?? eventLabel(event.type) }}</strong>
                      @if (event.poi) {
                        <span class="sg-match-map__event-poi">{{ event.poi }}</span>
                      }
                      <span class="sg-match-map__event-detail">
                        {{ event.detail ?? defaultDetail(event) }}
                      </span>
                    </span>
                    <sg-neon-badge [tone]="eventTone(event.type)" class="sg-match-map__event-badge">
                      {{ eventLabel(event.type) }}
                    </sg-neon-badge>
                  </button>
                </li>
              }
            </ul>
          </div>
        </aside>
      </div>
    </section>
  `,
})
export class MatchMapPanelComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) telemetry!: MatchMapTelemetry;

  readonly currentTime = signal(0);
  readonly playing = signal(false);
  readonly selectedEvent = signal<MatchMapEvent | null>(null);

  readonly legendTypes: MatchMapEventType[] = ['spawn', 'kill', 'storm', 'rotate', 'death', 'loot'];

  readonly formatMapTime = formatMapTime;

  private playbackTimer: ReturnType<typeof setInterval> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['telemetry']) {
      this.stopPlayback();
      this.currentTime.set(0);
      this.selectedEvent.set(null);
    }
  }

  ngOnDestroy(): void {
    this.stopPlayback();
  }

  playerPosition(): MatchMapPoint {
    return interpolatePath(this.telemetry.path, this.currentTime());
  }

  sortedEvents(): MatchMapEvent[] {
    return [...this.telemetry.events].sort((a, b) => a.t - b.t);
  }

  /** Etapa activa según el tiempo del timeline (o el nodo seleccionado). */
  currentStage(): MatchMapEvent | null {
    const events = this.sortedEvents();
    if (events.length === 0) return null;

    const selected = this.selectedEvent();
    if (selected) return selected;

    const t = this.currentTime();
    let current = events[0];
    for (const event of events) {
      if (event.t <= t) current = event;
      else break;
    }
    return current;
  }

  stageIndex(event: MatchMapEvent): number {
    const idx = this.sortedEvents().findIndex(
      (item) => item.t === event.t && item.type === event.type && item.poi === event.poi,
    );
    return idx >= 0 ? idx + 1 : 1;
  }

  stagePhase(t: number): string {
    const duration = Math.max(this.telemetry.durationSec, 1);
    const ratio = t / duration;
    if (ratio < 0.22) return 'Early game';
    if (ratio < 0.55) return 'Mid game';
    if (ratio < 0.78) return 'Late game';
    return 'Endgame';
  }

  seekToPrevStage(): void {
    const events = this.sortedEvents();
    const current = this.currentStage();
    if (!current || events.length === 0) return;
    const idx = events.findIndex(
      (item) => item.t === current.t && item.type === current.type && item.poi === current.poi,
    );
    const prev = events[Math.max(0, idx - 1)];
    if (prev) this.selectEvent(prev);
  }

  seekToNextStage(): void {
    const events = this.sortedEvents();
    const current = this.currentStage();
    if (!current || events.length === 0) return;
    const idx = events.findIndex(
      (item) => item.t === current.t && item.type === current.type && item.poi === current.poi,
    );
    const next = events[Math.min(events.length - 1, idx + 1)];
    if (next) this.selectEvent(next);
  }

  eventKey(event: MatchMapEvent): string {
    return `${event.t}-${event.type}-${event.poi ?? ''}`;
  }

  pathPoints(): string {
    return this.telemetry.path
      .map((point) => `${this.toSvg(point.x)},${this.toSvg(point.y)}`)
      .join(' ');
  }

  progressPathPoints(): string {
    const t = this.currentTime();
    const visible = this.telemetry.path.filter((point) => point.t <= t);
    if (visible.length === 0) return '';
    const head = interpolatePath(this.telemetry.path, t);
    const points = [...visible, head];
    return points.map((point) => `${this.toSvg(point.x)},${this.toSvg(point.y)}`).join(' ');
  }

  toSvg(value: number): number {
    return Math.round(value * 1000) / 10;
  }

  eventColor(type: MatchMapEventType): string {
    return EVENT_META[type].color;
  }

  eventLabel(type: MatchMapEventType): string {
    return EVENT_META[type].label;
  }

  eventTone(type: MatchMapEventType): 'cyan' | 'lime' | 'purple' | 'muted' {
    return EVENT_META[type].tone;
  }

  isEventActive(event: MatchMapEvent): boolean {
    return Math.abs(event.t - this.currentTime()) <= 8;
  }

  isEventSelected(event: MatchMapEvent): boolean {
    const selected = this.selectedEvent();
    return !!selected && selected.t === event.t && selected.type === event.type;
  }

  selectEvent(event: MatchMapEvent): void {
    this.selectedEvent.set(event);
    this.seekTo(event.t);
  }

  defaultDetail(event: MatchMapEvent): string {
    const place = event.poi ? ` en ${event.poi}` : '';
    return `${eventLabelFallback(event.type)}${place} a los ${formatMapTime(event.t)}.`;
  }

  onTimelineInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.selectedEvent.set(null);
    this.currentTime.set(value);
  }

  seekTo(seconds: number): void {
    this.currentTime.set(Math.max(0, Math.min(this.telemetry.durationSec, seconds)));
  }

  step(delta: number): void {
    this.seekTo(this.currentTime() + delta);
  }

  togglePlayback(): void {
    if (this.playing()) {
      this.stopPlayback();
      return;
    }

    this.selectedEvent.set(null);
    this.playing.set(true);
    this.playbackTimer = setInterval(() => {
      const next = this.currentTime() + 2;
      if (next >= this.telemetry.durationSec) {
        this.currentTime.set(this.telemetry.durationSec);
        this.stopPlayback();
        return;
      }
      this.currentTime.set(next);
    }, 400);
  }

  private stopPlayback(): void {
    this.playing.set(false);
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }
}

function eventLabelFallback(type: MatchMapEventType): string {
  return EVENT_META[type].label;
}
