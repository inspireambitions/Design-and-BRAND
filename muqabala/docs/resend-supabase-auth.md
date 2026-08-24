# Resend and Supabase Auth setup

Use Supabase Auth for passwordless sign-in and Resend as its custom SMTP service.

## Resend

- Keep the dedicated `auth.trymuqabala.com` sending domain verified with SPF and DKIM in Resend.
- Use `Muqabala <hello@auth.trymuqabala.com>` as the sender. Keep this separate from every other Resend project.
- Keep open and click tracking off for authentication email.
- Add a DMARC record. Start with monitoring, then tighten the policy after delivery checks.

## Supabase

- Set the Site URL to `https://trymuqabala.com`.
- Add `https://trymuqabala.com/auth/confirm` to allowed redirect URLs. The app adds the report claim and safe return path as query parameters.
- Configure Custom SMTP with the Resend SMTP credentials.
- Copy `supabase/templates/magic-link.html` into the Magic Link email template.
- Keep email OTP enabled. The email contains both a button and the six-digit fallback code.
- Confirm the live email-sent, sign-in and OTP-verification limits can support the launch test before traffic is invited.

## Delivery test before launch

Send real sign-in messages to Gmail, Outlook, Yahoo and iCloud. Check Inbox, Promotions and Spam. Confirm the button and code both return to the correct report. No sender can guarantee that every mailbox will avoid Spam, so monitor Resend delivery, bounce and complaint events.
