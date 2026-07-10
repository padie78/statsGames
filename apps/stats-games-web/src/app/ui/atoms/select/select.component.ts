import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  ViewEncapsulation,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

@Component({
  standalone: true,
  selector: 'sg-select',
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
  template: `
    <div
      class="sg-select"
      [class.sg-select--open]="open()"
      [class.sg-select--disabled]="disabled()"
    >
      @if (label) {
        <label [for]="selectId" class="sg-select__label">{{ label }}</label>
      }

      <div class="sg-select__control-wrap">
        <button
          #trigger
          type="button"
          class="sg-select__trigger"
          [id]="selectId"
          [attr.aria-expanded]="open()"
          aria-haspopup="listbox"
          [disabled]="disabled()"
          (click)="toggle($event)"
          (keydown)="onTriggerKeydown($event)"
        >
          <span class="sg-select__value" [class.sg-select__value--placeholder]="!selectedLabel">
            {{ selectedLabel ?? placeholder }}
          </span>
          <span class="sg-select__chevron" aria-hidden="true"></span>
        </button>

        @if (open()) {
          <ul
            #menu
            class="sg-select__menu sg-select__menu--floating"
            role="listbox"
            [attr.aria-labelledby]="selectId"
            (keydown)="onMenuKeydown($event)"
          >
            @for (option of options; track option.value) {
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  class="sg-select__option"
                  [class.sg-select__option--selected]="value === option.value"
                  [disabled]="option.disabled"
                  [attr.aria-selected]="value === option.value"
                  (click)="pick(option, $event)"
                >
                  {{ option.label }}
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class SelectComponent implements ControlValueAccessor {
  private static nextId = 0;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('trigger') private triggerRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('menu') private menuRef?: ElementRef<HTMLUListElement>;

  readonly selectId = `sg-select-${SelectComponent.nextId++}`;

  @Input() label = '';
  @Input() placeholder = 'Seleccionar…';
  @Input() options: SelectOption[] = [];

  readonly open = signal(false);
  readonly disabled = signal(false);

  @Input()
  set value(val: string | null) {
    this._value = val;
  }
  get value(): string | null {
    return this._value;
  }

  @Output() readonly valueChange = new EventEmitter<string>();

  private _value: string | null = null;

  private readonly onViewportChange = (): void => {
    if (this.open()) this.positionFloatingMenu();
  };

  constructor() {
    const view = this.document.defaultView;
    if (view) {
      view.addEventListener('scroll', this.onViewportChange, true);
      view.addEventListener('resize', this.onViewportChange);
    }

    this.destroyRef.onDestroy(() => {
      if (view) {
        view.removeEventListener('scroll', this.onViewportChange, true);
        view.removeEventListener('resize', this.onViewportChange);
      }
    });
  }

  get selectedLabel(): string | null {
    if (this.value == null) return null;
    return this.options.find((option) => option.value === this.value)?.label ?? null;
  }

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (!target) return;

    const inHost = this.host.nativeElement.contains(target);
    const inMenu = this.menuRef?.nativeElement.contains(target) ?? false;
    if (inHost || inMenu) return;

    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  writeValue(value: string | null): void {
    this._value = value;
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled()) return;

    if (this.open()) {
      this.close();
      return;
    }

    this.openMenu();
  }

  pick(option: SelectOption, event: MouseEvent): void {
    event.stopPropagation();
    if (option.disabled) return;
    this._value = option.value;
    this.onChange(option.value);
    this.valueChange.emit(option.value);
    this.onTouched();
    this.close();
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.open()) this.openMenu();
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      default:
        break;
    }
  }

  onMenuKeydown(event: KeyboardEvent): void {
    const enabled = this.options.filter((option) => !option.disabled);
    if (!enabled.length) return;

    const currentIndex = enabled.findIndex((option) => option.value === this.value);
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        nextIndex = currentIndex < enabled.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'ArrowUp':
        event.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : enabled.length - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (currentIndex >= 0) this.applyValue(enabled[currentIndex].value);
        this.close();
        return;
      case 'Escape':
        event.preventDefault();
        this.close();
        return;
      case 'Tab':
        this.close();
        return;
      default:
        return;
    }

    this.applyValue(enabled[nextIndex].value);
  }

  private openMenu(): void {
    this.open.set(true);
    requestAnimationFrame(() => {
      this.positionFloatingMenu();
      requestAnimationFrame(() => this.positionFloatingMenu());
    });
  }

  private positionFloatingMenu(): void {
    const trigger = this.triggerRef?.nativeElement;
    const menu = this.menuRef?.nativeElement;
    if (!trigger || !menu) return;

    if (menu.parentElement !== this.document.body) {
      this.document.body.appendChild(menu);
    }

    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const viewportHeight = this.document.defaultView?.innerHeight ?? 0;
    const menuHeight = menu.offsetHeight || menu.scrollHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const openUpward = menuHeight + gap > spaceBelow && rect.top > menuHeight + gap;

    const top = openUpward ? rect.top - gap - menuHeight : rect.bottom + gap;

    menu.style.position = 'fixed';
    menu.style.top = `${Math.max(gap, top)}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${rect.width}px`;
    menu.style.right = 'auto';
    menu.style.zIndex = '1200';
  }

  private applyValue(value: string): void {
    this._value = value;
    this.onChange(value);
    this.valueChange.emit(value);
  }
}
