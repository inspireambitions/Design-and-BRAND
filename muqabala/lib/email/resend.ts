import 'server-only';

import { Resend } from 'resend';

export function lifecycleEmailConfig(): {
  client: Resend;
  from: string;
  replyTo: string;
} | null {
  const apiKey = process.env.MUQABALA_LIFECYCLE_RESEND_API_KEY;
  const from = process.env.MUQABALA_EMAIL_FROM;
  const replyTo = process.env.MUQABALA_EMAIL_REPLY_TO;
  if (!apiKey || !from || !replyTo) return null;
  return { client: new Resend(apiKey), from, replyTo };
}
