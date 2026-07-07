import { fetchAuthSession } from 'aws-amplify/auth';

export async function authenticatedAppsyncOptions(): Promise<{
  authMode: 'userPool';
  authToken: string;
}> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) {
    throw new Error('No hay sesión activa. Iniciá sesión nuevamente.');
  }
  return { authMode: 'userPool', authToken: idToken };
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  if (!payload) return {};
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '='));
  return JSON.parse(json) as Record<string, unknown>;
}
