import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { NeonBadgeComponent } from '../../ui';

@Component({
  standalone: true,
  selector: 'app-placeholder-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, NeonBadgeComponent],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-py-4">
        <section class="u-surface-card u-p-5 u-text-center">
          <sg-neon-badge tone="purple">Próximamente</sg-neon-badge>
          <h2 class="sg-page-header__title u-mt-4 u-mb-2">{{ title }}</h2>
          <p class="u-text-secondary u-text-sm">{{ description }}</p>
        </section>
      </div>
    </ion-content>
  `,
})
export class PlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  get title(): string {
    return (this.route.snapshot.data['placeholderTitle'] as string) ?? 'Módulo en construcción';
  }

  get description(): string {
    return (
      (this.route.snapshot.data['placeholderDescription'] as string) ??
      'Esta sección estará disponible en una próxima iteración.'
    );
  }
}
