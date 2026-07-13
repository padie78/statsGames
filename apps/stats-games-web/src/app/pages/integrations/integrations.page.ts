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
import { robloxAvatarUrl } from '../../utils/roblox-avatar.util';
import { NeonBadgeComponent, SelectComponent, type SelectOption } from '../../ui';

type LinkablePlatform =
  | 'valorant'
  | 'rocket_league'
  | 'fortnite'
  | 'roblox'
  | 'league_of_legends'
  | 'cs2';

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
            Fase 1: Valorant + Rocket League. Fase 2: Fortnite + BedWars/Arsenal (Roblox).
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
            <sg-neon-badge [tone]="profile()?.valorantId ? 'lime' : 'muted'">
              Valorant {{ profile()?.valorantId ? '✓ ' + profile()!.valorantId : 'sin vincular' }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="profile()?.rocketLeagueId ? 'lime' : 'muted'">
              Rocket League
              {{ profile()?.rocketLeagueId ? '✓ ' + profile()!.rocketLeagueId : 'sin vincular' }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="profile()?.fortniteId ? 'cyan' : 'muted'">
              Fortnite {{ profile()?.fortniteId ? '✓ ' + profile()!.fortniteId : 'sin vincular' }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="profile()?.robloxId ? 'cyan' : 'muted'">
              Roblox experiences
              {{ profile()?.robloxId ? '✓ ' + profile()!.robloxId : 'sin vincular' }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="profile()?.leagueOfLegendsId ? 'lime' : 'muted'">
              League of Legends
              {{
                profile()?.leagueOfLegendsId
                  ? '✓ ' + profile()!.leagueOfLegendsId
                  : 'sin vincular'
              }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="profile()?.cs2Id ? 'lime' : 'muted'">
              CS2 {{ profile()?.cs2Id ? '✓ ' + profile()!.cs2Id : 'sin vincular' }}
            </sg-neon-badge>
          </div>
          @if (profile()?.robloxId && robloxAvatar()) {
            <div class="u-flex u-items-center u-gap-3 u-mt-4">
              <img
                class="sg-integrations-avatar"
                [src]="robloxAvatar()!"
                alt="Avatar Roblox"
                width="64"
                height="64"
              />
              <p class="u-hint u-m-0">Avatar vía Thumbnails API (UserId vinculado).</p>
            </div>
          }
        </section>

        <section class="u-surface-card u-p-5 u-flex u-flex-col u-gap-3">
          <h2 class="sg-page-header__title u-text-md u-mb-0">Roadmap de datos</h2>
          <ul class="sg-integrations__list u-m-0">
            <li>
              <strong>Valorant:</strong> Riot API Key + Riot ID (<code>Nombre#TAG</code>) → partidas al
              cerrar (poll ≤3 min) → KDA, HS%, rondas, mapa, agente + análisis Bedrock. Requiere
              secret GitHub <code>RIOT_API_KEY</code> (sin key el poller queda DISABLED).
            </li>
            <li>
              <strong>Rocket League:</strong> webhook/companion + opcional ballchasing
              (<code>BALLCHASING_API_KEY</code>) → goles, assists, saves, playlist.
            </li>
            <li>
              <strong>Fortnite:</strong> poller fortnite-api.com (diff de carrera).
            </li>
            <li>
              <strong>Roblox:</strong> Blox Fruits, Adopt Me!, Brookhaven RP (+ BedWars/Arsenal
              badges). Un UserId vincula todas.
            </li>
            <li>
              <strong>League of Legends:</strong> Riot ID (<code>Nombre#TAG</code>) → partidas
              ranked / normales vía Riot API.
            </li>
            <li>
              <strong>CS2:</strong> SteamID64 (<code>7656119…</code>) → stats vía Steam Web API.
            </li>
          </ul>
        </section>

        <section class="u-surface-card u-p-5 sg-integrations-link">
          <header class="sg-integrations-link__header">
            <h2 class="sg-page-header__title u-text-md u-m-0">Vincular cuenta</h2>
            <p class="u-hint u-m-0">
              El ID debe coincidir con el que usan poller / webhook
              (<code>platformUserId</code>).
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

            <div class="sg-integrations-help">
              <p class="sg-integrations-help__title u-m-0">{{ helpTitle() }}</p>
              <p class="u-hint u-m-0">{{ helpBody() }}</p>
            </div>

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

        <section class="u-surface-card u-p-5">
          <h2 class="sg-page-header__title u-text-md u-mb-2">Smoke test</h2>
          <p class="u-hint u-mb-2">
            <code>npm run send:match -- --platform valorant --kills 18 --deaths 14 --assists 6</code>
          </p>
          <code class="sg-code-block">{{ webhookUrl }}</code>
          <div class="u-flex u-gap-2 u-flex-wrap u-mt-4">
            <button type="button" class="u-btn u-btn--ghost" (click)="demoNotification()">
              Simular partida en vivo
            </button>
          </div>
        </section>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .sg-integrations-avatar {
        border-radius: 12px;
        border: 1px solid rgba(163, 230, 53, 0.35);
        background: #0b1220;
      }
    `,
  ],
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
  readonly webhookUrl = this.webhookBase || '…/webhooks/{platform}';

  readonly allPlatformOptions: SelectOption<LinkablePlatform>[] = [
    { value: 'valorant', label: 'Valorant (Fase 1)' },
    { value: 'rocket_league', label: 'Rocket League (Fase 1)' },
    { value: 'fortnite', label: 'Fortnite (Fase 2)' },
    { value: 'roblox', label: 'Roblox (Blox Fruits / Adopt Me / Brookhaven)' },
    { value: 'league_of_legends', label: 'League of Legends' },
    { value: 'cs2', label: 'Counter-Strike 2' },
  ];

  readonly robloxAvatar = computed(() => {
    const id = this.profile()?.robloxId;
    return id ? robloxAvatarUrl(id) : null;
  });

  readonly externalIdLabel = computed(() => {
    switch (this.linkForm.controls.platform.value) {
      case 'valorant':
      case 'league_of_legends':
        return 'Riot ID (Nombre#TAG)';
      case 'rocket_league':
        return 'Epic / player name';
      case 'fortnite':
        return 'Epic account id / display name';
      case 'cs2':
        return 'SteamID64';
      default:
        return 'Roblox UserId (número)';
    }
  });

  readonly externalIdPlaceholder = computed(() => {
    switch (this.linkForm.controls.platform.value) {
      case 'valorant':
      case 'league_of_legends':
        return 'ej. Player#NA1';
      case 'rocket_league':
        return 'ej. TuEpicName';
      case 'fortnite':
        return 'ej. TuDisplayName';
      case 'cs2':
        return 'ej. 76561198000000000';
      default:
        return 'ej. 123456789';
    }
  });

  readonly helpTitle = computed(() => {
    switch (this.linkForm.controls.platform.value) {
      case 'valorant':
        return 'Valorant / Riot';
      case 'rocket_league':
        return 'Rocket League';
      case 'fortnite':
        return 'Fortnite';
      case 'league_of_legends':
        return 'League of Legends / Riot';
      case 'cs2':
        return 'Counter-Strike 2 / Steam';
      default:
        return 'BedWars & Arsenal';
    }
  });

  readonly helpBody = computed(() => {
    switch (this.linkForm.controls.platform.value) {
      case 'valorant':
        return 'Formato obligatorio: Nombre#TAG (ej. Player#NA1). Tras vincular, el poller (EventBridge ~3 min) captura partidas al cerrar si RIOT_API_KEY está en infra. Región/shard: VALORANT_REGION / VALORANT_SHARD.';
      case 'rocket_league':
        return 'Nombre visible en replays/ballchasing o companion. API oficial Psyonix no está abierta: webhook o ballchasing.';
      case 'fortnite':
        return 'Stats públicas en Epic. Preferí account id 32-hex. Poller cada ~3 min.';
      case 'league_of_legends':
        return 'Formato obligatorio: Nombre#TAG (mismo Riot ID que Valorant). Tras vincular, el poller captura partidas ranked/normales.';
      case 'cs2':
        return 'SteamID64 de 17 dígitos que empieza con 7656119. Perfil Steam → Account details, o steamid.io.';
      default:
        return 'UserId numérico. Trackea Blox Fruits, Adopt Me!, Brookhaven RP, BedWars y Arsenal vía badges.';
    }
  });

  readonly submitLabel = computed(() => {
    const platform = this.linkForm.controls.platform.value;
    return this.linkedId(platform) ? 'Actualizar vínculo' : 'Vincular cuenta';
  });

  readonly linkForm = this.fb.nonNullable.group({
    platform: ['valorant' as LinkablePlatform, Validators.required],
    externalId: ['', [Validators.required, Validators.minLength(1)]],
  });

  constructor() {
    this.linkForm.controls.platform.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((platform) => {
        this.applyExternalIdValidators(platform);
        this.prefillExternalId(platform);
        this.linkSuccess.set(null);
        this.linkError.set(null);
      });
    this.applyExternalIdValidators(this.linkForm.controls.platform.value);
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

      if (
        (platform === 'valorant' || platform === 'league_of_legends') &&
        !isValidRiotId(trimmedId)
      ) {
        this.linkError.set(
          'Riot ID inválido. Usá el formato exacto Nombre#TAG (ej. Player#NA1).',
        );
        return;
      }

      if (platform === 'cs2' && !/^7656119\d{10}$/.test(trimmedId)) {
        this.linkError.set(
          'SteamID64 inválido. Debe ser 17 dígitos y empezar con 7656119.',
        );
        return;
      }

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
        platform === 'valorant'
          ? `Valorant vinculado: ${trimmedId}. Si RIOT_API_KEY está activa, en ≤3 min deberían aparecer partidas en /tabs/matches.`
          : platform === 'league_of_legends'
            ? `League of Legends vinculado: ${trimmedId}. El poller capturará partidas ranked/normales.`
            : platform === 'cs2'
              ? `CS2 vinculado: ${trimmedId}. Stats vía Steam Web API.`
              : `${this.platformLabel(platform)} vinculado: ${trimmedId}`,
      );
      this.prefillExternalId(platform);
    } catch (err) {
      this.linkError.set(mapLinkPlatformError(err));
    } finally {
      this.linking.set(false);
    }
  }

  private applyExternalIdValidators(platform: LinkablePlatform): void {
    const control = this.linkForm.controls.externalId;
    if (platform === 'valorant' || platform === 'league_of_legends') {
      control.setValidators([Validators.required, riotIdValidator]);
    } else if (platform === 'cs2') {
      control.setValidators([Validators.required, Validators.pattern(/^7656119\d{10}$/)]);
    } else if (platform === 'roblox') {
      control.setValidators([Validators.required, Validators.pattern(/^\d+$/)]);
    } else {
      control.setValidators([Validators.required, Validators.minLength(1)]);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  private async ensurePlayerProfile(
    userId: string,
    platform: LinkablePlatform,
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
      summary: `${this.platformLabel(platform)} · partida detectada`,
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
        const platform = this.preferredPlatform(profile);
        this.linkForm.patchValue({ platform }, { emitEvent: false });
        this.prefillExternalId(platform);
      }
    } catch (err) {
      this.loadError.set(extractGraphqlErrorMessage(err, 'Error cargando el perfil'));
    } finally {
      this.loading.set(false);
    }
  }

  private preferredPlatform(profile: PlayerProfileView): LinkablePlatform {
    if (!profile.valorantId) return 'valorant';
    if (!profile.rocketLeagueId) return 'rocket_league';
    if (!profile.fortniteId) return 'fortnite';
    if (!profile.robloxId) return 'roblox';
    if (!profile.leagueOfLegendsId) return 'league_of_legends';
    if (!profile.cs2Id) return 'cs2';
    return 'valorant';
  }

  private linkedId(platform: LinkablePlatform): string | null | undefined {
    const p = this.profile();
    switch (platform) {
      case 'valorant':
        return p?.valorantId;
      case 'rocket_league':
        return p?.rocketLeagueId;
      case 'fortnite':
        return p?.fortniteId;
      case 'roblox':
        return p?.robloxId;
      case 'league_of_legends':
        return p?.leagueOfLegendsId;
      case 'cs2':
        return p?.cs2Id;
    }
  }

  private prefillExternalId(platform: LinkablePlatform): void {
    this.linkForm.patchValue(
      { externalId: this.linkedId(platform) ?? '' },
      { emitEvent: false },
    );
  }

  private platformLabel(platform: LinkablePlatform): string {
    switch (platform) {
      case 'valorant':
        return 'Valorant';
      case 'rocket_league':
        return 'Rocket League';
      case 'fortnite':
        return 'Fortnite';
      case 'roblox':
        return 'BedWars / Arsenal';
      case 'league_of_legends':
        return 'League of Legends';
      case 'cs2':
        return 'CS2';
    }
  }
}

/** Riot ID: gameName#tagLine (tag alfanumérico, 2–5 chars típico). */
function isValidRiotId(raw: string): boolean {
  const trimmed = raw.trim();
  const hash = trimmed.lastIndexOf('#');
  if (hash <= 0 || hash === trimmed.length - 1) return false;
  const gameName = trimmed.slice(0, hash).trim();
  const tagLine = trimmed.slice(hash + 1).trim();
  if (!gameName || gameName.length > 16) return false;
  if (!/^[A-Za-z0-9]{2,5}$/.test(tagLine)) return false;
  return true;
}

function riotIdValidator(control: { value: unknown }): { riotId: true } | null {
  const value = typeof control.value === 'string' ? control.value : '';
  if (!value.trim()) return null;
  return isValidRiotId(value) ? null : { riotId: true };
}
