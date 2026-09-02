# Universal Interview Brain V2 evaluation

The release gate reads JSON Lines files from `gold/`. It refuses to run the quality evaluation until all of these are true:

- at least 300 human-reviewed turns
- two different human raters per turn
- at least 80% agreement on the sufficiency band
- all four validation roles are present
- ENTRY, PROFESSIONAL and MANAGER levels are present
- every candidate type in the build specification is present

Do not duplicate or synthetically expand the starter cases to satisfy the count. The gold set is an evidence standard, not a fixture-count target.

Run `npm run gate:universal-gold` to validate the human set. Then run `npm run eval:universal -- evaluation/universal/gold evaluation/universal/results/latest.jsonl` after producing model results for the same case ids.

Each result line must include:

```json
{"id":"fd-001","action":"PROBE_RESULT","competencies":["c_guest_service"],"sufficiency":"PARTIAL","band":"Developing evidence","followup":"What changed for the guest?","feedback_points":["result missing"],"invented_candidate_facts":[],"major_evidence_missed":false,"unnecessary_probe":false,"schema_failed_after_retry":false}
```
