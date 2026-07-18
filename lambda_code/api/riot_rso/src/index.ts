import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'content-type': 'application/json',
};

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

interface ExchangeBody {
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
}

interface RiotTokenResponse {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface RiotAccountMe {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta variable de entorno ${name}`);
  }
  return value;
}

async function exchangeCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<RiotTokenResponse> {
  const clientId = requiredEnv('RIOT_RSO_CLIENT_ID');
  const clientSecret = requiredEnv('RIOT_RSO_CLIENT_SECRET');
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
  });
  if (input.codeVerifier) {
    params.set('code_verifier', input.codeVerifier);
  }

  const response = await fetch('https://auth.riotgames.com/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const payload = (await response.json()) as RiotTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        `Riot token exchange falló (${response.status})`,
    );
  }
  return payload;
}

async function fetchRiotAccount(accessToken: string): Promise<RiotAccountMe> {
  const cluster = (process.env.VALORANT_REGION || 'americas').trim();
  const response = await fetch(
    `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/me`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    },
  );
  const payload = (await response.json()) as RiotAccountMe & {
    status?: { message?: string };
  };
  if (!response.ok || !payload.puuid || !payload.gameName || !payload.tagLine) {
    throw new Error(
      payload.status?.message || `Riot accounts/me falló (${response.status})`,
    );
  }
  return payload;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const path = (event.rawPath || '/').replace(/\/+$/, '') || '/';
  if (path !== '/integrations/riot/rso/exchange') {
    return json(404, { error: 'Not found' });
  }

  try {
    const body = JSON.parse(event.body || '{}') as ExchangeBody;
    const code = body.code?.trim();
    const redirectUri = body.redirectUri?.trim();
    if (!code || !redirectUri) {
      return json(400, { error: 'code y redirectUri son obligatorios' });
    }

    const tokens = await exchangeCode({
      code,
      redirectUri,
      codeVerifier: body.codeVerifier?.trim() || undefined,
    });
    const account = await fetchRiotAccount(tokens.access_token!);
    const riotId = `${account.gameName}#${account.tagLine}`;

    return json(200, {
      riotId,
      puuid: account.puuid,
      gameName: account.gameName,
      tagLine: account.tagLine,
      // No devolvemos refresh_token al browser; queda en el servidor si se persiste luego.
      expiresIn: tokens.expires_in ?? null,
      scope: tokens.scope ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en Riot Sign-On';
    const status =
      message.includes('Falta variable') || message.includes('not configured')
        ? 503
        : 400;
    return json(status, { error: message });
  }
};
