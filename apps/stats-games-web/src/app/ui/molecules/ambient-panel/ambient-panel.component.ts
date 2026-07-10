import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import type { SelectedGame } from '../../../core/services/auth.service';
import {
  MediaPlaybackRegistry,
  MediaPolicyService,
  shouldUseStaticMediaMode,
} from '../../../core/media';

export type AmbientPanelVariant = 'hero' | 'banner';

interface AmbientParticle {
  id: number;
  left: string;
  top: string;
  size: string;
  delay: string;
  duration: string;
}

@Component({
  standalone: true,
  selector: 'sg-ambient-panel',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="sg-ambient-panel"
      [class.sg-ambient-panel--hero]="variant === 'hero'"
      [class.sg-ambient-panel--banner]="variant === 'banner'"
      [class.sg-ambient-panel--roblox]="platform === 'roblox'"
      [class.sg-ambient-panel--fortnite]="platform === 'fortnite'"
      [class.sg-ambient-panel--static]="staticMode"
      [class.sg-ambient-panel--animating]="animating"
      aria-hidden="true"
    >
      @if (safeVideoUrl && !staticMode) {
        <video
          #ambientVideo
          class="sg-ambient-panel__video"
          [poster]="posterUrl || artUrl || undefined"
          muted
          loop
          playsinline
          preload="metadata"
        >
          <source [src]="safeVideoUrl" type="video/webm" />
        </video>
      }

      <div class="sg-ambient-panel__canvas">
        <div class="sg-ambient-panel__grid"></div>
        <div class="sg-ambient-panel__storm"></div>
        @for (particle of particles; track particle.id) {
          <span
            class="sg-ambient-panel__particle"
            [style.left]="particle.left"
            [style.top]="particle.top"
            [style.width]="particle.size"
            [style.height]="particle.size"
            [style.animation-delay]="particle.delay"
            [style.animation-duration]="particle.duration"
          ></span>
        }
        <span class="sg-ambient-panel__orb sg-ambient-panel__orb--1"></span>
        <span class="sg-ambient-panel__orb sg-ambient-panel__orb--2"></span>
        <span class="sg-ambient-panel__orb sg-ambient-panel__orb--3"></span>
      </div>

      @if (artUrl) {
        <img class="sg-ambient-panel__art" [src]="artUrl" [alt]="" />
      }

      <div class="sg-ambient-panel__scrim"></div>
      <div class="sg-ambient-panel__glow"></div>
    </div>
  `,
})
export class AmbientPanelComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  private readonly mediaPolicy = inject(MediaPolicyService);
  private readonly playbackRegistry = inject(MediaPlaybackRegistry);

  @Input({ required: true }) platform!: SelectedGame;
  @Input() variant: AmbientPanelVariant = 'hero';
  @Input() artUrl = '';
  @Input() videoUrl = '';
  @Input() posterUrl = '';

  @ViewChild('ambientVideo') private videoRef?: ElementRef<HTMLVideoElement>;

  animating = false;
  safeVideoUrl: string | null = null;

  readonly staticMode = shouldUseStaticMediaMode();
  readonly instanceId = `ambient-${Math.random().toString(36).slice(2, 10)}`;

  readonly particles: AmbientParticle[] = Array.from({ length: 16 }, (_, index) => ({
    id: index,
    left: `${6 + ((index * 19) % 88)}%`,
    top: `${4 + ((index * 27) % 92)}%`,
    size: `${3 + (index % 4)}px`,
    delay: `${(index * 0.31) % 3.6}s`,
    duration: `${2.8 + (index % 5) * 0.55}s`,
  }));

  private visibilityHandler = (): void => this.syncVideoPlayback();
  private animTimer = 0;
  private playbackRegistered = false;

  ngOnInit(): void {
    this.safeVideoUrl = this.mediaPolicy.safeAmbientVideoUrl(this.videoUrl);
  }

  ngAfterViewInit(): void {
    this.syncVideoPlayback();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['videoUrl']) {
      this.safeVideoUrl = this.mediaPolicy.safeAmbientVideoUrl(this.videoUrl);
    }

    if (changes['platform'] && !changes['platform'].firstChange) {
      this.animating = true;
      window.clearTimeout(this.animTimer);
      this.animTimer = window.setTimeout(() => {
        this.animating = false;
      }, 520);
    }

    if (changes['videoUrl']) {
      queueMicrotask(() => this.syncVideoPlayback());
    }
  }

  ngOnDestroy(): void {
    window.clearTimeout(this.animTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.videoRef?.nativeElement.pause();
    if (this.playbackRegistered) {
      this.playbackRegistry.unregister(this.instanceId);
    }
  }

  private syncVideoPlayback(): void {
    const video = this.videoRef?.nativeElement;
    if (!video || this.staticMode || !this.safeVideoUrl) return;

    if (document.hidden) {
      video.pause();
      if (this.playbackRegistered) {
        this.playbackRegistry.unregister(this.instanceId);
        this.playbackRegistered = false;
      }
      return;
    }

    if (!this.playbackRegistry.canRegister()) {
      video.pause();
      return;
    }

    if (!this.playbackRegistered) {
      this.playbackRegistered = this.playbackRegistry.register(this.instanceId);
    }

    if (!this.playbackRegistered) {
      video.pause();
      return;
    }

    video.play().catch(() => undefined);
  }
}
