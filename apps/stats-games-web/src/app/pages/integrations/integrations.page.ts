import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import {
  IonContent,
  IonInput,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import { NeonBadgeComponent, ShareLinkButtonComponent } from '../../ui';

@Component({
  standalone: true,
  selector: 'app-integrations-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    NeonBadgeComponent,
    ShareLinkButtonComponent,
  ],
  template: `
    <ion-content class="ion-padding">
      <div class="page-shell u-flex u-flex-col u-gap-4">
        <header>
          <h1 class="u-font-display u-text-lg u-fw-bold u-uppercase">Integraciones</h1>
          <p class="u-hint">Vinculá tu cuenta de juego y configurá el webhook de telemetría.</p>
        </header>

        <section class="u-surface-card u-p-4">
          <h2 class="u-font-display u-text-md u-fw-bold u-mb-2">Estado de conexión</h2>
          <div class="u-flex u-gap-2 u-flex-wrap">
            <sg-neon-badge [tone]="profile()?.fortniteId ? 'lime' : 'muted'">
              Fortnite {{ profile()?.fortniteId ? '✓' : '—' }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="profile()?.robloxId ? 'lime' : 'muted'">
              Roblox {{ profile()?.robloxId ? '✓' : '—' }}
            </sg-neon-badge>
          </div>
        </section>

        <section class="u-surface-card u-p-4">
          <h2 class="u-font-display u-text-md u-fw-bold u-mb-2">Webhook URL</h2>
          <p class="u-hint u-mb-2">
            POST con header <code>X-Webhook-Secret</code> y body JSON
            (<code>platformUserId</code>, <code>matchId</code>, <code>stats</code>).
          </p>
          <code class="sg-code-block">{{ webhookFortniteUrl }}</code>
          <code class="sg-code-block u-mt-2">{{ webhookRobloxUrl }}</code>
        </section>

        @if (showLinkForm()) {
          <section class="u-surface-card u-p-4">
            <h2 class="u-font-display u-text-md u-fw-bold u-mb-2">Vincular cuenta</h2>
            <form [formGroup]="linkForm" (ngSubmit)="submitLinkPlatform()">
              <ion-list lines="none">
                <ion-item>
                  <ion-select label="Plataforma" labelPlacement="stacked" formControlName="platform">
                    @if (!profile()?.fortniteId) {
                      <ion-select-option value="fortnite">Fortnite</ion-select-option>
                    }
                    @if (!profile()?.robloxId) {
                      <ion-select-option value="roblox">Roblox</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-input label="ID externo" labelPlacement="stacked" formControlName="externalId" />
                </ion-item>
              </ion-list>
              @if (linkError()) {
                <p class="u-error">{{ linkError() }}</p>
              }
              <button
                type="submit"
                class="u-btn u-btn--lime u-btn--block u-mt-3"
                [disabled]="linkForm.invalid || linking()"
              >
                {{ linking() ? 'Vinculando...' : 'Vincular cuenta' }}
              </button>
            </form>
          </section>
        }

        @if (profile()?.gamerTag) {
          <sg-share-link-button [gamerTag]="profile()!.gamerTag" />
        }
      </div>
    </ion-content>
  `,
})
export class IntegrationsPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly playerService = inject(PlayerService);
  private readonly fb = inject(FormBuilder);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly linking = signal(false);
  readonly linkError = signal<string | null>(null);

  readonly webhookBase = environment.webhookUrlPattern ?? '';
  readonly webhookFortniteUrl = this.webhookBase.replace('{platform}', 'fortnite');
  readonly webhookRobloxUrl = this.webhookBase.replace('{platform}', 'roblox');

  readonly showLinkForm = computed(() => {
    const p = this.profile();
    if (!p) return false;
    return !p.fortniteId || !p.robloxId;
  });

  readonly linkForm = this.fb.nonNullable.group({
    platform: ['roblox' as 'fortnite' | 'roblox', Validators.required],
    externalId: ['', [Validators.required, Validators.minLength(1)]],
  });

  ngOnInit(): void {
    void this.loadProfile();
  }

  async submitLinkPlatform(): Promise<void> {
    if (this.linkForm.invalid) return;
    const userId = this.auth.userId();
    if (!userId) return;

    this.linking.set(true);
    this.linkError.set(null);

    try {
      const { platform, externalId } = this.linkForm.getRawValue();
      const updated = await firstValueFrom(
        this.playerService.linkPlatformAccount({
          userId,
          platform,
          externalId: externalId.trim(),
        }),
      );
      this.profile.set(updated);
      this.linkForm.reset({
        platform: updated.fortniteId ? 'roblox' : 'fortnite',
        externalId: '',
      });
    } catch (err) {
      this.linkError.set(err instanceof Error ? err.message : 'No se pudo vincular la cuenta');
    } finally {
      this.linking.set(false);
    }
  }

  private async loadProfile(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    const profile = await this.playerService.getPlayerProfileOrNull(userId);
    this.profile.set(profile);
    if (profile) {
      this.linkForm.patchValue({
        platform: profile.fortniteId ? 'roblox' : 'fortnite',
      });
    }
  }
}
