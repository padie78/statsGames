import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type {
  IMatchAiAnalysisQueuePublisher,
  MatchAiAnalysisMessage,
} from '@stats-games/application';

export interface SqsMatchAiAnalysisQueueConfig {
  queueUrl?: string;
  client?: SQSClient;
}

export class SqsMatchAiAnalysisQueuePublisherAdapter implements IMatchAiAnalysisQueuePublisher {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(config: SqsMatchAiAnalysisQueueConfig = {}) {
    this.client = config.client ?? new SQSClient({});
    this.queueUrl =
      config.queueUrl ??
      process.env['MATCH_AI_ANALYSIS_QUEUE_URL'] ??
      process.env['MATCH_AI_QUEUE_URL'] ??
      '';
    if (!this.queueUrl) {
      throw new Error(
        'SqsMatchAiAnalysisQueuePublisherAdapter: MATCH_AI_ANALYSIS_QUEUE_URL no configurado.',
      );
    }
  }

  async enqueue(message: MatchAiAnalysisMessage): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          platform: { DataType: 'String', StringValue: message.platform },
          userId: { DataType: 'String', StringValue: message.userId },
        },
      }),
    );
  }
}
