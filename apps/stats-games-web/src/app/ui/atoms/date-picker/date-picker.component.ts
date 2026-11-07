import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { IonDatetime, IonPopover } from '@ionic/angular/standalone';
import { todayPeriodId } from '../../../core/analysis/analysis-range';

let nextDatePickerId = 0;

/**
 * Selector de día: trigger tipo campo + panel calendario (no textbox con máscara).
 */
@Component({
  standalone: true,
  selector: 'sg-date-picker',
  encapsulation: ViewEncapsulation.None,
  imports: [IonDatetime, IonPopover],
  template: `
    <div class="sg-date-picker" [class.sg-date-picker--open]="open">
      @if (label) {
        <span class="sg-date-picker__label">{{ label }}</span>
      }
      <button
        type="button"
        class="sg-date-picker__trigger"
        [id]="triggerId"
        [attr.aria-label]="ariaLabel || label || 'Seleccionar fecha'"
        [attr.aria-expanded]="open"
        aria-haspopup="dialog"
      >
        <span class="sg-date-picker__value">{{ displayValue }}</span>
        <span class="sg-date-picker__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <rect
              x="3.5"
              y="5.5"
              width="17"
              height="15"
              rx="2.5"
              stroke="currentColor"
              stroke-width="1.7"
            />
            <path
              d="M8 3.5v3.5M16 3.5v3.5M3.5 10h17"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
            />
          </svg>
        </span>
      </button>

      <ion-popover
        #popover
        class="sg-date-picker__popover"
        [trigger]="triggerId"
        [keepContentsMounted]="true"
        side="bottom"
        alignment="start"
        [showBackdrop]="true"
        (didPresent)="open = true"
        (didDismiss)="open = false"
      >
        <ng-template>
          <div class="sg-date-picker__panel">
            <div class="sg-date-picker__panel-head">
              <span class="sg-date-picker__panel-title">Elegí el día</span>
            </div>
            <ion-datetime
              presentation="date"
              locale="es-ES"
              firstDayOfWeek="1"
              [value]="value"
              [max]="max"
              [min]="min || undefined"
              [showDefaultButtons]="false"
              (ionChange)="onDatetimeChange($event)"
            />
          </div>
        </ng-template>
      </ion-popover>
    </div>
  `,
})
export class DatePickerComponent {
  private readonly id = nextDatePickerId++;
  readonly triggerId = `sg-date-picker-trigger-${this.id}`;

  @ViewChild('popover') private popoverRef?: IonPopover;

  @Input() label = 'Fecha';
  @Input() ariaLabel = '';
  @Input() value = todayPeriodId();
  @Input() max = todayPeriodId();
  @Input() min = '';

  @Output() readonly valueChange = new EventEmitter<string>();

  open = false;

  get displayValue(): string {
    return formatDayLabel(this.value);
  }

  onDatetimeChange(event: CustomEvent<{ value?: string | string[] | null }>): void {
    const next = normalizeDayIso(event.detail?.value);
    if (!next) return;
    if (next !== this.value) {
      this.valueChange.emit(next);
    }
    void this.dismiss();
  }

  dismiss(): void {
    void this.popoverRef?.dismiss();
  }
}

function normalizeDayIso(raw: string | string[] | null | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';
  return value.slice(0, 10);
}

function formatDayLabel(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || 'Elegir fecha';
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
