import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

export interface BedrockInvokeConfig {
  modelId?: string;
  region?: string;
  client?: BedrockRuntimeClient;
}

/**
 * Invoca Claude (Messages API) vía Bedrock. Modelo configurable por env.
 * Default: Haiku (barato/rápido) — override con BEDROCK_MODEL_ID.
 */
export class BedrockClaudeInvoker {
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor(config: BedrockInvokeConfig = {}) {
    const region = config.region ?? process.env['AWS_REGION'] ?? 'eu-central-1';
    this.client = config.client ?? new BedrockRuntimeClient({ region });
    this.modelId =
      config.modelId ??
      process.env['BEDROCK_MODEL_ID'] ??
      'anthropic.claude-3-haiku-20240307-v1:0';
  }

  async invoke(prompt: string): Promise<string> {
    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    };

    const response = await this.client.send(
      new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: Buffer.from(JSON.stringify(body)),
      }),
    );

    const decoded = new TextDecoder().decode(response.body);
    const parsed = JSON.parse(decoded) as {
      content?: Array<{ type?: string; text?: string }>;
      outputText?: string;
    };

    if (parsed.outputText) return parsed.outputText;
    const text = (parsed.content ?? [])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('\n')
      .trim();
    if (!text) throw new Error('Bedrock respondió sin texto');
    return text;
  }
}
