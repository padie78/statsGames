import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonItem,
  IonList,
  IonToggle,
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { AuthService, type SelectedGame } from '../../core/services/auth.service';
import { GameContextService } from '../../core/game/game-context.service';
import {
  UserPreferencesService,
  type StatsDisplayMode,
} from '../../core/preferences/user-preferences.service';
import { AppSyncRealtimeService } from '../../services/appsync-realtime.service';
import { PlayerService, type PlayerProfileView } from '../../services/player.service';
import {
  GameSelectionCardComponent,
  NeonBadgeComponent,
  ShareLinkButtonComponent,
} from '../../ui';
import { buildPlayerShareUrl, copyToClipboard } from '../../utils/match-stats.util';

const GAMER_TAG_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

@Component({
  standalone: true,
  selector: 'app-settings-page',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonToggle,
    NeonBadgeComponent,
    GameSelectionCardComponent,
    ShareLinkButtonComponent,
  ],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid u-flex u-flex-col u-gap-6 u-py-4">
        <header class="sg-page-header">
          <h1 class="sg-page-header__title">Configuración</h1>
          <p class="sg-page-header__subtitle">
            Tu perfil, privacidad y cómo querés usar la app.
          </p>
        </header>

        @if (loadError()) {
          <p class="u-error">{{ loadError() }}</p>
        }

        <form class="u-flex u-flex-col u-gap-5" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
          <section class="u-surface-card u-p-5">
            <div class="sg-settings-section__head">
              <sg-neon-badge tone="lime">Mi perfil</sg-neon-badge>
              <h2 class="sg-settings-section__title">Identidad pública</h2>
              <p class="sg-settings-section__hint u-m-0">
                Tu gamer tag es tu nombre en búsquedas y en
                <span class="u-font-mono">/player/{{ profileForm.controls.gamerTag.value || 'tag' }}</span>
              </p>
            </div>

            <ion-list lines="none" class="sg-settings-form-list u-mt-4">
              <ion-item>
                <ion-input
                  label="Gamer tag"
                  labelPlacement="stacked"
                  formControlName="gamerTag"
                  autocomplete="off"
                  maxlength="32"
                />
              </ion-item>
            </ion-list>

            @if (profileForm.controls.gamerTag.touched && profileForm.controls.gamerTag.invalid) {
              <p class="u-error u-m-0 u-mt-2">
                Usá 3–32 caracteres: letras, números, guión o guión bajo.
              </p>
            }

            <p class="sg-settings-section__label u-mt-4 u-mb-2">Plataforma principal</p>
            <div class="sg-game-picker">
              <sg-game-selection-card
                game="fortnite"
                [selected]="profileForm.controls.primaryPlatform.value === 'fortnite'"
                (select)="pickPlatform($event)"
              />
              <sg-game-selection-card
                game="roblox"
                [selected]="profileForm.controls.primaryPlatform.value === 'roblox'"
                (select)="pickPlatform($event)"
              />
            </div>

            @if (profile()?.gamerTag) {
              <div class="sg-settings-share u-mt-4">
                <p class="sg-settings-section__hint u-m-0 u-mb-2">Link de tu perfil</p>
                <code class="sg-code-block">{{ publicProfileUrl() }}</code>
                <div class="u-flex u-gap-2 u-flex-wrap u-mt-3">
                  <sg-share-link-button [gamerTag]="profile()!.gamerTag" />
                  <button type="button" class="u-btn u-btn--ghost" (click)="copyPublicUrl()">
                    {{ urlCopied() ? '¡Copiado!' : 'Copiar URL' }}
                  </button>
                </div>
              </div>
            }

            @if (profileError()) {
              <p class="u-error u-mt-3 u-m-0">{{ profileError() }}</p>
            }
            @if (profileSuccess()) {
              <p class="sg-settings-success u-mt-3 u-m-0">{{ profileSuccess() }}</p>
            }

            <button
              type="submit"
              class="u-btn u-btn--primary u-btn--block u-mt-4"
              [disabled]="profileForm.invalid || savingProfile()"
            >
              {{ savingProfile() ? 'Guardando…' : 'Guardar perfil' }}
            </button>
          </section>
        </form>

        <section class="u-surface-card u-p-5">
          <div class="sg-settings-section__head">
            <sg-neon-badge tone="cyan">Privacidad</sg-neon-badge>
            <h2 class="sg-settings-section__title">Quién te ve</h2>
            <p class="sg-settings-section__hint u-m-0">
              Preferencias guardadas en tu dispositivo. El backend las aplicará pronto.
            </p>
          </div>

          <ion-list lines="none" class="sg-settings-toggle-list u-mt-4">
            <ion-item>
              <ion-toggle
                [checked]="prefs.publicProfileEnabled()"
                (ionChange)="setPublicProfile($event.detail.checked)"
              >
                Perfil público visible
              </ion-toggle>
            </ion-item>
            <ion-item>
              <ion-toggle
                [checked]="prefs.appearInSearch()"
                (ionChange)="setAppearInSearch($event.detail.checked)"
              >
                Aparecer en búsqueda de jugadores
              </ion-toggle>
            </ion-item>
          </ion-list>
        </section>

        <section class="u-surface-card u-p-5">
          <div class="sg-settings-section__head">
            <sg-neon-badge tone="lime">Preferencias</sg-neon-badge>
            <h2 class="sg-settings-section__title">Experiencia</h2>
          </div>

          <div class="sg-settings-mode u-mt-4">
            <button
              type="button"
              class="sg-settings-mode__btn"
              [class.sg-settings-mode__btn--active]="prefs.statsMode() === 'simple'"
              (click)="setStatsMode('simple')"
            >
              <span class="sg-settings-mode__title">Simple</span>
              <span class="sg-settings-mode__desc">Dashboard y partidas — sin stats avanzadas</span>
            </button>
            <button
              type="button"
              class="sg-settings-mode__btn"
              [class.sg-settings-mode__btn--active]="prefs.statsMode() === 'advanced'"
              (click)="setStatsMode('advanced')"
            >
              <span class="sg-settings-mode__title">Avanzado</span>
              <span class="sg-settings-mode__desc">Incluye gráficos y AI Coach en el menú</span>
            </button>
          </div>
        </section>

        <section class="u-surface-card u-p-5">
          <div class="sg-settings-section__head">
            <sg-neon-badge tone="muted">Cuenta</sg-neon-badge>
            <h2 class="sg-settings-section__title">Sesión</h2>
          </div>

          <dl class="sg-settings-list u-mt-4">
            <div class="sg-settings-list__row">
              <dt>Email</dt>
              <dd>{{ auth.email() ?? '—' }}</dd>
            </div>
          </dl>

          <div class="u-flex u-flex-col u-gap-2 u-mt-4">
            <a routerLink="/tabs/integrations" class="u-btn u-btn--ghost u-btn--block">
              Conectar Fortnite / Roblox
            </a>
            <button type="button" class="u-btn u-btn--ghost u-btn--block" (click)="logout()">
              Cerrar sesión
            </button>
          </div>
        </section>

        <section class="u-surface-card u-p-5 sg-settings-advanced">
          <button
            type="button"
            class="sg-settings-advanced__toggle"
            [attr.aria-expanded]="advancedOpen()"
            (click)="advancedOpen.set(!advancedOpen())"
          >
            <span>Avanzado</span>
            <span aria-hidden="true">{{ advancedOpen() ? '▾' : '▸' }}</span>
          </button>

          @if (advancedOpen()) {
            <dl class="sg-settings-list u-mt-4">
              <div class="sg-settings-list__row">
                <dt>User ID</dt>
                <dd class="u-font-mono u-text-xs u-break-all">{{ auth.userId() ?? '—' }}</dd>
              </div>
            </dl>
            <button type="button" class="u-btn u-btn--ghost u-mt-3" (click)="copyUserId()">
              {{ userIdCopied() ? '¡Copiado!' : 'Copiar User ID' }}
            </button>
            <p class="u-hint u-mt-3 u-mb-0">
              Para mock data:
              <code class="sg-code-block u-mt-2">npm run seed:mock -- --user-id TU_USER_ID</code>
            </p>
          }
        </section>
      </div>
    </ion-content>
  `,
})
export class SettingsPageComponent {
  readonly auth = inject(AuthService);
  readonly prefs = inject(UserPreferencesService);
  private readonly player = inject(PlayerService);
  private readonly gameContext = inject(GameContextService);
  private readonly router = inject(Router);
  private readonly realtime = inject(AppSyncRealtimeService);
  private readonly fb = inject(FormBuilder);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly profileError = signal<string | null>(null);
  readonly profileSuccess = signal<string | null>(null);
  readonly savingProfile = signal(false);
  readonly advancedOpen = signal(false);
  readonly urlCopied = signal(false);
  readonly userIdCopied = signal(false);

  readonly profileForm = this.fb.nonNullable.group({
    gamerTag: ['', [Validators.required, Validators.pattern(GAMER_TAG_PATTERN)]],
    primaryPlatform: ['fortnite' as SelectedGame, Validators.required],
  });

  constructor() {
    void this.loadProfile();
  }

  publicProfileUrl(): string {
    const tag = this.profile()?.gamerTag ?? this.profileForm.controls.gamerTag.value;
    if (!tag) return '—';
    return buildPlayerShareUrl(tag);
  }

  pickPlatform(game: SelectedGame): void {
    this.profileForm.controls.primaryPlatform.setValue(game);
    this.profileForm.markAsDirty();
  }

  setPublicProfile(enabled: boolean): void {
    const userId = this.auth.userId();
    if (!userId) return;
    this.prefs.update(userId, { publicProfileEnabled: enabled });
  }

  setAppearInSearch(enabled: boolean): void {
    const userId = this.auth.userId();
    if (!userId) return;
    this.prefs.update(userId, { appearInSearch: enabled });
  }

  setStatsMode(mode: StatsDisplayMode): void {
    const userId = this.auth.userId();
    if (!userId) return;
    this.prefs.update(userId, { statsMode: mode });
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const userId = this.auth.userId();
    if (!userId) return;

    const current = this.profile();
    const { gamerTag, primaryPlatform } = this.profileForm.getRawValue();
    const normalizedTag = gamerTag.trim();

    this.savingProfile.set(true);
    this.profileError.set(null);
    this.profileSuccess.set(null);

    try {
      const platformChanged = this.auth.selectedGame() !== primaryPlatform;

      if (platformChanged) {
        await this.gameContext.switchPlatform(primaryPlatform);
      }

      const updated = await firstValueFrom(
        this.player.upsertPlayerProfile({
          userId,
          gamerTag: normalizedTag,
          primaryPlatform,
          fortniteId: current?.fortniteId ?? undefined,
          robloxId: current?.robloxId ?? undefined,
          avatarUrl: current?.avatarUrl ?? undefined,
        }),
      );

      this.profile.set(updated);
      this.profileForm.patchValue({
        gamerTag: updated.gamerTag,
        primaryPlatform: updated.primaryPlatform as SelectedGame,
      });
      this.profileForm.markAsPristine();
      this.profileSuccess.set('Perfil actualizado.');
    } catch (err) {
      this.profileError.set(err instanceof Error ? err.message : 'No se pudo guardar el perfil');
    } finally {
      this.savingProfile.set(false);
    }
  }

  async copyPublicUrl(): Promise<void> {
    const tag = this.profile()?.gamerTag;
    if (!tag) return;
    const ok = await copyToClipboard(buildPlayerShareUrl(tag));
    if (ok) {
      this.urlCopied.set(true);
      setTimeout(() => this.urlCopied.set(false), 2000);
    }
  }

  async copyUserId(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    const ok = await copyToClipboard(userId);
    if (ok) {
      this.userIdCopied.set(true);
      setTimeout(() => this.userIdCopied.set(false), 2000);
    }
  }

  async logout(): Promise<void> {
    this.realtime.reset();
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  private async loadProfile(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    this.loadError.set(null);
    this.prefs.load(userId);

    try {
      const profile = await this.player.getPlayerProfileOrNull(userId);
      if (!profile) {
        this.loadError.set(
          'No encontramos tu perfil de jugador. Completá el onboarding o recargá la página.',
        );
        return;
      }

      this.profile.set(profile);
      this.profileForm.patchValue({
        gamerTag: profile.gamerTag,
        primaryPlatform: (profile.primaryPlatform as SelectedGame) ?? this.auth.selectedGame() ?? 'fortnite',
      });
    } catch (err) {
      this.loadError.set(err instanceof Error ? err.message : 'Error cargando perfil');
    }
  }
}
