# Muqabala Proof (Screening V1) — locked spec

Creative review, 28 August 2026. This is the object we are allowed to build.
Anything not in this file is a later version.

## The review (Jobs / Ive / copy)

**The feeling they kept**

Hiring manager: *"I can see who can do the job."*
Candidate: *"A person will read what I said."*

Not: AI hiring. Not: video screening. Not: a better career portal.

**What they killed**

- The name **Screening** on the product. It sounds like a filter, not proof. Internal code may say screening. The human words are **work sample** and **proof**.
- **Eight questions.** Coach already learned that finishing matters. V1 is **three questions**: opener, one job question from their advert, closer. About twelve minutes on a phone.
- **Shortlist / Hold / Not this role.** That is an ATS. They already have one. V1 has no decision taxonomy.
- **Employer dashboard.** They live in WhatsApp. The report is sent there. A list of candidates in our UI is V2.
- **Employer login to create a link.** Three minutes, no SSO. The link is the product. Rate-limit creation.
- **STAR probes.** Coach only. A live work sample is not a coaching trap.
- **Putting this on the Coach homepage.** Coach’s promise is still: no employer sees practice. Proof is a **separate door**. Quiet footer link only.
- **ATS / Workday / careers-page rebuild.** Out.

**What they said yes to**

One demo:

1. A hiring lead pastes the advert they already posted.
2. They get one link.
3. They WhatsApp it.
4. The candidate speaks or types three answers on a phone. They can edit the words. Video never leaves the phone.
5. They send the proof (quoted answers, scores only where scored) to the hiring lead.
6. A human decides. The product never rejects anyone.

If that loop is not love, more features will not help.

## Rules that do not move

Same scoring engine as Coach. Content only. Unscored ≠ zero. No face, accent, fluency. No auto-reject. Say what leaves the device. Typing is equal.

Practice interviews and proof sittings never mix. A Coach attempt must not appear as employer proof.

## V1 object

| Surface | What it is |
|---|---|
| `/for-employers` | Paste job title + advert. Optional workplace name. Get a link. No account. |
| `/s/[code]` | Candidate work sample. Short WhatsApp code, not a fat token. Three questions. Mock-style: no coaching between questions. |
| End of sitting | Unlocked proof the candidate can send on WhatsApp / copy. |

Token lifetime: 14 days. Generation is rate-limited like advert tailoring.

Three questions, in order: shared opener, one role question from the tailored (or catalogue) set, shared closer.

## Explicitly not V1

Employer accounts, candidate inbox, auto-shortlist, score thresholds, SPARK/HireVue video, portal widget, CSV to Workday, STAR in the live sitting, charging the candidate.

## Ship rule

Build this object. Test it live. Do not decorate it until a real hotel TA uses the link.

The live loop needs the `screening_packs` table and `interviews.mode` to allow `screening`. Apply `supabase/migrations/20260828120000_allow_screening_mode.sql` on the Muqabala project before production traffic.
