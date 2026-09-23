# M6 GA4 release gate

This checklist is intentionally manual. The repository can prove the event
contract and ensure test runs do not contact Google; it cannot inspect a
property or an organisation's data-retention setting.

## Before enabling collection

1. Configure `NEXT_PUBLIC_GA_MEASUREMENT_ID` in the production environment.
2. This Taiwan deployment does not use a GA consent UI or consent gate. With no
   configured measurement ID, the gateway remains a no-op.
3. In DebugView and Realtime, walk all eight events: `symbol_view`,
   `select_content`, `search`, `layout_interaction`, `info_sheet_action`,
   `quiz_start`, `quiz_answer`, and `quiz_complete`.
4. Exercise pointer and keyboard selections; complete one correct and one
   incorrect quiz answer. Confirm an unknown search sends `search_term=other`
   and never the raw text.

## Register only parameters used in analysis

Use event-scoped custom dimensions for `symbol_id`, `layout_id`, `hotspot_id`,
`surface`, `content_type`, `origin_page_type`, `search_surface`, `action`,
`context`, `start_type`, `picked_symbol_id`, and `input_method`. Register
event-scoped numeric metrics for `result_count`, `candidate_count`,
`question_count`, `question_index`, and `correct_count`; use `correct` as a
boolean dimension if it is needed in Explorations.

Create four Explorations: content entry → core interaction, viewer candidate →
confirmation (including miss/reselect), info-sheet depth, and quiz start →
answer → completion with target/picked pairs.

## Record the site-owner decisions

Record the date and outcome in
`.scratch/m6-observability-ux/issues/07-ga4-debugview-and-release-checklist.md`:

- DebugView sample for every event and its checked payload;
- internal/development traffic filtering;
- the Taiwan no-consent-gate decision, data retention, Google Signals and ads
  personalisation choices;
- the public location of the anonymous aggregate analytics notice;
- 375 × 812 and 320 × 568 smoke results, including reduced motion;
- M7's observation-window start date and the reminder not to infer a product
  decision from a tiny sample.
