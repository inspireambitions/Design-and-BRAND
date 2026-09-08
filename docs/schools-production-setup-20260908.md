# Schools production setup, 8 September 2026

## Installed and verified

- Production Supabase project: hmaxzpgsefzpflrwzopa.
- Applied ten existing tested Schools migrations, in order. No staging records were copied.
- All 26 Schools tables have row-level security enabled.
- Existing public product policy fingerprint before and after: a8d1ca176dba185d2eca259243521391.
- Production transaction tests passed for adviser submitted-only access, assigned-cohort isolation, student draft ownership, institution-admin answer privacy, employer read/write denial on all public Schools tables, removed-member denial, client evidence-write denial, tampered assignment denial and anonymous RPC denial.
- The test transaction rolled back. Afterwards: zero Schools institutions, cohorts, sessions, attempts and outbox messages.
- Existing production Auth SMTP is configured at smtp.resend.com, from hello@auth.trymuqabala.com. Site URL is https://trymuqabala.com. Existing SMTP credentials were not changed.
- Resend auth.trymuqabala.com is verified with sending enabled. DKIM and SPF records are verified.
- Production OPENAI_API_KEY, CRON_SECRET and INTERVIEW_SECRET setting names exist. Secret values were not printed or changed.
- TypeScript, the production Webpack build and 541 regression tests passed.

## Prepared release

Isolated checkout: schools-production-20260908, branch codex/schools-production-20260908. Based on the tested Schools release 94f5c8f. Existing production source remains 5dee134.

- Add /api/schools/mail every minute.
- Add /api/schools/retention every five minutes.
- Preserve all three existing production schedules.
- Log worker completion counts and whether the request identifies as a Vercel cron invocation. Authorisation still requires the existing cron secret.
- Dedicated domain-restricted sending-only Schools Resend key, sender Muqabala Schools <hello@auth.trymuqabala.com>.
- New SCHOOLS_DATA_KEY for Schools mail encryption only. Existing product secrets stay unchanged.
- Production SCHOOLS_FEEDBACK_MODEL=gpt-4.1-mini and SCHOOLS_ENABLED=true for the prepared release. Institutions and cohort enrolment remain closed until founder setup.
- Configuration script is prepared, syntax checked and not executed. It stops if production Schools keys already exist so it cannot silently rotate them.

## Exact approval still required

Automatic approval review rejected the attempted production configuration write because it combined enabling Schools with persistent email and encryption settings. It required approval for that exact production activation. The rejected command did not run. No Schools key was created, no Vercel production setting changed, no production code deployment occurred and no new cron schedule became active.

Approve creating the dedicated Schools sender key, configuring the five named Schools production settings, deploying the tested Schools release and activating its two schedules while institution enrolment stays closed. No permission or DPA completion is assumed for any institution.

## Verification after activation

- Confirm production hostname, database and exact Git source.
- Confirm protected routes and cron requests reject missing authentication.
- Verify a controlled email reaches hello@trymuqabala.com and the queue receipt is saved.
- Observe real scheduled mail and retention runs with completion evidence. A manual invocation alone does not prove scheduling.
- Verify production sign-in and the public landing page, plus employer and personal-practice smoke checks.
- Physical-device journeys remain a separate test. Real student enrolment still requires institution/contact, adult confirmation, language, adviser-approved questions, DPA and pilot budget/evaluation decisions.

## Rollback

Disable SCHOOLS_ENABLED and remove only the two new Schools schedules, or restore the prior production deployment. Leave additive database tables and migration history intact. Do not drop Schools data or rotate encryption keys as a rollback shortcut. Keep all existing employer and personal-practice settings and schedules unchanged.

## Security review notes

The security advisor found no Schools table without RLS. Service-only tables intentionally have no client policies. Existing non-Schools notices about mark_invite_submitted and password protection remain outside this change; no existing policies were weakened. Advisor reference: https://supabase.com/docs/guides/database/database-linter.
