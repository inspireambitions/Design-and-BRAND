# Career roadmap repair backlog

Source audit: `../outputs/career-roadmap-audit-2026-08-09/AUDIT.md`  
Live route: https://inspireambitions.com/career-change-roadmap  
Status: core repairs deployed to production on 10 August 2026; remaining scope is listed below

## P0: Production and user-safety blockers

- [x] Recover and commit the current Mac production source. Do not deploy the older Windows or GitHub UI.
- [x] Remove the oversized Anthropic structured-output grammar that returns HTTP 400.
- [x] Validate Claude output and retain an explicit, monitored fallback.
- [x] Add production logs that distinguish AI success, AI refusal, invalid output and fallback use.
- [x] Block direct regulated healthcare plans when mandatory education, clinical training, registration or licensing is missing.
- [x] Add official UAE healthcare regulator routing for DHA, DoH and MOHAP. Other regulated occupation families still need taxonomy coverage.
- [x] Treat deadlines as constraints. Never compress an impossible route into the user's chosen date.
- [x] Prevent invalid phase ranges such as `Months 7–6`.
- [x] Reject identical current and target roles and ask the user to choose the intended next level.
- [x] Reject or clarify nonsense, unsafe or unrecognised target roles.
- [ ] Fix `/hospitality-career-path/` so it opens the intended hospitality route, not the internships article.

## P1: Career-planning accuracy

- [ ] Add a role taxonomy with occupation family, seniority band, regulated-role flag and prerequisites.
- [x] Build a housekeeping ladder from Room Attendant through supervisory and management stages to Executive Housekeeper or Director of Housekeeping.
- [x] Build an HR ladder from HR Intern through coordinator, officer, generalist, manager and senior leadership stages to Director of HR.
- [x] Show the next credible stage when the final target cannot be reached within the stated deadline.
- [x] Add promotion gates for experience, scope, leadership, systems, qualifications and measurable evidence.
- [ ] Replace generic skill labels with occupation-specific competencies.
- [x] Explain every transferable-skill count using the user's selected evidence in the two promotion-ladder routes.
- [x] Replace generic training cards with named, current and recognised options in the two promotion-ladder routes.
- [x] Enforce budget limits in the two promotion-ladder routes. A free-only plan contains only free or employer-funded options.
- [x] Add course verification links and a checked date in the two promotion-ladder routes. Do not invent recognition, availability, ratings or prices.
- [x] Make evidence tasks occupation-safe in healthcare, HR and operational hospitality routes. Protect patient, guest, employee and employer information.
- [x] Remove unsuitable public-portfolio advice from healthcare, HR and operational hospitality routes.
- [x] Replace phrases such as `Director of HR craft` and `core tool` with role-specific language.
- [x] Correct generated articles and plurals such as `a HR Intern`, `Director of HRs` and `Director of Housekeepings`.
- [ ] Add a genuine Plan B and risk path for every route.
- [ ] Keep salary guidance source-based, dated and honest. Do not infer unsupported figures.

## P2: State, navigation and trust

- [x] Add `Start fresh` and `Use previous answers` choices when saved answers exist.
- [x] Add a visible reset control and prevent stale answers contaminating a new route.
- [x] Replace the long report navigation strip with a usable compact pattern at narrow widths.
- [x] Prevent the floating coach button from covering report content.
- [x] Make the report method and fallback status clear near the report heading, not only at the bottom.
- [x] Reduce landing-page promises until the verified output supports them.
- [x] Confirm the roadmap remains reachable from the main-domain footer and tools hub.
- [x] Differentiate this roadmap from the Career Motivation Assessment before further promotion.

## P3: Verification and operations

- [x] Add unit tests for AI response parsing and malformed JSON. Refusal and route fallback tests remain under the route-test item below.
- [x] Add route tests for identical roles, regulated roles, deadlines and phase arithmetic.
- [x] Add fixture tests for Room Attendant through the housekeeping leadership ladder and HR Intern to Director of HR.
- [x] Add a nursing safety fixture that cannot produce a direct application plan without recognised prerequisites.
- [x] Run at least ten varied AI reports without a production generation error.
- [x] Verify the report method says AI only when Claude actually generated the report.
- [x] Verify Resend delivery to the approved `info@inspireambitions.com` route without exposing credentials.
- [ ] Test desktop, 390 px mobile, keyboard-only navigation and a screen reader.
- [ ] Recheck footer, internal links, hospitality deep link and Bing indexing after release.

## Release gate

Promotion remains blocked until all P0 items pass in production. P1 route fixtures for housekeeping, HR and nursing must also pass before the tool can claim credible career mapping.
