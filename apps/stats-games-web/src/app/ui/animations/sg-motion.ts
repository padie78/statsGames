import {
  animate,
  animateChild,
  query,
  stagger,
  style,
  transition,
  trigger,
} from '@angular/animations';

/** Bloques / secciones al montar. */
export const sgFadeSlideIn = trigger('sgFadeSlideIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(14px)' }),
    animate(
      '420ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'translateY(0)' }),
    ),
  ]),
]);

/** Lista con stagger (historial de partidas). */
export const sgListStagger = trigger('sgListStagger', [
  transition(':enter', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        stagger(55, [
          animate(
            '380ms cubic-bezier(0.22, 1, 0.36, 1)',
            style({ opacity: 1, transform: 'translateY(0)' }),
          ),
        ]),
      ],
      { optional: true },
    ),
  ]),
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(14px)' }),
        stagger(45, [
          animate(
            '360ms cubic-bezier(0.22, 1, 0.36, 1)',
            style({ opacity: 1, transform: 'translateY(0)' }),
          ),
        ]),
      ],
      { optional: true },
    ),
  ]),
]);

/** Item hijo para usar con sgListStagger + animateChild. */
export const sgListItem = trigger('sgListItem', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(12px)' }),
    animate(
      '360ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'translateY(0)' }),
    ),
  ]),
]);

/** Toast / pop de aviso. */
export const sgToastPop = trigger('sgToastPop', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(1.1rem) scale(0.94)' }),
    animate(
      '520ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
    ),
  ]),
  transition(':leave', [
    animate(
      '220ms ease-in',
      style({ opacity: 0, transform: 'translateY(0.6rem) scale(0.97)' }),
    ),
  ]),
]);

/** Badge / KPI pulse único. */
export const sgPulseOnce = trigger('sgPulseOnce', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.7)' }),
    animate(
      '420ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'scale(1)' }),
    ),
  ]),
]);

/** Modal dialog entrance. */
export const sgModalIn = trigger('sgModalIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(18px) scale(0.985)' }),
    animate(
      '480ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
    ),
  ]),
]);

/** Contenedor que anima hijos con animateChild. */
export const sgStaggerChildren = trigger('sgStaggerChildren', [
  transition(':enter', [
    query('@sgFadeSlideIn, @sgListItem', stagger(60, animateChild()), { optional: true }),
  ]),
]);
