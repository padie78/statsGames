import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';

interface ParsedValue {
  target: number;
  prefix: string;
  suffix: string;
  decimals: number;
}

function parseAnimatable(value: string | number): ParsedValue | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return {
      target: value,
      prefix: '',
      suffix: '',
      decimals: Number.isInteger(value) ? 0 : 1,
    };
  }

  const raw = String(value).trim();
  if (!raw || raw === '—' || raw === '-') return null;

  const match = raw.match(/^([^0-9.-]*)(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;

  const target = Number(match[2]);
  if (!Number.isFinite(target)) return null;

  const decimalPart = match[2].includes('.') ? match[2].split('.')[1]?.length ?? 1 : 0;

  return {
    target,
    prefix: match[1] ?? '',
    suffix: match[3] ?? '',
    decimals: decimalPart,
  };
}

function formatAnimatedValue(current: number, parsed: ParsedValue): string {
  const rounded =
    parsed.decimals > 0 ? current.toFixed(parsed.decimals) : String(Math.round(current));
  return `${parsed.prefix}${rounded}${parsed.suffix}`;
}

@Component({
  standalone: true,
  selector: 'sg-animated-value',
  encapsulation: ViewEncapsulation.None,
  template: `{{ display }}`,
})
export class AnimatedValueComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) value!: string | number;
  @Input() durationMs = 720;

  display = '';

  private frameId = 0;
  private readonly reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.animateTo(this.value);
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
  }

  private animateTo(value: string | number): void {
    cancelAnimationFrame(this.frameId);

    const parsed = parseAnimatable(value);
    if (!parsed || this.reducedMotion) {
      this.display = String(value);
      return;
    }

    const start = performance.now();
    const from = 0;
    const to = parsed.target;

    const tick = (now: number): void => {
      const progress = Math.min((now - start) / this.durationMs, 1);
      const eased = 1 - (1 - progress) ** 3;
      const current = from + (to - from) * eased;
      this.display = formatAnimatedValue(current, parsed);

      if (progress < 1) {
        this.frameId = requestAnimationFrame(tick);
      } else {
        this.display = String(value);
      }
    };

    this.display = formatAnimatedValue(0, parsed);
    this.frameId = requestAnimationFrame(tick);
  }
}
