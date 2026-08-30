import 'server-only';

import { Resend } from 'resend';

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

  constructor(private readonly mode: 'retryable' | 'permanent') {}

  async send(): Promise<EmailSendResult> {
    throw new EmailProviderError(this.mode, `injected_${this.mode}_failure`);
  }
}

export class EmailProviderError extends Error {
  constructor(readonly kind: 'retryable' | 'permanent', readonly safeCode: string) {
    super(safeCode);
    this.name = 'EmailProviderError';
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const { data, error } = await this.client.emails.send({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      tags: [{ name: 'message_type', value: 'practice_plan_v1' }],
    }, { idempotencyKey: message.idempotencyKey });
    if (error || !data?.id) {
      const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500;
      const retryable = status === 429 || status >= 500;
      throw new EmailProviderError(retryable ? 'retryable' : 'permanent', `resend_${status || 'error'}`);
    }
    return { providerMessageId: data.id };
  }
}

export function productionEmailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY_not_configured');
  return new ResendEmailProvider(key);
}
