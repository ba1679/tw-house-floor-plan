# M5 release checklist

This checklist covers the manual release checks that cannot be proven from the repository alone.

## CI gates

- [ ] The latest pull request or `main` run of `M5 release gate` is green.
- [x] `npm run validate` reports at least 12 / 14 verified symbols. M5 currently expects 14 / 14.
- [x] `npm test` is green.
- [x] `npm run audit` is green for home, floorplan, symbol, category, and quiz representative pages.

## GA4 settings

- [ ] Production has a valid `NEXT_PUBLIC_GA_MEASUREMENT_ID` in `G-...` format.
- [ ] Consent Mode default is queued before GA config and before any `symbol_view` event.
- [ ] Taiwan traffic has `analytics_storage` granted by default for phase one.
- [ ] Advertising consent remains denied: `ad_storage`, `ad_user_data`, and `ad_personalization`.
- [ ] Google Ads is not linked.
- [ ] Event-level data retention is set to 2 months.

## GA4 smoke

- [ ] Open GA4 Realtime or DebugView.
- [ ] Visit a symbol page and confirm one `symbol_view` with `source = search` or `source = category`.
- [ ] Open a floorplan InfoSheet and confirm one `symbol_view` with `source = layout`, `symbol_id`, `layout_id`, and `hotspot_id`.
- [ ] Answer a quiz item and open its explanation; confirm one `symbol_view` with `source = quiz`, `symbol_id`, `layout_id`, and the selected `hotspot_id`.
- [ ] Confirm event payloads do not include URL query strings, names, account identifiers, search text, or learning-progress values.

## Production smoke

Use the existing public Vercel production URL as the canonical host for phase one. Do not wait for a custom domain.

- [ ] Home page loads.
- [ ] Representative floorplan page loads: `/layouts/3b2l_standard`.
- [ ] Representative symbol page loads: `/symbols/window`.
- [ ] Representative category page loads: `/categories/door_window`.
- [ ] Representative quiz page loads: `/layouts/3b2l_standard/quiz`.
- [ ] `/robots.txt` is reachable.
- [ ] `/sitemap.xml` is reachable and excludes quiz pages.
- [ ] Shared Open Graph image is reachable: `/brand/og-home.svg`.
- [ ] Favicon is reachable: `/brand/favicon.svg`.
- [ ] Apple touch icon is reachable: `/brand/apple-touch-icon.png`.
- [ ] JSON-LD appears where expected: WebSite on home, DefinedTerm on symbol pages, CollectionPage on category pages, and LearningResource on floorplan pages.
- [ ] Quiz page remains `noindex`.

## Canonical host

- [ ] Metadata canonical URLs use the existing Vercel production host.
- [ ] No metadata URL points at localhost or a preview deployment.
- [x] Adding a custom domain is tracked as a future canonical migration, not part of M5.
