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
import { RiotRsoService } from '../../core/game/riot-rso.service';
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
  | 'cs2'
  | 'dota2'
  | 'overwatch2'
  | 'clash_royale'
  | 'brawl_stars';

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
            Vinculá Valorant, LoL, CS2, Dota 2, Overwatch 2, Rocket League, Fortnite, Clash
            Royale, Brawl Stars y Roblox. El poller captura partidas al cerrar según cada API.
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
            <sg-neon-badge [tone]="profile()?.dota2Id ? 'lime' : 'muted'">
              Dota 2 {{ profile()?.dota2Id ? '✓ ' + profile()!.dota2Id : 'sin vincular' }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="profile()?.overwatch2Id ? 'lime' : 'muted'">
              Overwatch 2
              {{ profile()?.overwatch2Id ? '✓ ' + profile()!.overwatch2Id : 'sin vincular' }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="profile()?.clashRoyaleId ? 'cyan' : 'muted'">
              Clash Royale
              {{ profile()?.clashRoyaleId ? '✓ ' + profile()!.clashRoyaleId : 'sin vincular' }}
            </sg-neon-badge>
            <sg-neon-badge [tone]="profile()?.brawlStarsId ? 'cyan' : 'muted'">
              Brawl Stars
              {{ profile()?.brawlStarsId ? '✓ ' + profile()!.brawlStarsId : 'sin vincular' }}
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
              <strong>Valorant:</strong> perfiles privados por defecto → Riot Sign-On (recomendado) o
              historial Público + Riot ID → matchlist (≤3 min) → KDA, HS%, mapa, agente + Bedrock.
            </li>
            <li>
              <strong>League of Legends:</strong> Riot ID → match-v5 → KDA, CS, visión, campeón
              (historial mayormente público; no requiere RSO).
            </li>
            <li>
              <strong>CS2:</strong> SteamID64 → validación Steam; partidas vía webhook / companion.
            </li>
            <li>
              <strong>Rocket League:</strong> webhook/companion + opcional ballchasing.
            </li>
            <li>
              <strong>Fortnite:</strong> poller fortnite-api.com (diff de carrera).
            </li>
            <li>
              <strong>Roblox:</strong> Blox Fruits, Adopt Me!, Brookhaven (+ BedWars/Arsenal badges).
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

            @if (isValorantLink()) {
              <aside class="sg-valorant-access" aria-label="Acceso a Valorant">
                <p class="sg-valorant-access__eyebrow">Privacidad Riot · Valorant</p>
                <h3 class="sg-valorant-access__title">Los perfiles nacen privados</h3>
                <p class="sg-valorant-access__lede">
                  A diferencia de League of Legends (partidas mayormente públicas), en Valorant Riot
                  bloquea matchlist / match-v1 con API key si el jugador no dio permiso. Sin
                  historial Público o Riot Sign-On, la petición vuelve con error de seguridad.
                </p>

                <div class="sg-valorant-access__paths" role="tablist" aria-label="Método de acceso">
                  <button
                    type="button"
                    role="tab"
                    class="sg-valorant-access__path"
                    [class.sg-valorant-access__path--active]="valorantAccessMode() === 'rso'"
                    [class.sg-valorant-access__path--muted]="!riotRsoReady()"
                    [attr.aria-selected]="valorantAccessMode() === 'rso'"
                    (click)="valorantAccessMode.set('rso')"
                  >
                    <span class="sg-valorant-access__path-kicker">{{
                      riotRsoReady() ? 'Recomendado' : 'Falta Client ID'
                    }}</span>
                    Riot Sign-On
                  </button>
                  <button
                    type="button"
                    role="tab"
                    class="sg-valorant-access__path"
                    [class.sg-valorant-access__path--active]="valorantAccessMode() === 'public'"
                    [attr.aria-selected]="valorantAccessMode() === 'public'"
                    (click)="valorantAccessMode.set('public')"
                  >
                    <span class="sg-valorant-access__path-kicker">{{
                      riotRsoReady() ? 'Alternativa' : 'Disponible ahora'
                    }}</span>
                    Perfil público
                  </button>
                </div>

                @if (valorantAccessMode() === 'rso' && riotRsoReady()) {
                  <div class="sg-valorant-access__panel">
                    <p class="u-m-0">
                      Iniciá sesión en Riot y autorizá a StatsGames. Riot devuelve un token de
                      acceso; con ese permiso obtenemos tu Riot ID y la API puede entregar
                      telemetría sin depender del historial público.
                    </p>
                    <button
                      type="button"
                      class="u-btn u-btn--primary u-btn--block"
                      [disabled]="!auth.userId() || linking() || rsoStarting()"
                      (click)="startRiotSignOn()"
                    >
                      {{ rsoStarting() ? 'Redirigiendo a Riot…' : 'Iniciar sesión con Riot' }}
                    </button>
                  </div>
                } @else if (valorantAccessMode() === 'rso' && !riotRsoReady()) {
                  <div class="sg-valorant-access__panel">
                    <p class="u-m-0">
                      El botón no se habilita porque todavía no hay un
                      <strong>RSO Client ID</strong>
                      de Riot en este entorno. Riot solo entrega ese ID tras aprobar una app de
                      producción + RSO; sin él no se puede abrir el login oficial.
                    </p>
                    <button
                      type="button"
                      class="u-btn u-btn--gold u-btn--block"
                      (click)="valorantAccessMode.set('public')"
                    >
                      Continuar con perfil público
                    </button>
                  </div>
                } @else {
                  <div class="sg-valorant-access__panel">
                    <ol class="sg-valorant-access__steps">
                      <li>
                        Entrá a tu
                        <a [href]="riotAccountUrl" target="_blank" rel="noopener noreferrer"
                          >cuenta Riot</a
                        >
                        (o a una plataforma que ya uses, p. ej. Tracker.gg) y poné el historial de
                        partidas de Valorant en
                        <strong>Público</strong>.
                        <a
                          [href]="valorantPrivacyHelpUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          >Guía oficial</a
                        >.
                      </li>
                      <li>Pegá tu Riot ID abajo (<code>Nombre#TAG</code>).</li>
                      <li>
                        Confirmá el checkbox: sin historial público, el poller recibe 403 aunque el
                        ID sea correcto.
                      </li>
                    </ol>

                    <label class="sg-valorant-access__check">
                      <input
                        type="checkbox"
                        [checked]="valorantPrivacyAck()"
                        (change)="onValorantPrivacyAck($event)"
                      />
                      <span>
                        Confirmé que mi historial de partidas de Valorant está en
                        <strong>Público</strong>.
                      </span>
                    </label>
                  </div>
                }
              </aside>
            }

            @if (!isValorantLink() || valorantAccessMode() === 'public') {
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

              @if (!isValorantLink()) {
                <div class="sg-integrations-help">
                  <p class="sg-integrations-help__title u-m-0">{{ helpTitle() }}</p>
                  <p class="u-hint u-m-0">{{ helpBody() }}</p>
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
                [disabled]="
                  linkForm.invalid ||
                  linking() ||
                  !auth.userId() ||
                  (isValorantLink() && !valorantPrivacyAck())
                "
              >
                {{ linking() ? 'Vinculando…' : submitLabel() }}
              </button>
            } @else {
              @if (linkError()) {
                <p class="u-error">{{ linkError() }}</p>
              }
              @if (linkSuccess()) {
                <p class="u-success">{{ linkSuccess() }}</p>
              }
            }
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
        border: 1px solid rgba(200, 155, 60, 0.35);
        background: #0b1220;
      }
    `,
  ],
})
export class IntegrationsPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly riotRso = inject(RiotRsoService);
  private readonly playerService = inject(PlayerService);
  private readonly notifications = inject(MatchNotificationsStore);
  private readonly fb = inject(FormBuilder);

  readonly profile = signal<PlayerProfileView | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly linking = signal(false);
  readonly linkError = signal<string | null>(null);
  readonly linkSuccess = signal<string | null>(null);
  readonly rsoStarting = signal(false);
  /** Valorant: RSO si hay clientId; si no, perfil público. */
  readonly valorantAccessMode = signal<'rso' | 'public'>('public');
  readonly valorantPrivacyAck = signal(false);
  readonly selectedPlatform = signal<LinkablePlatform>('valorant');

  readonly webhookBase = environment.webhookUrlPattern ?? '';
  readonly webhookUrl = this.webhookBase || '…/webhooks/{platform}';
  readonly riotAccountUrl = environment.riot.accountUrl;
  readonly valorantPrivacyHelpUrl = environment.riot.valorantPrivacyHelpUrl;

  readonly isValorantLink = computed(() => this.selectedPlatform() === 'valorant');
  readonly riotRsoReady = computed(() => this.riotRso.isReady());

  readonly allPlatformOptions: SelectOption<LinkablePlatform>[] = [
    { value: 'valorant', label: 'Valorant' },
    { value: 'league_of_legends', label: 'League of Legends' },
    { value: 'cs2', label: 'Counter-Strike 2' },
    { value: 'dota2', label: 'Dota 2' },
    { value: 'overwatch2', label: 'Overwatch 2' },
    { value: 'rocket_league', label: 'Rocket League' },
    { value: 'fortnite', label: 'Fortnite' },
    { value: 'clash_royale', label: 'Clash Royale' },
    { value: 'brawl_stars', label: 'Brawl Stars' },
    { value: 'roblox', label: 'Roblox (Blox Fruits / Adopt Me / Brookhaven)' },
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
      case 'dota2':
        return 'SteamID64';
      case 'overwatch2':
        return 'BattleTag (Nombre#1234)';
      case 'clash_royale':
      case 'brawl_stars':
        return 'Player tag (#ABC123)';
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
      case 'dota2':
        return 'ej. 76561198000000000';
      case 'overwatch2':
        return 'ej. Player#1234';
      case 'clash_royale':
      case 'brawl_stars':
        return 'ej. #2PP';
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
      case 'dota2':
        return 'Dota 2 / Steam';
      case 'overwatch2':
        return 'Overwatch 2 / Battle.net';
      case 'clash_royale':
        return 'Clash Royale / Supercell';
      case 'brawl_stars':
        return 'Brawl Stars / Supercell';
      default:
        return 'BedWars & Arsenal';
    }
  });

  readonly helpBody = computed(() => {
    switch (this.linkForm.controls.platform.value) {
      case 'valorant':
        return 'Valorant exige historial Público o Riot Sign-On. Con API key sola, Riot bloquea matchlist/match-v1 si el perfil está privado.';
      case 'rocket_league':
        return 'Nombre visible en replays/ballchasing o companion. API oficial Psyonix no está abierta: webhook o ballchasing.';
      case 'fortnite':
        return 'Stats públicas en Epic. Preferí account id 32-hex. Poller cada ~3 min.';
      case 'league_of_legends':
        return 'Formato obligatorio: Nombre#TAG. En LoL el historial es mayormente público: alcanza con el Riot ID (sin RSO). El poller captura ranked/normales.';
      case 'cs2':
        return 'SteamID64 de 17 dígitos que empieza con 7656119. Perfil Steam → Account details, o steamid.io.';
      case 'dota2':
        return 'SteamID64 de 17 dígitos (mismo formato que CS2). El poller usa OpenDota / Steam Web API.';
      case 'overwatch2':
        return 'BattleTag con formato Nombre#1234. Stats públicas vía ecosystem API / webhook partner.';
      case 'clash_royale':
        return 'Player tag de Clash Royale (empieza con #). API oficial Supercell con token en infra.';
      case 'brawl_stars':
        return 'Player tag de Brawl Stars (empieza con #). API oficial Supercell con token en infra.';
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
        this.selectedPlatform.set(platform);
        this.applyExternalIdValidators(platform);
        this.prefillExternalId(platform);
        this.linkSuccess.set(null);
        this.linkError.set(null);
        if (platform === 'valorant') {
          this.resetValorantAccessUi();
        }
      });
    this.selectedPlatform.set(this.linkForm.controls.platform.value);
    this.applyExternalIdValidators(this.linkForm.controls.platform.value);
  }

  ngOnInit(): void {
    void this.loadProfile();
  }

  onValorantPrivacyAck(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valorantPrivacyAck.set(input.checked);
  }

  async startRiotSignOn(): Promise<void> {
    this.linkError.set(null);
    this.linkSuccess.set(null);
    this.rsoStarting.set(true);
    try {
      await this.riotRso.startLogin();
    } catch (err) {
      this.linkError.set(err instanceof Error ? err.message : 'No se pudo iniciar Riot Sign-On');
      this.rsoStarting.set(false);
    }
  }

  private resetValorantAccessUi(): void {
    this.valorantAccessMode.set(this.riotRso.isReady() ? 'rso' : 'public');
    this.valorantPrivacyAck.set(false);
    this.rsoStarting.set(false);
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

      if (platform === 'valorant') {
        if (this.valorantAccessMode() === 'rso') {
          this.linkError.set('Usá “Iniciar sesión con Riot” o cambiá a Perfil público.');
          return;
        }
        if (!this.valorantPrivacyAck()) {
          this.linkError.set(
            'Confirmá que tu historial de Valorant está en Público. Si sigue privado, Riot bloquea match-v1.',
          );
          return;
        }
      }

      if (
        (platform === 'valorant' || platform === 'league_of_legends') &&
        !isValidRiotId(trimmedId)
      ) {
        this.linkError.set(
          'Riot ID inválido. Usá el formato exacto Nombre#TAG (ej. Player#NA1).',
        );
        return;
      }

      if (
        (platform === 'cs2' || platform === 'dota2') &&
        !/^7656119\d{10}$/.test(trimmedId)
      ) {
        this.linkError.set(
          'SteamID64 inválido. Debe ser 17 dígitos y empezar con 7656119.',
        );
        return;
      }

      if (
        (platform === 'clash_royale' || platform === 'brawl_stars') &&
        !/^#?[A-Za-z0-9]{3,15}$/.test(trimmedId)
      ) {
        this.linkError.set('Player tag inválido. Usá el formato #ABC123.');
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
          ? `Valorant vinculado: ${trimmedId}. Con historial Público y RIOT_API_KEY activa, en ≤3 min deberían aparecer partidas en /tabs/matches. Si el perfil sigue privado, Riot devolverá 403.`
          : platform === 'league_of_legends'
            ? `League of Legends vinculado: ${trimmedId}. Con RIOT_API_KEY activa, el poller trae ranked/normales en ≤3 min a Partidas. Revisá que LOL_REGION coincida con tu shard (europe/americas/asia).`
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
    } else if (platform === 'cs2' || platform === 'dota2') {
      control.setValidators([Validators.required, Validators.pattern(/^7656119\d{10}$/)]);
    } else if (platform === 'clash_royale' || platform === 'brawl_stars') {
      control.setValidators([Validators.required, Validators.pattern(/^#?[A-Za-z0-9]{3,15}$/)]);
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
        this.selectedPlatform.set(platform);
        this.applyExternalIdValidators(platform);
        this.prefillExternalId(platform);
        if (platform === 'valorant') {
          this.resetValorantAccessUi();
        }
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
    if (!profile.dota2Id) return 'dota2';
    if (!profile.overwatch2Id) return 'overwatch2';
    if (!profile.clashRoyaleId) return 'clash_royale';
    if (!profile.brawlStarsId) return 'brawl_stars';
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
      case 'dota2':
        return p?.dota2Id;
      case 'overwatch2':
        return p?.overwatch2Id;
      case 'clash_royale':
        return p?.clashRoyaleId;
      case 'brawl_stars':
        return p?.brawlStarsId;
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
      case 'dota2':
        return 'Dota 2';
      case 'overwatch2':
        return 'Overwatch 2';
      case 'clash_royale':
        return 'Clash Royale';
      case 'brawl_stars':
        return 'Brawl Stars';
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
