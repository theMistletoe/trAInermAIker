# Parallel review: QA form batch submit

## Critical
- none

## Warning (addressed in-session)
- `!ok` always QA_COMPLETED → re-read unanswered and branch
- Client does not recover on 409 → refetch listQa
- Partial-answer tests missing → add QaForm + integration coverage
- COUNT-guard path untested → add db/integration assertion

## Suggestion (deferred)
- schema unique questionId
- useRef submit lock
- disable textarea while submitting
