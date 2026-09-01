import 'server-only';

export type EmailMessage = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type EmailSendResult = { providerMessageId: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** In-memory transport for tests and local previews. Nothing leaves the process. */
export class MemoryEmailProvider implements EmailProvider {
  readonly name = 'memory';
  readonly messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.messages.push(structuredClone(message));
    return { providerMessageId: `memory-${this.messages.length}` };
  }
}

export class FailureInjectionEmailProvider implements EmailProvider {
  readonly name = 'failure-injection';
  private readonly mode: 'retryable' | 'permanent';

  constructor(mode: 'retryable' | 'permanent') {
    this.mode = mode;
  }

  async send(): Promise<EmailSendResult> {
    throw new EmailProviderError(this.mode, `injected_${this.mode}_failure`);
  }
}

export class EmailProviderError extends Error {
  readonly kind: 'retryable' | 'permanent';
  readonly safeCode: string;

  constructor(kind: 'retryable' | 'permanent', safeCode: string) {
    super(safeCode);
    this.name = 'EmailProviderError';
    this.kind = kind;
    this.safeCode = safeCode;
  }
}

/**
 * Resend over its REST API. The SDK is deliberately not used so the practice
 * plan adds no dependency to the bundle or the lockfile; the endpoint and the
 * Idempotency-Key header are the same ones the SDK sends.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(apiKey: string, fetchImpl: typeof fetch = fetch, endpoint = 'https://api.resend.com/emails') {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.endpoint = endpoint;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          tags: [{ name: 'message_type', value: 'practice_plan_v2' }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new EmailProviderError('retryable', 'resend_network');
    }
    const body = (await response.json().catch(() => null)) as { id?: string } | null;
    if (!response.ok || !body?.id) {
      const status = response.status || 500;
      const retryable = status === 429 || status >= 500;
      throw new EmailProviderError(retryable ? 'retryable' : 'permanent', `resend_${status}`);
    }
    return { providerMessageId: body.id };
  }
}

export function productionEmailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY_not_configured');
  return new ResendEmailProvider(key);
}
