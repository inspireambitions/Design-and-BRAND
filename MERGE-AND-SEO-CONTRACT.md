# AI Career Coach and Hospitality Career Path merge

## Product structure

There is one product engine: **Inspire Ambitions AI Career Coach**. The full
output is the **Career Change Roadmap**. Hospitality is a specialist entry
route inside that product, not a second scoring and report system.

## URLs and search intent

- `/career-change-roadmap/` targets **AI career coach**, **career change
  roadmap**, **career transition plan** and related broad queries.
- `/hospitality-career-path/` stays at the original URL and targets
  **hospitality career path simulator**, **hotel career path**, **hospitality
  career coach** and department/promotion queries.
- The two pages have different copy and canonical URLs. They cross-link and do
  not duplicate the same landing-page text.
- The hospitality landing starts the shared coach with
  `/career-change-roadmap/start?industry=hospitality`.

Do not redirect the original hospitality URL to an internship guide. Remove
that redirect only when the shared coach is deployed and the replacement page
has passed mobile and end-to-end checks.

## Internal links

Use the original hospitality URL on the Career Tools page, Hospitality Career
Toolkit, relevant hotel-career articles and the AI Career Coach landing page.
Use `/career-change-roadmap/` from career-change articles, Career Tools and the
site footer. Do not add sitewide exact-match links repeatedly.

## Claims and consent

- The score is a low-stakes planning-fit estimate, not a psychometric result.
- AI changes the explanation, not hidden qualification or salary facts.
- No mechanically generated hospitality salary bands are published as market
  data. Exact local figures require a maintained, sourced dataset.
- Entering an email unlocks the report and records completion for Inspire
  Ambitions. It does not subscribe the person to a newsletter.
- Newsletter consent, if added later, must be a separate unticked choice.

## Production gate

1. Deploy the shared app at `/career-change-roadmap/`.
2. Verify the hospitality query opens the hospitality version of the wizard.
3. Replace the WordPress page body with
   `wordpress/hospitality-career-path.html`.
4. Remove the incorrect redirect from `/hospitality-career-path/`.
5. Update Career Tools and hospitality internal links to the original URL.
6. Test canonical tags, indexability, schema, mobile flow, email delivery,
   owner notification, PDF, reset and follow-up coach.
7. Submit both final URLs for indexing after the live checks pass.
