import { Component, computed, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonInput } from '@ionic/angular/standalone';
import { AuthPendingConfirmationError, isAlreadyAuthenticatedError, mapAuthErrorMessage } from '../../core/auth/auth.errors';
import { AuthService, type SocialProvider } from '../../core/services/auth.service';
import { FortniteCosmeticsService, type FortniteCosmeticThumb } from '../../services/fortnite-cosmetics.service';
import { RobloxExperiencesService } from '../../services/roblox-experiences.service';

type AuthMode = 'signin' | 'signup' | 'confirm';

function passwordMatchValidator(control: AbstractControl) {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  if (!password || !confirm) return null;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  standalone: true,
  selector: 'app-auth-entry-page',
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, IonContent, IonInput],
  template: `
    <ion-content class="auth-gate">
      <div class="auth-gate__shell">
        <div class="auth-gate__content">
          <aside class="auth-gate__visual" aria-hidden="true">
            <div class="auth-gate__visual-bg"></div>

            <div class="auth-gate__stage">
              <p class="auth-gate__watermark">STATS</p>
              <span class="auth-gate__slash"></span>

              @for (char of stageCharacters(); track char.id; let i = $index) {
                <img
                  class="auth-gate__hero-char"
                  [attr.data-layer]="i + 1"
                  [class.auth-gate__hero-char--rbx]="char.platform === 'roblox'"
                  [src]="char.imageUrl"
                  alt=""
                  loading="eager"
                />
              }
            </div>

            <div class="auth-gate__visual-mark">
              <span class="auth-gate__visual-logo">SG</span>
              <span class="auth-gate__visual-name">StatsGames</span>
            </div>
          </aside>

          <div class="auth-gate__layout">
          <header class="auth-gate__brand">
            <span class="auth-gate__logo">SG</span>
            <h1 class="auth-gate__title">StatsGames</h1>
            <p class="auth-gate__tagline">Telemetría gaming en tiempo real</p>
          </header>

          <div class="auth-gate__mobile-platforms" aria-hidden="true">
            @for (char of stageCharacters().slice(0, 2); track char.id) {
              <div
                class="auth-gate__mobile-chip"
                [class.auth-gate__mobile-chip--fortnite]="char.platform === 'fortnite'"
                [class.auth-gate__mobile-chip--roblox]="char.platform === 'roblox'"
              >
                <img [src]="char.imageUrl" [alt]="" width="40" height="40" />
                <span>{{ char.name }}</span>
              </div>
            }
          </div>

          <section class="auth-gate__card u-surface-card">
            @if (mode() !== 'confirm') {
              <nav class="auth-gate__tabs" aria-label="Modo de autenticación">
                <button
                  type="button"
                  class="auth-gate__tab"
                  [class.auth-gate__tab--active]="mode() === 'signin'"
                  (click)="setMode('signin')"
                >
                  Ingresar
                </button>
                <button
                  type="button"
                  class="auth-gate__tab"
                  [class.auth-gate__tab--active]="mode() === 'signup'"
                  (click)="setMode('signup')"
                >
                  Registrarse
                </button>
              </nav>

              <div class="auth-gate__social-row" role="group" aria-label="Inicio con redes sociales">
                <button
                  type="button"
                  class="auth-gate__social-btn auth-gate__social-btn--discord"
                  title="Discord"
                  [disabled]="loading()"
                  (click)="social('Discord')"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037 12.3 12.3 0 0 0-.608 1.25 18.3 18.3 0 0 0-5.487 0 11.6 11.6 0 0 0-.617-1.25.08.08 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.028 14.1 14.1 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13 13 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.07.07 0 0 1 .073-.01c3.927 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .074.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107 15.2 15.2 0 0 0 1.225 1.993.08.08 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.08.08 0 0 0 .032-.054c.5-5.177-.838-9.66-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  class="auth-gate__social-btn auth-gate__social-btn--google"
                  title="Google"
                  [disabled]="loading()"
                  (click)="social('Google')"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                    <path d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.507h3.226c1.891-1.742 2.988-4.305 2.988-7.348z"/>
                    <path d="M12 22c2.7 0 4.964-.894 6.618-2.423l-3.226-2.507c-.894.6-2.036.955-3.392.955-2.605 0-4.81-1.76-5.595-4.123H3.064v2.59A9.996 9.996 0 0 0 12 22z"/>
                    <path d="M6.405 14.902A5.99 5.99 0 0 1 6 12c0-1.01.245-1.964.682-2.802V6.608H3.064A9.996 9.996 0 0 0 2 12c0 1.935.522 3.753 1.436 5.314l3.969-2.412z"/>
                    <path d="M12 5.386c1.47 0 2.787.505 3.823 1.496l2.868-2.868C16.955 2.99 14.7 2 12 2 7.7 2 3.978 4.168 2.064 7.392l3.969 2.412C7.19 7.386 9.395 5.386 12 5.386z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  class="auth-gate__social-btn auth-gate__social-btn--apple"
                  title="Apple"
                  [disabled]="loading()"
                  (click)="social('Apple')"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                    <path d="M16.365 1.43c0 1.14-.46 2.2-1.24 2.99-.84.84-2.05 1.32-3.24 1.24-.08-1.1.42-2.24 1.18-3.02.86-.88 2.1-1.38 3.3-1.21zm3.2 17.07c-.56 1.28-.82 1.86-1.54 3-.99 1.62-2.39 3.64-4.12 3.66-1.54.02-1.94-.99-4.03-.97-2.1.02-2.56 1-4.1.98-1.74-.03-3.07-1.77-4.06-3.38-2.78-4.55-3.08-9.88-1.36-12.72 1.22-1.98 3.16-3.14 5.01-3.14 1.87 0 3.04 1 4.58 1 1.5 0 2.42-1 4.52-1 1.8 0 3.7.98 4.92 2.67-4.32 2.35-3.62 8.46.76 10.04-.3.8-.64 1.55-1.08 2.38z"/>
                  </svg>
                </button>
              </div>

              <div class="auth-divider">o con email</div>

              @if (mode() === 'signin') {
                <form [formGroup]="signinForm" (ngSubmit)="submitSignin()">
                  <div class="auth-gate__field">
                    <span class="auth-gate__field-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>
                    </span>
                    <ion-input type="email" placeholder="Email" formControlName="email" autocomplete="email" />
                  </div>
                  <div class="auth-gate__field">
                    <span class="auth-gate__field-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
                    </span>
                    <ion-input type="password" placeholder="Contraseña" formControlName="password" autocomplete="current-password" />
                  </div>

                  @if (error()) {
                    <p class="auth-notice auth-notice--error">{{ error() }}</p>
                  }

                  <button type="submit" class="u-btn u-btn--primary u-btn--block u-mt-3" [disabled]="signinForm.invalid || loading()">
                    {{ loading() ? 'Ingresando...' : 'Ingresar' }}
                  </button>

                  <button type="button" class="auth-gate__text-link" disabled>¿Olvidaste tu contraseña?</button>
                </form>
              } @else {
                <form [formGroup]="signupForm" (ngSubmit)="submitSignup()">
                  <div class="auth-gate__field">
                    <span class="auth-gate__field-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>
                    </span>
                    <ion-input type="email" placeholder="Email" formControlName="email" autocomplete="email" />
                  </div>
                  <div class="auth-gate__field">
                    <span class="auth-gate__field-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
                    </span>
                    <ion-input type="password" placeholder="Contraseña" formControlName="password" autocomplete="new-password" />
                  </div>
                  <div class="auth-gate__field">
                    <span class="auth-gate__field-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
                    </span>
                    <ion-input type="password" placeholder="Confirmar contraseña" formControlName="confirmPassword" autocomplete="new-password" />
                  </div>

                  <p class="u-hint u-mb-2">Mín. 12 caracteres, mayúscula, número y símbolo.</p>

                  @if (signupForm.hasError('passwordMismatch') && signupForm.touched) {
                    <p class="auth-notice auth-notice--error">Las contraseñas no coinciden.</p>
                  }
                  @if (error()) {
                    <p class="auth-notice auth-notice--error">{{ error() }}</p>
                  }

                  <button type="submit" class="u-btn u-btn--ai u-btn--block u-mt-3" [disabled]="signupForm.invalid || loading()">
                    {{ loading() ? 'Creando...' : 'Crear cuenta' }}
                  </button>
                </form>
              }
            } @else {
              <div class="auth-gate__confirm-head">
                <h2 class="sg-page-header__title u-text-lg u-mb-2">Verificar email</h2>
                <p class="u-text-secondary u-text-sm">Código enviado a</p>
                <p class="auth-gate__email u-truncate">{{ registeredEmail() }}</p>
              </div>

              <form [formGroup]="confirmForm" (ngSubmit)="submitConfirm()">
                <div class="auth-gate__field">
                  <span class="auth-gate__field-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4 7v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V7l-8-4z"/></svg>
                  </span>
                  <ion-input
                    class="auth-code-input"
                    placeholder="Código de 6 dígitos"
                    formControlName="code"
                    inputmode="numeric"
                    maxlength="6"
                    autocomplete="one-time-code"
                  />
                </div>

                @if (error()) {
                  <p class="auth-notice auth-notice--error">{{ error() }}</p>
                }
                @if (notice()) {
                  <p class="auth-notice auth-notice--success">{{ notice() }}</p>
                }

                <button type="submit" class="u-btn u-btn--primary u-btn--block u-mt-3" [disabled]="confirmForm.invalid || loading()">
                  {{ loading() ? 'Verificando...' : 'Confirmar' }}
                </button>
                <button type="button" class="auth-gate__text-link" [disabled]="loading()" (click)="resendCode()">
                  Reenviar código
                </button>
                <button type="button" class="auth-gate__text-link" (click)="setMode('signin')">
                  Volver al ingreso
                </button>
              </form>
            }
          </section>

          <footer class="auth-gate__footer">
            <p class="auth-gate__footer-line">Hecho con pasión por gamers, para gamers</p>
            <p class="auth-gate__legal">
              StatsGames no está afiliado a Epic Games ni Roblox Corporation. Fortnite y Roblox son marcas de sus respectivos titulares.
            </p>
          </footer>
          </div>
        </div>
      </div>
    </ion-content>
  `,
})
export class AuthEntryPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly fortniteCosmetics = inject(FortniteCosmeticsService);
  private readonly robloxExperiences = inject(RobloxExperiencesService);

  readonly fortniteOutfits = signal<FortniteCosmeticThumb[]>([]);
  readonly robloxAvatars = signal<
    Array<{ userId: number; name: string; imageUrl: string }>
  >([]);

  /** Collage full-bleed estilo Mobalytics — sin cards. */
  readonly stageCharacters = computed(() => {
    const fn = this.fortniteOutfits().map((item) => ({
      id: `fn-${item.id}`,
      name: item.name,
      imageUrl: item.iconUrl,
      platform: 'fortnite' as const,
    }));
    const rbx = this.robloxAvatars().map((item) => ({
      id: `rbx-${item.userId}`,
      name: item.name,
      imageUrl: item.imageUrl,
      platform: 'roblox' as const,
    }));

    const layered = [fn[1], rbx[0], fn[0], rbx[1], fn[2]].filter(
      (item): item is NonNullable<typeof item> => !!item,
    );
    return layered.slice(0, 4);
  });

  readonly mode = signal<AuthMode>('signin');
  readonly registeredEmail = signal('');
  private pendingPassword = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly signinForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
  });

  readonly signupForm = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(12),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator },
  );

  readonly confirmForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  ngOnInit(): void {
    void this.loadOfficialCharacters();

    const step = this.route.snapshot.queryParamMap.get('step');
    const email = this.route.snapshot.queryParamMap.get('email');
    const state = history.state as { password?: string };
    const isRegisterRoute = this.route.snapshot.routeConfig?.path === 'register';

    if (step === 'confirm' && email) {
      this.registeredEmail.set(email);
      if (state.password) this.pendingPassword = state.password;
      this.mode.set('confirm');
      return;
    }

    if (isRegisterRoute) {
      this.mode.set('signup');
    }

    const prefillEmail = this.route.snapshot.queryParamMap.get('email');
    if (prefillEmail) {
      this.signinForm.patchValue({ email: prefillEmail });
      this.signupForm.patchValue({ email: prefillEmail });
    }

    void this.redirectIfAlreadyAuthenticated();
  }

  private async loadOfficialCharacters(): Promise<void> {
    // Cargas independientes: Roblox thumbs a menudo cuelga por CORS y no debe bloquear FN.
    void this.fortniteCosmetics.loadFeatured(10).then((shopItems) => {
      const outfits = shopItems.filter((item) => item.type === 'outfit');
      const withFeaturedArt = outfits.filter((item) => /\/featured\./i.test(item.iconUrl));
      const hero = withFeaturedArt[0] ?? outfits[0] ?? shopItems[0];
      if (!hero) {
        this.fortniteOutfits.set([]);
        return;
      }
      const rest = [...withFeaturedArt, ...outfits]
        .filter((item) => item.id !== hero.id)
        .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
      this.fortniteOutfits.set([hero, ...rest].slice(0, 4));
    });

    void this.robloxExperiences.loadShowcaseAvatars(4).then((avatars) => {
      this.robloxAvatars.set(avatars);
    });
  }

  private async redirectIfAlreadyAuthenticated(): Promise<void> {
    const restored = await this.auth.restoreSession();
    if (!restored && !this.auth.isAuthenticated()) return;
    await this.navigateAfterAuth();
  }

  setMode(next: AuthMode): void {
    if (next === 'confirm') return;
    this.mode.set(next);
    this.error.set(null);
    this.notice.set(null);
  }

  async social(provider: SocialProvider): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.loginWithSocialProvider(provider);
      if (this.auth.isAuthenticated()) {
        await this.navigateAfterAuth();
      }
    } catch (err) {
      if (isAlreadyAuthenticatedError(err)) {
        await this.navigateAfterAuth();
        return;
      }
      this.error.set(mapAuthErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async submitSignin(): Promise<void> {
    if (this.signinForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const { email, password } = this.signinForm.getRawValue();
      await this.auth.login(email, password);
      await this.navigateAfterAuth();
    } catch (err) {
      if (err instanceof AuthPendingConfirmationError) {
        this.registeredEmail.set(err.email);
        this.pendingPassword = err.password;
        this.mode.set('confirm');
        return;
      }
      if (isAlreadyAuthenticatedError(err)) {
        await this.navigateAfterAuth();
        return;
      }
      this.error.set(mapAuthErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async submitSignup(): Promise<void> {
    if (this.signupForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const { email, password } = this.signupForm.getRawValue();
      await this.auth.register(email, password);
      this.pendingPassword = password;
      this.registeredEmail.set(email);
      this.mode.set('confirm');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo crear la cuenta');
    } finally {
      this.loading.set(false);
    }
  }

  async resendCode(): Promise<void> {
    const email = this.registeredEmail();
    if (!email) return;

    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);

    try {
      await this.auth.resendConfirmationCode(email);
      this.notice.set('Código reenviado. Revisá tu email.');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo reenviar el código');
    } finally {
      this.loading.set(false);
    }
  }

  async submitConfirm(): Promise<void> {
    if (this.confirmForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const email = this.registeredEmail();
      const { code } = this.confirmForm.getRawValue();
      await this.auth.confirmRegistration(email, code);

      if (!this.pendingPassword) {
        this.error.set('Confirmado. Ingresá con tu contraseña.');
        this.mode.set('signin');
        this.signinForm.patchValue({ email });
        return;
      }

      await this.auth.login(email, this.pendingPassword);
      await this.auth.refreshUserAttributes();
      await this.navigateAfterAuth();
    } catch (err) {
      if (isAlreadyAuthenticatedError(err)) {
        await this.navigateAfterAuth();
        return;
      }
      this.error.set(err instanceof Error ? err.message : 'Código inválido');
    } finally {
      this.loading.set(false);
    }
  }

  private async navigateAfterAuth(): Promise<void> {
    if (this.auth.needsOnboarding()) {
      await this.router.navigateByUrl('/onboarding');
      return;
    }
    await this.router.navigateByUrl('/tabs/dashboard');
  }
}

// Backward-compatible export for existing route lazy import
export { AuthEntryPageComponent as LoginPageComponent };
