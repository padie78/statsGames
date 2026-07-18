import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const STATE_KEY = 'sg.riot.rso.state';
const VERIFIER_KEY = 'sg.riot.rso.verifier';

export interface RiotRsoExchangeResult {
  riotId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
}

/**
 * Riot Sign-On (RSO) — OAuth authorize en el browser + exchange en Lambda.
 * Docs: https://developer.riotgames.com/docs/valorant#rso-integration
 */
@Injectable({ providedIn: 'root' })
export class RiotRsoService {
  isReady(): boolean {
    return Boolean(environment.riot.clientId?.trim());
  }

  get redirectUri(): string {
    return (
      environment.riot.redirectUri?.trim() ||
      `${window.location.origin}/integrations/riot/callback`
    );
  }

  get exchangeUrl(): string {
    const configured = environment.riot.tokenExchangeUrl?.trim();
    if (configured) return configured;
    const base = environment.mediaProxyBaseUrl?.replace(/\/+$/, '') ?? '';
    return `${base}/integrations/riot/rso/exchange`;
  }

  /** Redirige a auth.riotgames.com/authorize. */
  async startLogin(): Promise<void> {
    const clientId = environment.riot.clientId?.trim();
    if (!clientId) {
      throw new Error(
        'Falta el Client ID de Riot Sign-On. Configurá environment.riot.clientId (RSO Client aprobado).',
      );
    }

    const state = createRandomString(32);
    const verifier = createRandomString(64);
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(VERIFIER_KEY, verifier);

    const challenge = await pkceChallenge(verifier);
    const url = new URL(environment.riot.authorizeUrl || 'https://auth.riotgames.com/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', environment.riot.scopes || 'openid offline_access');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    window.location.assign(url.toString());
  }

  /**
   * Tras el redirect de Riot: valida state, intercambia code en Lambda y
   * devuelve Riot ID listo para linkPlatformAccount.
   */
  async completeLogin(params: {
    code: string | null;
    state: string | null;
    error?: string | null;
    errorDescription?: string | null;
  }): Promise<RiotRsoExchangeResult> {
    if (params.error) {
      throw new Error(params.errorDescription || params.error);
    }
    if (!params.code) {
      throw new Error('Riot no devolvió un código de autorización.');
    }

    const expectedState = sessionStorage.getItem(STATE_KEY);
    const verifier = sessionStorage.getItem(VERIFIER_KEY) ?? undefined;
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);

    if (!expectedState || !params.state || params.state !== expectedState) {
      throw new Error('State OAuth inválido. Reintentá Iniciar sesión con Riot.');
    }

    const response = await fetch(this.exchangeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: params.code,
        redirectUri: this.redirectUri,
        codeVerifier: verifier,
      }),
    });

    const payload = (await response.json()) as RiotRsoExchangeResult & { error?: string };
    if (!response.ok || !payload.riotId) {
      throw new Error(payload.error || `No se pudo completar Riot Sign-On (${response.status})`);
    }
    return {
      riotId: payload.riotId,
      puuid: payload.puuid,
      gameName: payload.gameName,
      tagLine: payload.tagLine,
    };
  }
}

function createRandomString(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64Url(arr);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
