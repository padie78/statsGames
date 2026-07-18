import type { SQSBatchResponse, SQSHandler } from 'aws-lambda';
import {
  buildAnalyzeEvolutionWithAiUseCase,
  buildAnalyzeMatchWithAiUseCase,
} from './composition-root';

function isEvolutionMessage(raw: unknown): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { kind?: string }).kind === 'evolution'
  );
}

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const matchUseCase = buildAnalyzeMatchWithAiUseCase();
  const evolutionUseCase = buildAnalyzeEvolutionWithAiUseCase();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const raw: unknown = JSON.parse(record.body);
      if (isEvolutionMessage(raw)) {
        await evolutionUseCase.execute(raw);
      } else {
        await matchUseCase.execute(raw);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'ERROR',
          message: 'Error analizando con Bedrock',
          messageId: record.messageId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
