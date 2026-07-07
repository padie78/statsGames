import { Injectable, computed, signal } from '@angular/core';
import {
  confirmSignUp,
  fetchAuthSession,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';
import { decodeJwtPayload } from './appsync-auth.util';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _userId = signal<string | null>(null);
  private readonly _email = signal<string | null>(null);

  readonly userId = computed(() => this._userId());
  readonly email = computed(() => this._email());
  readonly isAuthenticated = computed(() => !!this._userId());

  async restoreSession(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) return false;
      this.applyToken(idToken);
      return true;
    } catch {
      return false;
    }
  }

  async login(email: string, password: string): Promise<void> {
    await signIn({ username: email, password });
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) {
      throw new Error('No se pudo obtener el token de sesión.');
    }
    this.applyToken(idToken);
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

  async logout(): Promise<void> {
    await signOut();
    this._userId.set(null);
    this._email.set(null);
  }

  private applyToken(idToken: string): void {
    const claims = decodeJwtPayload(idToken);
    const sub = typeof claims['sub'] === 'string' ? claims['sub'] : null;
    const email = typeof claims['email'] === 'string' ? claims['email'] : null;
    if (!sub) {
      throw new Error('Token inválido: falta claim sub.');
    }
    this._userId.set(sub);
    this._email.set(email);
  }
}
