import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const UPSTREAM = 'https://fortnite-api.com';
const SHOP_CACHE_TTL_MS = 5 * 60 * 1000;
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'content-type': 'application/json',
};

type ShopCache = { expiresAt: number; status: number; body: string };
let shopCache: ShopCache | null = null;

function jsonResponse(statusCode: number, body: unknown, cacheSeconds = 0): APIGatewayProxyResultV2 {
  const headers: Record<string, string> = { ...CORS_HEADERS };
  if (cacheSeconds > 0) {
    headers['cache-control'] = `public, max-age=${cacheSeconds}`;
  } else {
    headers['cache-control'] = 'no-store';
  }
  return {
    statusCode,
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function matchRoute(path: string): { kind: 'shop' } | { kind: 'cosmetic'; id: string } | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  if (normalized === '/media/fortnite/shop') return { kind: 'shop' };

  const cosmetic = normalized.match(/^\/media\/fortnite\/cosmetics\/([A-Za-z0-9_-]{2,80})$/);
  if (cosmetic?.[1]) return { kind: 'cosmetic', id: cosmetic[1] };

  return null;
}

async function fetchUpstream(pathWithQuery: string): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${UPSTREAM}${pathWithQuery}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    const body = await response.text();
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const route = matchRoute(event.rawPath || event.requestContext.http.path || '');
  if (!route) {
    return jsonResponse(404, { error: 'Not found' });
  }

  try {
    if (route.kind === 'shop') {
      const now = Date.now();
      if (shopCache && shopCache.expiresAt > now) {
        return jsonResponse(shopCache.status, shopCache.body, 300);
      }

      const language = event.queryStringParameters?.['language'] ?? 'en';
      const upstream = await fetchUpstream(`/v2/shop?language=${encodeURIComponent(language)}`);
      shopCache = {
        status: upstream.status,
        body: upstream.body,
        expiresAt: now + SHOP_CACHE_TTL_MS,
      };
      return jsonResponse(upstream.status, upstream.body, upstream.status === 200 ? 300 : 30);
    }

    const language = event.queryStringParameters?.['language'] ?? 'en';
    const upstream = await fetchUpstream(
      `/v2/cosmetics/br/${encodeURIComponent(route.id)}?language=${encodeURIComponent(language)}`,
    );
    return jsonResponse(upstream.status, upstream.body, upstream.status === 200 ? 600 : 30);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream failed';
    return jsonResponse(502, { error: 'Fortnite media proxy failed', detail: message });
  }
};
