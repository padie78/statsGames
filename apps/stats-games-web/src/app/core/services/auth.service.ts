import { Injectable, computed, signal } from '@angular/core';
import {
  confirmSignUp,
  fetchAuthSession,
  fetchUserAttributes,
  resendSignUpCode,
  signIn,
  signInWithRedirect,
  signOut,
  signUp,
  updateUserAttributes,
} from 'aws-amplify/auth';
import { isOAuthConfigured } from '../../amplify.config';
import { environment } from '../../../environments/environment';
import { AuthPendingConfirmationError } from '../auth/auth.errors';
import { decodeJwtPayload } from '../auth/appsync-auth.util';

export type SelectedGame = 'roblox' | 'fortnite';
export type SocialProvider = 'Google' | 'Apple' | 'Discord';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _userId = signal<string | null>(null);
  private readonly _email = signal<string | null>(null);
  private readonly _selectedGame = signal<SelectedGame | null>(null);

  readonly userId = computed(() => this._userId());
  readonly email = computed(() => this._email());
  readonly selectedGame = computed(() => this._selectedGame());
  readonly isAuthenticated = computed(() => !!this._userId());
  readonly needsOnboarding = computed(() => this.isAuthenticated() && !this._selectedGame());

  async restoreSession(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) return false;
      this.applyToken(idToken);
      await this.refreshUserAttributes();
      return true;
    } catch {
      return false;
    }
  }

  async completeOAuthRedirect(): Promise<void> {
    await this.persistSessionFromTokens();
    await this.refreshUserAttributes();
  }

  async login(email: string, password: string): Promise<void> {
    const result = await signIn({
      username: email,
      password,
      options: { authFlowType: 'USER_PASSWORD_AUTH' },
    });

    if (!result.isSignedIn) {
      await this.handleIncompleteSignIn(email, password, result.nextStep.signInStep);
      return;
    }

    await this.persistSessionFromTokens();
    await this.refreshUserAttributes();
  }

  async loginWithSocialProvider(provider: SocialProvider): Promise<void> {
    if (!isOAuthConfigured(environment)) {
      throw new Error(
        'Login social no configurado. Ejecutá npm run sync:env tras terraform apply.',
      );
    }

    if (provider === 'Discord') {
      await signInWithRedirect({ provider: { custom: 'Discord' } });
      return;
    }

    await signInWithRedirect({ provider });
  }

  async register(email: string, password: string): Promise<void> {
    await signUp({
      username: email,
      password,
      options: {
        userAttributes: { email },
      },
    });
  }

  async confirmRegistration(email: string, code: string): Promise<void> {
    await confirmSignUp({
      username: email,
      confirmationCode: code,
    });
  }

  async resendConfirmationCode(email: string): Promise<void> {
    await resendSignUpCode({ username: email });
  }

  async updateSelectedGame(game: SelectedGame): Promise<void> {
    await updateUserAttributes({
      userAttributes: {
        'custom:selected_game': game,
        'custom:primary_platform': game,
      },
    });
    this._selectedGame.set(game);
  }

  async refreshUserAttributes(): Promise<void> {
    try {
      const attrs = await fetchUserAttributes();
      const raw = attrs['custom:selected_game'];
      if (raw === 'roblox' || raw === 'fortnite') {
        this._selectedGame.set(raw);
      } else {
        this._selectedGame.set(null);
      }

      if (attrs.email) {
        this._email.set(attrs.email);
      }
    } catch {
      this._selectedGame.set(null);
    }
  }

  async logout(): Promise<void> {
    await signOut();
    this.clearLocalState();
  }

  private clearLocalState(): void {
    this._userId.set(null);
    this._email.set(null);
    this._selectedGame.set(null);
  }

  private async handleIncompleteSignIn(
    email: string,
    password: string,
    signInStep: string,
  ): Promise<never> {
    switch (signInStep) {
      case 'CONFIRM_SIGN_UP': {
        await this.resendConfirmationCode(email);
        throw new AuthPendingConfirmationError(email, password);
      }
      case 'RESET_PASSWORD':
        throw new Error('Tenés que restablecer tu contraseña. Usá "Olvidé mi contraseña" (próximamente).');
      case 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED':
        throw new Error('Tenés que cambiar tu contraseña temporal antes de ingresar.');
      case 'CONFIRM_SIGN_IN_WITH_SMS_CODE':
      case 'CONFIRM_SIGN_IN_WITH_TOTP_CODE':
      case 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE':
        throw new Error('Completá la verificación MFA para continuar.');
      default:
        throw new Error(`No se pudo completar el ingreso (paso: ${signInStep}).`);
    }
  }

  private async persistSessionFromTokens(): Promise<void> {
    const session = await fetchAuthSession({ forceRefresh: true });
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) {
      throw new Error('No se pudo obtener el token de sesión.');
    }
    this.applyToken(idToken);
  }

  private applyToken(idToken: string): void {
    const claims = decodeJwtPayload(idToken);
    const sub = typeof claims['sub'] === 'string' ? claims['sub'] : null;
    const email = typeof claims['email'] === 'string' ? claims['email'] : null;
    const selectedGame = claims['custom:selected_game'];

    if (!sub) {
      throw new Error('Token inválido: falta claim sub.');
    }

    this._userId.set(sub);
    this._email.set(email);

    if (selectedGame === 'roblox' || selectedGame === 'fortnite') {
      this._selectedGame.set(selectedGame);
    }
  }
}
