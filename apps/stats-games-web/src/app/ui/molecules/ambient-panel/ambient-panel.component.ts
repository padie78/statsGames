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
  signal,
} from '@angular/core';
import type { SelectedGame } from '../../../core/services/auth.service';
import {
  MediaPlaybackRegistry,
  MediaPolicyService,
  prefersReducedMotion,
  shouldDisableAmbientVideo,
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
      [attr.data-game]="platform"
      [class.sg-ambient-panel--static]="reduceMotion()"
      [class.sg-ambient-panel--animating]="animating"
      aria-hidden="true"
    >
      @if (safeVideoUrl && !disableVideo()) {
        <video
          #ambientVideo
          class="sg-ambient-panel__video"
          [attr.src]="safeVideoUrl"
          [poster]="posterUrl || artUrl || undefined"
          muted
          loop
          playsinline
          autoplay
          preload="auto"
        ></video>
      }

      <div class="sg-ambient-panel__canvas">
        <div class="sg-ambient-panel__grid"></div>
        <div class="sg-ambient-panel__storm"></div>
        <div class="sg-ambient-panel__shimmer" aria-hidden="true"></div>
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

  readonly reduceMotion = signal(prefersReducedMotion());
  readonly disableVideo = signal(shouldDisableAmbientVideo());

  readonly instanceId = `ambient-${Math.random().toString(36).slice(2, 10)}`;

  readonly particles: AmbientParticle[] = Array.from({ length: 20 }, (_, index) => ({
    id: index,
    left: `${4 + ((index * 17) % 90)}%`,
    top: `${6 + ((index * 23) % 88)}%`,
    size: `${8 + (index % 5) * 3}px`,
    delay: `${(index * 0.22) % 2.8}s`,
    duration: `${2.2 + (index % 5) * 0.45}s`,
  }));

  private visibilityHandler = (): void => this.syncVideoPlayback();
  private mediaQueryHandler = (): void => this.refreshMediaFlags();
  private animTimer = 0;
  private playRetryTimer = 0;
  private playbackRegistered = false;
  private motionQuery?: MediaQueryList;
  private mobileQuery?: MediaQueryList;

  ngOnInit(): void {
    this.safeVideoUrl = this.mediaPolicy.safeAmbientVideoUrl(this.videoUrl);
    this.bindMediaQueries();
    this.refreshMediaFlags();
  }

  ngAfterViewInit(): void {
    this.syncVideoPlayback(true);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const videoChanged = !!changes['videoUrl'];
    const platformChanged = !!changes['platform'] && !changes['platform'].firstChange;

    if (videoChanged) {
      this.safeVideoUrl = this.mediaPolicy.safeAmbientVideoUrl(this.videoUrl);
    }

    if (platformChanged) {
      this.animating = true;
      window.clearTimeout(this.animTimer);
      this.animTimer = window.setTimeout(() => {
        this.animating = false;
      }, 520);
    }

    if (videoChanged || platformChanged) {
      queueMicrotask(() => this.syncVideoPlayback(true));
    }
  }

  ngOnDestroy(): void {
    window.clearTimeout(this.animTimer);
    window.clearTimeout(this.playRetryTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.motionQuery?.removeEventListener('change', this.mediaQueryHandler);
    this.mobileQuery?.removeEventListener('change', this.mediaQueryHandler);
    this.videoRef?.nativeElement.pause();
    if (this.playbackRegistered) {
      this.playbackRegistry.unregister(this.instanceId);
    }
  }

  private bindMediaQueries(): void {
    if (typeof window === 'undefined') return;
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mobileQuery = window.matchMedia(`(max-width: 767px)`);
    this.motionQuery.addEventListener('change', this.mediaQueryHandler);
    this.mobileQuery.addEventListener('change', this.mediaQueryHandler);
  }

  private refreshMediaFlags(): void {
    this.reduceMotion.set(prefersReducedMotion());
    this.disableVideo.set(shouldDisableAmbientVideo());
    queueMicrotask(() => this.syncVideoPlayback(true));
  }

  private syncVideoPlayback(forceReload = false): void {
    const video = this.videoRef?.nativeElement;
    if (!video || this.disableVideo() || !this.safeVideoUrl) return;

    if (document.hidden) {
      video.pause();
      if (this.playbackRegistered) {
        this.playbackRegistry.unregister(this.instanceId);
        this.playbackRegistered = false;
      }
      return;
    }

    if (!this.playbackRegistry.canRegister() && !this.playbackRegistered) {
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

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;

    if (forceReload || video.getAttribute('src') !== this.safeVideoUrl) {
      video.setAttribute('src', this.safeVideoUrl);
      video.load();
    }

    const tryPlay = (): void => {
      void video.play().catch(() => {
        window.clearTimeout(this.playRetryTimer);
        this.playRetryTimer = window.setTimeout(() => {
          void video.play().catch(() => undefined);
        }, 400);
      });
    };

    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.addEventListener('loadeddata', tryPlay, { once: true });
      tryPlay();
    }
  }
}
