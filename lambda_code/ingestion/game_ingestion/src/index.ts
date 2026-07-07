import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ZodError } from 'zod';
import { InvalidPlatformError, PlatformAccountNotLinkedError } from '@stats-games/domain';
import { buildEnqueueGameEventUseCase } from './composition-root';

function jsonResponse(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const useCase = buildEnqueueGameEventUseCase();

  const headers = Object.fromEntries(
    Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );

  if (!useCase.validateWebhookSecret(headers)) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const platform = event.pathParameters?.['platform'];
  if (!platform) {
    return jsonResponse(400, { error: 'Plataforma requerida en la ruta.' });
  }

  let payload: unknown;
  try {
    payload = event.body ? JSON.parse(event.body) : null;
  } catch {
    return jsonResponse(400, { error: 'JSON inválido' });
  }

  try {
    const result = await useCase.execute({
      platform,
      payload,
      correlationId: event.requestContext.requestId,
    });

    return jsonResponse(202, {
      accepted: true,
      correlationId: result.correlationId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse(400, { error: 'Payload inválido', details: error.flatten() });
    }
    if (error instanceof InvalidPlatformError) {
      return jsonResponse(400, { error: error.message });
    }
    if (error instanceof PlatformAccountNotLinkedError) {
      return jsonResponse(404, { error: error.message });
    }
    throw error;
  }
};
