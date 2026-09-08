# Schools production release, 8 September 2026

## Live

Public page: https://trymuqabala.com/schools

Production code: 2686008839122b8b1fa272646b43f497e315ae26. GitHub production branch is claude/gulf-hospitality-video-interview-m9skfu. Vercel Git deployment dpl_UsinYSAjc9oAoV2gHuocwzks9v5D is READY and serves the public domain. Its commit matches GitHub.

The founder approved the dedicated production sender, encryption configuration, deployment and schedules. Configuration completed without printing keys or changing existing product secrets. The sender key has sending-only access to auth.trymuqabala.com. A new Schools encryption key is stored as a sensitive production variable. Staging is unchanged.

## Verification

- Ten Schools database migrations applied. All 26 Schools tables have RLS enabled. Production isolation tests passed inside a rolled-back transaction. Existing product policy fingerprint is unchanged.
- 541 regression tests, TypeScript and local production build passed before release. Vercel production build passed.
- Public Schools, home, practice, hiring teams and Schools preview image return HTTP 200.
- Unauthenticated student home redirects to Schools sign-in. Both Schools job endpoints reject missing authentication with HTTP 401.
- The two expected cron_auth_failed log entries at 19:12:01 UTC came from these deliberate unauthorised checks.
- Dedicated sender test 43854fbe-e618-4d10-afff-536c1713ac7d was delivered. Gmail receipt found in hello@trymuqabala.com, message 1a0826ee4f8c4125. This checks the sender directly, not an institution invitation through the queue.
- Mail schedule is every minute. Retention schedule is every five minutes. All three existing schedules are preserved in the READY deployment metadata.
- Real mail scheduler invocations at 19:12 and 19:13 UTC completed with sent 0, failed 0, scheduled true.
- Database readback: zero institutions and zero open cohorts. No institution consent, DPA or enrolment was fabricated.

## Still separate from activation

Real institution onboarding needs the institution contact, confirmed adult students and language, approved questions, DPA, and pilot evaluation and budget decisions. Enrolment remains closed. Physical iPhone and Android journeys still need real-device testing. Production invitation and assignment queue delivery with a real authorised institution is not yet proven. Supplier-copy deletion completion requires its own evidence. No claim is made that all bugs are absent.

## Rollback

Set SCHOOLS_ENABLED=false and remove only the two Schools schedules, or restore the previous production deployment. Keep additive database tables, migration history and encryption keys. Preserve all existing product settings and schedules.

## Final scheduler and sharing check

At 19:15:25 UTC, the canonical Git deployment completed a real retention invocation: queued 0, localDeleted 0, failed 0, scheduled true. Mail also completed at 19:14 and 19:15 UTC on that deployment with failed 0. These empty-queue runs prove authenticated scheduling, not deletion of supplier data or delivery of a queued institution invitation. Public Open Graph title, description, absolute image and large Twitter card tags are present; the image returns 200. Actual messaging-app previews remain separate device checks.

