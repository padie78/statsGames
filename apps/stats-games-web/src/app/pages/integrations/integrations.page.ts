import { Component, OnInit, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import {
  IonContent,
  IonInput,
  IonItem,
  IonList,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import { MatchNotificationsStore } from '../../stores/match-notifications.store';
import { extractGraphqlErrorMessage, mapLinkPlatformError } from '../../utils/graphql-error.util';
import { NeonBadgeComponent, SelectComponent, type SelectOption } from '../../ui';

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
    SelectComponent,
    NeonBadgeComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-6">
        <header class="sg-page-header">
          <h1 class="sg-page-header__title">Integraciones</h1>
          <p class="sg-page-header__subtitle">
            Vinculá tu Roblox UserId o Epic account para que las partidas lleguen a tu perfil.
          </p>
        </header>

        @if (loading()) {
          <p class="u-hint u-m-0">Cargando perfil…</p>
        }

        @if (loadError()) {
          <p class="u-error">{{ loadError() }}</p>
        }

        <section class="u-surface-card u-p-5">
          <h2 class="sg-page-header__title u-text-md u-mb-2">Estado de conexión</h2>
          <div class="u-flex u-gap-2 u-flex-wrap">
            <sg-neon-badge [tone]="profile()?.fortniteId ? 'cyan' : 'muted'">
              Fortnite {{ profile()?.fortniteId ? '✓ ' + profile()!.fortniteId : 'sin vincular' }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="profile()?.robloxId ? 'cyan' : 'muted'">
              Roblox {{ profile()?.robloxId ? '✓ ' + profile()!.robloxId : 'sin vincular' }}
            </sg-neon-badge>
          </div>
        </section>

        <section class="u-surface-card u-p-5 sg-integrations-link">
          <header class="sg-integrations-link__header">
            <h2 class="sg-page-header__title u-text-md u-m-0">Vincular cuenta</h2>
            <p class="u-hint u-m-0">
              Podés vincular o actualizar en cualquier momento. El ID tiene que coincidir con el
              <code>platformUserId</code> del webhook.
            </p>
          </header>

          <form
            [formGroup]="linkForm"
            (ngSubmit)="submitLinkPlatform()"
            class="u-flex u-flex-col u-gap-4"
          >
            <sg-select
              label="Plataforma"
              formControlName="platform"
              [options]="allPlatformOptions"
            />

            <ion-list lines="none" class="u-m-0">
              <ion-item>
                <ion-input
                  [label]="externalIdLabel()"
                  labelPlacement="stacked"
                  [placeholder]="externalIdPlaceholder()"
                  formControlName="externalId"
                  inputmode="text"
                  autocomplete="off"
                />
              </ion-item>
            </ion-list>

            @if (linkForm.controls.platform.value === 'roblox') {
              <div class="sg-integrations-help">
                <p class="sg-integrations-help__title u-m-0">Cómo obtener tu Roblox UserId</p>
                <ol class="sg-integrations-help__steps u-m-0">
                  <li>
                    Abrí tu perfil en Roblox. La URL es
                    <code>roblox.com/users/<strong>123456789</strong>/profile</code>
                  </li>
                  <li>Copiá solo el número (ej. <code>123456789</code>), no el username.</li>
                  <li>Pegalo acá y tocá Vincular.</li>
                </ol>
              </div>
            } @else {
              <div class="sg-integrations-help">
                <p class="sg-integrations-help__title u-m-0">Fortnite / Epic</p>
                <p class="u-hint u-m-0">
                  Usá tu Epic account id (32 hex) o tu display name. Tiene que ser el mismo que
                  usa el poller o el companion.
                </p>
              </div>
            }

            @if (linkError()) {
              <p class="u-error">{{ linkError() }}</p>
            }
            @if (linkSuccess()) {
              <p class="u-success">{{ linkSuccess() }}</p>
            }

            <button
              type="submit"
              class="u-btn u-btn--primary u-btn--block"
              [disabled]="linkForm.invalid || linking() || !auth.userId()"
            >
              {{ linking() ? 'Vinculando…' : submitLabel() }}
            </button>
          </form>
        </section>

        <section class="u-surface-card u-p-5 u-flex u-flex-col u-gap-3">
          <h2 class="sg-page-header__title u-text-md u-mb-0">Cómo llega la data</h2>
          <p class="u-hint u-m-0">
            Al terminar una partida:
            <code>POST /webhooks/&#123;platform&#125;</code> → <code>game_ingestion</code> → SQS →
            <code>game_processor</code> → DynamoDB + AppSync.
          </p>
          <ul class="sg-integrations__list u-m-0">
            <li>
              <strong>Roblox:</strong> script en tu experience
              (<code>integrations/producers/roblox/MatchEndReporter.luau</code>).
            </li>
            <li>
              <strong>Fortnite:</strong> poller de stats o companion
              (<code>integrations/producers/fortnite/send-match.mjs</code>).
            </li>
          </ul>
        </section>

        <section class="u-surface-card u-p-5">
          <h2 class="sg-page-header__title u-text-md u-mb-2">Webhook URL</h2>
          <p class="u-hint u-mb-2">
            Header <code>X-Webhook-Secret</code>. Body con
            <code>platformUserId</code>, <code>matchId</code> y <code>stats</code>.
          </p>
          <code class="sg-code-block">{{ webhookFortniteUrl }}</code>
          <code class="sg-code-block u-mt-2">{{ webhookRobloxUrl }}</code>
          <div class="u-flex u-gap-2 u-flex-wrap u-mt-4">
            <button type="button" class="u-btn u-btn--ghost" (click)="demoNotification()">
              Simular partida en vivo
            </button>
          </div>
          <p class="u-hint u-mt-2 u-m-0">
            Prueba la campana del topbar: llega con “IA pendiente” y ~4s después pasa a “IA lista”.
          </p>
        </section>
      </div>
    </ion-content>
  `,
})
export class IntegrationsPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly playerService = inject(PlayerService);
  private readonly notifications = inject(MatchNotificationsStore);
  private readonly fb = inject(FormBuilder);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly linking = signal(false);
  readonly linkError = signal<string | null>(null);
  readonly linkSuccess = signal<string | null>(null);

  readonly webhookBase = environment.webhookUrlPattern ?? '';
  readonly webhookFortniteUrl = this.webhookBase.replace('{platform}', 'fortnite');
  readonly webhookRobloxUrl = this.webhookBase.replace('{platform}', 'roblox');

  readonly allPlatformOptions: SelectOption<'fortnite' | 'roblox'>[] = [
    { value: 'roblox', label: 'Roblox' },
    { value: 'fortnite', label: 'Fortnite' },
  ];

  readonly externalIdLabel = computed(() =>
    this.linkForm.controls.platform.value === 'fortnite'
      ? 'Epic account id / display name'
      : 'Roblox UserId (número)',
  );

  readonly externalIdPlaceholder = computed(() =>
    this.linkForm.controls.platform.value === 'fortnite'
      ? 'ej. TuDisplayName o id Epic'
      : 'ej. 123456789',
  );

  readonly submitLabel = computed(() => {
    const platform = this.linkForm.controls.platform.value;
    const p = this.profile();
    const already =
      platform === 'roblox' ? !!p?.robloxId : !!p?.fortniteId;
    return already ? 'Actualizar vínculo' : 'Vincular cuenta';
  });

  readonly linkForm = this.fb.nonNullable.group({
    platform: ['roblox' as 'fortnite' | 'roblox', Validators.required],
    externalId: ['', [Validators.required, Validators.minLength(1)]],
  });

  constructor() {
    this.linkForm.controls.platform.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((platform) => {
        this.prefillExternalId(platform);
        this.linkSuccess.set(null);
        this.linkError.set(null);
      });
  }

  ngOnInit(): void {
    void this.loadProfile();
  }

  async submitLinkPlatform(): Promise<void> {
    if (this.linkForm.invalid) return;
    const userId = this.auth.userId();
    if (!userId) {
      this.linkError.set('Tenés que iniciar sesión para vincular una cuenta.');
      return;
    }

    this.linking.set(true);
    this.linkError.set(null);
    this.linkSuccess.set(null);

    try {
      const { platform, externalId } = this.linkForm.getRawValue();
      const trimmedId = externalId.trim();

      await this.ensurePlayerProfile(userId, platform);

      const updated = await firstValueFrom(
        this.playerService.linkPlatformAccount({
          userId,
          platform,
          externalId: trimmedId,
        }),
      );
      this.profile.set(updated);
      this.loadError.set(null);
      this.linkSuccess.set(
        platform === 'roblox'
          ? `Roblox vinculado: ${updated.robloxId}`
          : `Fortnite vinculado: ${updated.fortniteId}`,
      );
      this.prefillExternalId(platform);
    } catch (err) {
      this.linkError.set(mapLinkPlatformError(err));
    } finally {
      this.linking.set(false);
    }
  }

  /** Si no hay perfil en Dynamo, lo crea antes de vincular (evita PlayerNotFound). */
  private async ensurePlayerProfile(
    userId: string,
    platform: 'fortnite' | 'roblox',
  ): Promise<void> {
    if (this.profile()) return;

    const existing = await this.playerService.getPlayerProfileOrNull(userId);
    if (existing) {
      this.profile.set(existing);
      return;
    }

    const emailPrefix = (this.auth.email() ?? 'player').split('@')[0] ?? 'player';
    const gamerTag = emailPrefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'Player';

    const created = await firstValueFrom(
      this.playerService.upsertPlayerProfile({
        userId,
        gamerTag,
        primaryPlatform: platform,
      }),
    );
    this.profile.set(created);
  }

  demoNotification(): void {
    const platform = this.linkForm.controls.platform.value;
    this.notifications.pushDemoMatch({
      userId: this.auth.userId() ?? 'demo',
      platform,
      summary:
        platform === 'roblox'
          ? 'Roblox · partida terminada'
          : 'Fortnite · partida terminada',
    });
  }

  private async loadProfile(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) {
      this.loading.set(false);
      this.loadError.set('Iniciá sesión para gestionar integraciones.');
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);
    try {
      const profile = await this.playerService.getPlayerProfileOrNull(userId);
      this.profile.set(profile);
      if (!profile) {
        this.loadError.set(
          'No encontramos tu perfil. Completá el onboarding y volvé a esta página.',
        );
      } else {
        const preferred = profile.robloxId ? 'fortnite' : 'roblox';
        const platform =
          !profile.robloxId ? 'roblox' : !profile.fortniteId ? 'fortnite' : preferred;
        this.linkForm.patchValue({ platform }, { emitEvent: false });
        this.prefillExternalId(platform);
      }
    } catch (err) {
      this.loadError.set(extractGraphqlErrorMessage(err, 'Error cargando el perfil'));
    } finally {
      this.loading.set(false);
    }
  }

  private prefillExternalId(platform: 'fortnite' | 'roblox'): void {
    const p = this.profile();
    const current = platform === 'roblox' ? p?.robloxId : p?.fortniteId;
    this.linkForm.patchValue({ externalId: current ?? '' }, { emitEvent: false });
  }
}
