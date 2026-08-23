# Muqabala saved-report threat model

## Scope and assumptions

This model covers the optional email link used to keep a completed practice report across devices. The application is public. Reports can contain sensitive career feedback. Candidates must never see another candidate's report. Full answer transcripts, video, voice and pasted job adverts are outside this server-side feature and must remain outside it.

## Data flow

1. The candidate completes an interview and sees the full report in the browser.
2. If they choose email saving, the browser sends only question text, scores, feedback and short evidence extracts to the report API.
3. The server creates an unclaimed report with a random one-time claim token. Only a SHA-256 hash of that token and a keyed hash of the email address are stored.
4. Supabase Auth emails a magic link. After authentication, the claim endpoint checks the token hash, signed-in email hash, owner state and expiry in one conditional update.
5. Row Level Security permits signed-in candidates to read or delete only rows they own.
6. Unclaimed rows expire after 48 hours. Claimed rows expire after 90 days.

## Trust boundaries and assets

- Browser to Vercel route: untrusted network input.
- Vercel route to Supabase: privileged server connection. The secret key must never reach the browser.
- Supabase email link: bearer link protected by the additional email match and one-time claim state.
- Upstash: stores rate-limit counters only, not reports, emails or transcripts.
- Highest-value assets: report confidentiality, candidate identity, deletion rights, Supabase secret key and report claim secret.

## Priority threats and controls

| Threat | Impact | Control | Verification |
|---|---|---|---|
| Candidate reads or deletes another report | High | Authenticated RLS compares `auth.uid()` with `owner_id`; no client update or insert grant | Two-user integration test before production |
| Stolen or guessed claim link | High | 256-bit random token, hash at rest, email ownership match, one-time conditional claim, 48-hour expiry | Tampered, expired and replay tests |
| Full answers accidentally stored | High | Dedicated strict schema and explicit projection from `Attempt`; no transcript field | Automated transcript-exclusion test and database sample inspection |
| Email or report spam creates cost | Medium | Honeypot, body limits, per-network and per-email durable Upstash limits; feature fails closed without limits | 429 and missing-config tests |
| Secret leaks into client bundle or logs | High | Secret-only environment names and server modules; error responses contain no internals | Bundle search and Vercel log inspection |
| Report retained longer than promised | Medium | Database expiry timestamps, daily deletion job and candidate delete endpoint | Forced-expiry integration test |
| Script or markup in generated feedback | Medium | React renders stored strings as escaped text; no raw HTML renderer | Stored-XSS browser test |
| Auth link redirects off-site | Medium | Callback accepts only local paths and rejects protocol-relative paths | Redirect test |
| Email provider account compromise | High | Dedicated Supabase project, custom SMTP credentials, least privilege and account MFA | Dashboard configuration review |

## Production gates

- Apply the migration to the dedicated Muqabala Supabase project.
- Configure a verified `trymuqabala.com` sender through custom SMTP.
- Configure all six required environment variables and confirm none appear in the client bundle.
- Run two-account RLS, replay, expiry, delete, rate-limit, mobile and Arabic tests against the preview deployment.
- Inspect one claimed database row and confirm it contains no transcript, video, voice or job advert.
- Keep production unchanged until every gate passes.
