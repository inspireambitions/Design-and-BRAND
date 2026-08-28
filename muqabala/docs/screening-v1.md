# Muqabala Proof (Screening V1) — locked spec

Creative review, 28 August 2026. This is the object we are allowed to build.
Anything not in this file is a later version.

## Who it is for

Gulf volume hiring **and** small teams with no career portal.

- Hotel / hospital / agency TA who already posted an advert
- Clinic, shop, startup, or family business that only has a WhatsApp job post or a few lines in English or Arabic

They do not need Workday, a careers page, or an employer account. They need a job title, a short description of the work, and WhatsApp.

## The review (Jobs / Ive / copy)

**The feeling they kept**

Hiring manager: *"I can see who can do the job."*
Candidate: *"A person will read what I said."*

Not: AI hiring. Not: video screening. Not: a better career portal.

**What they killed**

- The name **Screening** on the product. It sounds like a filter, not proof. Internal code may say screening. The human words are **work sample** and **proof**.
- **Eight questions.** Coach already learned that finishing matters. V1 is **three questions**: opener, one job question from their job text, closer. About twelve minutes on a phone.
- **Shortlist / Hold / Not this role.** That is an ATS. V1 has no decision taxonomy.
- **Employer dashboard.** They live in WhatsApp. The report is sent there. A list of candidates in our UI is V2.
- **Employer login to create a link.** Three minutes, no SSO. The link is the product. Rate-limit creation.
- **STAR probes.** Coach only. A live work sample is not a coaching trap.
- **Putting this on the Coach homepage.** Coach’s promise is still: no employer sees practice. Proof is a **separate door**. Quiet footer link only.
- **ATS / Workday / careers-page rebuild.** Out. A portal is optional, never required.

**What they said yes to**

One demo:

1. A hiring lead pastes the job they would send a candidate (WhatsApp message, LinkedIn post, or advert if they have one).
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
| `/for-employers` | Job title + the job in their own words. Optional workplace name. Get a link. No account. No portal. |
| `/s/[code]` | Candidate work sample. Short WhatsApp code, not a fat token. Three questions. Mock-style: no coaching between questions. |
| End of sitting | Unlocked proof the candidate can send on WhatsApp / copy. |

Token lifetime: 14 days. Generation is rate-limited like advert tailoring.

Three questions, in order: shared opener, one role question from the tailored (or catalogue) set, shared closer.

## Explicitly not V1

Employer accounts, candidate inbox, auto-shortlist, score thresholds, SPARK/HireVue video, portal widget, CSV to Workday, STAR in the live sitting, charging the candidate, a careers-page rebuild.

## Build-now plan (do not decorate past this)

The product code for this object is on `cursor/screening-v1-demo-d043` (PR #6). Remaining work is go-live, not new features.

1. **Codex — apply SQL on Muqabala Supabase** (`hmaxzpgsefzpflrwzopa`): `supabase/migrations/20260828120000_allow_screening_mode.sql`. This creates `screening_packs` and allows `interviews.mode = screening`.
2. **Codex — merge PR #6** into `claude/gulf-hospitality-video-interview-m9skfu` so `https://trymuqabala.com/for-employers` exists. Do not turn off Vercel production SSO policy; custom domain is already reachable.
3. **Live loop on trymuqabala.com** (the Jobs yes):
   - SME path: workplace `Nour Clinic`, title `Receptionist`, paste a WhatsApp-length job post → copy `/s/{code}`
   - Hotel path (optional): paste a real advert → same loop
   - Candidate: three answers on typing → send proof on WhatsApp
   - Coach `/practice` still says no employer sees practice
4. **Stop.** Do not add dashboards, logins, or ATS until a real SME or hotel TA uses the link.

The live loop needs the migration **before** production traffic hits pack create.
