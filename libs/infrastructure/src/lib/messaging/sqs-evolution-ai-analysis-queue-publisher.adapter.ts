import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type {
  EvolutionAiAnalysisMessage,
  IEvolutionAiAnalysisQueuePublisher,
} from '@stats-games/application';

/** Reutiliza la cola match_ai_analysis con mensajes `{ kind: "evolution", ... }`. */
export class SqsEvolutionAiAnalysisQueuePublisherAdapter
  implements IEvolutionAiAnalysisQueuePublisher
{
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(config: { queueUrl?: string; client?: SQSClient } = {}) {
    this.client = config.client ?? new SQSClient({});
    this.queueUrl =
      config.queueUrl ??
      process.env['MATCH_AI_ANALYSIS_QUEUE_URL'] ??
      process.env['MATCH_AI_QUEUE_URL'] ??
      '';
    if (!this.queueUrl) {
      throw new Error(
        'SqsEvolutionAiAnalysisQueuePublisherAdapter: MATCH_AI_ANALYSIS_QUEUE_URL no configurado.',
      );
    }
  }

  async enqueue(message: EvolutionAiAnalysisMessage): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          kind: { DataType: 'String', StringValue: 'evolution' },
          platform: { DataType: 'String', StringValue: message.platform },
          userId: { DataType: 'String', StringValue: message.userId },
        },
      }),
    );
  }
}
