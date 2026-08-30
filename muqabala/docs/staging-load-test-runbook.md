# Muqabala distributed staging load gate

## Current verdict

Muqabala is not approved for a claim of 1,000 concurrent users.

Controlled production GET bursts from one machine produced:

| Burst | Successful requests | Failure type |
| --- | ---: | --- |
| 50 concurrent, run 1 | 49/50 | Connection timeout |
| 50 concurrent, run 2 | 44/50 | Connection timeouts |
| 150 concurrent | 115/150 | Connection timeouts |

No application 5xx response was confirmed. These results show risk, but they do not prove a server failure. The single source machine, its network path and connection limits are all possible causes. The protected Preview returned Vercel authentication, so that earlier run did not reach Muqabala.

## Required environment

Run this gate only against a dedicated staging deployment and staging Supabase project. Never point the capacity or soak profiles at `trymuqabala.com` or its production aliases.

Before the run:

1. Deploy the exact release commit to Vercel Preview.
2. Use staging equivalents of Supabase and Upstash. Do not write load-test rows into production.
3. Create a dedicated Vercel Protection Bypass for Automation secret. Store it in the load platform's protected secret store. Never put it in source, chat, a command, a URL or a result file.
4. Confirm the preflight response is the application, not Vercel authentication. It must include Muqabala's CSP and an application route header.
5. Record the UTC start time, release commit, Vercel deployment ID, Supabase project, load profile and `LOAD_RUN_ID`.
6. Leave AI scoring off for the infrastructure run. Run a separate, budgeted provider test only with `CONFIRM_AI_SPEND=YES` and approved provider quotas.

## Distributed execution

The harness uses three Grafana Cloud k6 load zones: Mumbai 50%, Singapore 25% and Frankfurt 25%. Bahrain is not used because its public load zone is currently unavailable.

Set non-secret variables for the cloud run:

```text
BASE_URL=https://your-staging-deployment.vercel.app
TARGET_ENV=staging
DISTRIBUTED=YES
LOAD_PROFILE=capacity
LOAD_RUN_ID=release-commit-and-utc-time
JOURNEY_PERCENT=20
```

Provide `VERCEL_AUTOMATION_BYPASS_SECRET` through the platform's protected secret facility. Then run `k6 cloud run scripts/load/interview-journey.js` from an authenticated Grafana Cloud k6 environment.

Run the profiles in this order:

1. `smoke`: verify the deployment, application headers and result classification.
2. `capacity`: ramp through 50, 100, 250, 500 and 1,000 virtual users from three regions.
3. `soak`: hold 150 virtual users for 30 minutes after the capacity run is understood.

The default workload is 80% read journeys and 20% full eight-answer persistence journeys. Change `JOURNEY_PERCENT` only when the intended traffic model is written into the result.

## Logs and correlation

Keep the Vercel and Supabase log windows open for the whole run.

In Vercel Runtime Logs, filter by Preview environment, release branch, deployment, UTC window and affected route. Record status, region, duration, function memory, request ID, trace ID and outgoing Supabase calls. Search for timeouts and 5xx responses. The harness adds `load_run` to each URL so the run is visible in request paths.

In Supabase Logs Explorer, inspect API, Postgres, Auth and Storage sources for the same UTC window. Check connection saturation, statement timeouts, slow statements, lock waits, pool errors and response codes. Export the filtered evidence before log retention removes it.

The harness reports connection failures separately from returned application 5xx responses. Failed application responses also record the non-secret `X-Vercel-Id` value when available. It never prints the Vercel bypass secret.

## Release gates

All of these must pass before any scale statement:

- The run came from at least three cloud regions and reached the application.
- Transport failure rate stayed below 1%.
- Returned application 5xx rate stayed below 0.5%.
- Overall p95 response time stayed below 1.5 seconds for the non-AI journey.
- More than 99% of checks passed.
- Every accepted answer remained stored once, in the correct order, with no lost progress.
- Redis fallback, database recovery and provider 429 behaviour were tested separately.
- Vercel and Supabase logs agree with the client result and explain every material failure group.
- A second run reproduced the result without changing the thresholds.

Even after a pass, use a bounded statement: “A distributed staging test sustained the documented 1,000-user profile.” Do not claim that production supports every possible pattern of 1,000 simultaneous users, and do not claim zero outage.
