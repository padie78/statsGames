import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const UPSTREAM = 'https://fortnite-api.com';
const SHOP_CACHE_TTL_MS = 5 * 60 * 1000;
const NEWS_CACHE_TTL_MS = 10 * 60 * 1000;
const MAP_CACHE_TTL_MS = 60 * 60 * 1000;
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'content-type': 'application/json',
};

type CacheEntry = { expiresAt: number; status: number; body: string };
let shopCache: CacheEntry | null = null;
let newsCache: CacheEntry | null = null;
let mapCache: CacheEntry | null = null;

function jsonResponse(statusCode: number, body: unknown, cacheSeconds = 0): APIGatewayProxyResultV2 {
  const headers: Record<string, string> = { ...CORS_HEADERS };
  headers['cache-control'] = cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-store';
  return {
    statusCode,
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

type Route =
  | { kind: 'shop' }
  | { kind: 'news' }
  | { kind: 'map' }
  | { kind: 'cosmetic'; id: string };

function matchRoute(path: string): Route | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  if (normalized === '/media/fortnite/shop') return { kind: 'shop' };
  if (normalized === '/media/fortnite/news') return { kind: 'news' };
  if (normalized === '/media/fortnite/map') return { kind: 'map' };

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
    return { status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

function cachedOrFetch(
  cache: CacheEntry | null,
  ttlMs: number,
  fetchFn: () => Promise<{ status: number; body: string }>,
): Promise<{ cache: CacheEntry; hit: boolean }> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return Promise.resolve({ cache, hit: true });
  }
  return fetchFn().then((upstream) => ({
    hit: false,
    cache: {
      status: upstream.status,
      body: upstream.body,
      expiresAt: now + ttlMs,
    },
  }));
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

  const language = event.queryStringParameters?.['language'] ?? 'en';

  try {
    if (route.kind === 'shop') {
      const result = await cachedOrFetch(shopCache, SHOP_CACHE_TTL_MS, () =>
        fetchUpstream(`/v2/shop?language=${encodeURIComponent(language)}`),
      );
      shopCache = result.cache;
      return jsonResponse(result.cache.status, result.cache.body, result.cache.status === 200 ? 300 : 30);
    }

    if (route.kind === 'news') {
      const result = await cachedOrFetch(newsCache, NEWS_CACHE_TTL_MS, () =>
        fetchUpstream(`/v2/news/br?language=${encodeURIComponent(language)}`),
      );
      newsCache = result.cache;
      return jsonResponse(result.cache.status, result.cache.body, result.cache.status === 200 ? 600 : 30);
    }

    if (route.kind === 'map') {
      const result = await cachedOrFetch(mapCache, MAP_CACHE_TTL_MS, () => fetchUpstream('/v1/map'));
      mapCache = result.cache;
      return jsonResponse(result.cache.status, result.cache.body, result.cache.status === 200 ? 3600 : 30);
    }

    const upstream = await fetchUpstream(
      `/v2/cosmetics/br/${encodeURIComponent(route.id)}?language=${encodeURIComponent(language)}`,
    );
    return jsonResponse(upstream.status, upstream.body, upstream.status === 200 ? 600 : 30);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream failed';
    return jsonResponse(502, { error: 'Fortnite media proxy failed', detail: message });
  }
};
