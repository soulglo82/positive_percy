# POSITIVE PERCY — UNIFIED V2 IMPLEMENTATION PLAN
## Locked engineering handover · Revision 1 · 15 November 2026

**Status:** APPROVED IMPLEMENTATION BASELINE / NOT PRODUCTION-READY  
**Owner decisions:** frozen at the owner-approved Stage 1 register on this branch. Do not infer approvals for unselected items.  
**Target:** one coordinated, fully tested Positive Percy v2 app release, with matching Framer website and report branding.  
**Environment policy:** keep the live app and database unchanged until formal release gates pass. This document does not authorise merges, migrations, deployments, data deletion or publication of legal drafts.

### Quick start for the next engineer

1. Clone branch **handover/percy-v2-engineering-assets-2026-11-15** of **soulglo82/positive_percy**.
2. Run **python3 scripts/brand/unpack-stage1-brand-pack.py**. This reconstructs the exact Git-stored, 150-file approved brand package and validates its SHA-256 and every ZIP member. The normal extracted assets appear under **design/brand/library/Positive_Percy_Stage1_Brand_System/**.
3. Read, in this order:
   - **This document** (engineering scope, order, acceptance, blockers).
   - **design/stage1/APPROVAL_REGISTER.json** (machine-readable explicit selections; no substitutions).
   - **design/stage1/06_APPROVAL_WORKSHEET.md**.
   - **design/stage1/STAGE1_BRAND_SYSTEM_HANDOVER.md**.
   - **design/PERCY_V2_UNIFIED_RELEASE_HANDOVER.md** (older design handover, superseded where this plan and later explicit approvals differ).
   - **design/brand/archives/README.md** and the brand kit **07_Handoff/README.md**, **logo-manifest.json**, and visual style guide.
4. Inspect PR dependency chain **#45 → #46 → #47 → #48 → #49** before implementation. These branches are stacked, open, draft and unmerged as of this document.
5. Implement in an **integration branch based on this handover branch**, not directly on production. Avoid rewriting original approved asset files. Do not deploy an intermediate old-look Goals UI.

### 0. Executive delivery contract

**Product purpose:** a calm, positive family reward and goals app for parents and children aged approximately 3–12. The parent is the operator of awards, completion and spending. Motivate positive behaviour and celebrate achievable progress; do not build a punishment-oriented chore tracker.

**Day 1 must deliver:**
- Unified Fox 1A branded React experience across all existing routes and dialogs, matching approved Stage 1 visuals.
- Correct, family-local, parent-managed Today's Goals: one-off dates and recurring weekly schedules linked to existing behaviour point values.
- Functional reward picker with exactly 71 distinct approved Phosphor Duotone icons across 12 approved category memberships (84 placements), category browse, local name/synonym search and responsive grid.
- Existing points, reward spending, saving, exports, family report, Undo, account access and history preserved.
- Complete mobile/desktop accessibility and QA evidence.
- Consistent website / app / family-report branding, subject to website publication and privacy readiness checks.
- No unintended change to children, families, balances, rewards, history, stored images or permissions.

**Explicit Day 1 exclusions:**
- 44 additional candidate reward-picker icons; post-launch additions require a separate approval.
- New parent reward-image uploads (existing saved images must still render and remain editable without data loss).
- Independent child accounts or a sixth Goals navigation tab.
- New points currency, manually entered points on goal creation, punitive deductions for missed days, automatic reward spending or unsolicited streak resets.
- Enabling recoverable deletion or purge machinery before its separate backup/legal/security gates.
- Unauthorised Streamline asset redistribution in the user-selectable icon library.
- Reopening approved Fox 1A / palette / icon decisions on preference alone.

### 1. Baseline and branch topology

**Live production:** Railway Positive Percy project, service **compassionate-growth**, source branch **claude/migrate-base64-percy-code-PNAym**, last confirmed successful app deployment **12 Nov 2026** (Batch C Family Report PDF). Live database is PostgreSQL with a separate scheduled db-backup service. A successful backup job is not proof of recoverability.

**Design selector:** separate Railway service **percy-stage1-design-selector**, connected to design/percy-stage1-interactive-preview; this is an isolated read-only tool, not the production app. It must not be merged into the live web server or inherit production secrets.

**Draft dependency stack:**

| PR | Source branch | Role | Status at baseline |
| --- | --- | --- | --- |
| #45 | feat/batch-e1-todays-goals-core | Goals DB migration 014, family-local scheduling, point ledger and idempotency | draft, CI success |
| #46 | feat/batch-e2-goals-ui | Parent Today's Goals interface and management | draft, CI success; previous old-look UI under DESIGN HOLD |
| #47 | feat/percy-v2-unified-redesign | 13-screen HTML prototype and visual integration handover | draft; not a completed React migration |
| #48 | design/percy-stage1-asset-board | Source-pinned original Phosphor/Streamline assets and selection boards | draft |
| #49 | design/percy-stage1-interactive-preview | Owner approval register and isolated selector | draft |

**New handover branch:** handover/percy-v2-engineering-assets-2026-11-15, based on the HEAD of #49. It adds this plan and the complete reconstructed brand-asset archive. It is not a deploy branch.

**Integration rule:** preserve the logical PR order and review diffs carefully; the current #46 PR description references an older brand baseline and is superseded by the later Fox 1A Stage 1 approvals. Do not simply merge #46 and ship its old-look UI. Rebase/merge the stacked work in an isolated integration branch, resolve conflicts, run the full test suite and only then create a final release PR targeting the deployed branch. Keep migration order and rollout compatibility explicit.

**CI caveat:** green CI on design branches verifies existing checks, not visual readiness or complete end-to-end v2 integration.

### 2. Sources of truth and ownership

1. User-approved mappings and UX choices: **design/stage1/APPROVAL_REGISTER.json**, version at handover 1.8; the worksheet supplies human-readable rationale.
2. Brand asset copies: **design/brand/library/** after running the unpack script. The archive is lossless, immutable and checksum-verified. The original approved source SVG catalog remains **design/assets/**.
3. Fox 1A: approved sleek seated left-tail fox, single yellow star, traced vector and wordmark in the source logo kit. It is a trace of the approved board, not the illustrator's original control-point design; verify visual fidelity at normal and small sizes. Never replace it with generic fox art, earlier mascot variants or old public/logo-mark.png.
4. Brand currency star: **separate unresolved master**. Do not substitute the decoration sticker or legacy Lucide Star without explicit owner review.
5. Data/ledger/permissions: existing server contract and PR #45; treat the database as authoritative for balances, award values, schedules and access permissions.
6. App/website/report: shared semantic tokens and original artwork, without unreviewed differences between channels.

When a later explicit owner selection contradicts old prose in PR bodies, the approval register controls the visual choice. Do not extrapolate an approval to a related but previously unselected asset.

### 3. Locked brand system

**Palette (semantic aliases should map to these source values):**
- Primary deep purple: **#4B1D8C**
- Energetic orange: **#FF6A00**
- Sunshine yellow: **#FFC938**
- Warm cream: **#FFF6E8**
- Main ink: **#271737**
- Fine lilac: **#E5DCEA**

Maintain semantic aliases (text / surface / border / primary / success / accent), with contrast tests. White on orange and yellow/orange on cream may not be legible for normal text; essential glyphs and text use contrast-qualified purple or ink. Do not invent new palette families in this pass.

**Typography:** Nunito **700/800** headings; Poppins **400/500/600** body and controls. Self-host legally sourced WOFF2 subsets; preserve SIL OFL notices. No font binaries are in the delivered archive. Current production Figtree/Fredoka is the former interim Batch D system.

**Components:** minimum goal completion target **44x44 CSS px**, visible glyph **24x24 CSS px**. Preserve screen-reader labels, focus rings, keyboard controls, reduced-motion preferences and typography scaling. Use Phosphor-approved icon source variant and stable asset IDs, not emoji or incidental Lucide substitutes in refreshed UI.

**Five top-level navigation destinations:** Home, Progress/Children, Activity, Rewards, Settings. Reflect the approved icon mapping and labels; Today's Goals is within parent flows, not a sixth main tab.

**Today's Goals statuses:**
- Retain the existing category icon on a completed goal, plus a distinct **check-circle:duotone** and visible **Done** text.
- Recurring goals display **repeat:duotone** and the actual schedule in readable text; never mistake recurrence for a streak.
- Header gets small decorative **sparkle:duotone**. No animation is approved by that choice.
- A missed day carries no points deduction.

**Reward picker, locked behaviour:**
- 12 categories, **71** unique approved icons, **84** category placements. An icon can be in several selected categories; combined search de-duplicates by canonical asset ID.
- Search matches display names and curated everyday synonyms locally; no AI API or service dependency. Engineers should author/QA the exact alias list and result ordering without changing icon membership.
- Columns depend on **available picker container width**: **<520 CSS px → 3**, **520–759 → 5**, **>=760 → 6**. Avoid viewport-based breakpoints for this grid.
- Accent map: **purple** = Learning & growth, Family & kindness, Tech & media, Animals & pets; **orange** = Fun & games, Treats & food, Sports & movement, Things & pocket money; **sunshine** = Outings, Creative time, Nature & outdoors, Celebrations.
- Preserve existing reward emoji, image URLs/files, titles, costs, point histories and identifiers. Parent may optionally choose an approved icon when editing; never migrate/replace all icons automatically.
- New image uploads: **off** for launch.
- **Proposed / not additionally approved:** Phosphor-only user-selectable picker source policy. Source set already approved as 71 Phosphor icons; if policy requires explicit commercial/licensing sign-off, obtain it without expanding/replacing the selected assets.

**Illustrations:** ten placements are selected. Use exact source asset IDs and original SVGs from the register. Goals empty state is **Freepik Bright Adventure Map #3570506**, matching 512x512 PNG included in the archive, not a Streamline map/clipboard replacement; commercial-use licence and attribution proof must be retained before production use.

### 4. Implementation work packages (ordered)

#### W0 — Repository and asset preflight

**Tasks**
- [ ] Check out handover branch; run the asset unpack command; verify SHA-256 and exactly 150 file entries.
- [ ] Confirm Git LFS is not required for these files. Retain original pack and manifest as provenance; production runtime should consume selected exports only, not the whole design archive.
- [ ] Catalog approved logos, 71 picker icons, 38 context mappings and 10 illustrations; verify all referenced source SVGs exist. Detect duplicate IDs, missing files, case mismatches, and external hotlinked artwork.
- [ ] Validate that obsolete rejected design variants are not imported into runtime assets.
- [ ] Reconcile the prior legacy logo, category icons, type and tokens against the approved new source.
- [ ] Record exact Freepik asset copyright/licence and Streamline usage/attribution evidence, with a production-use gate.

**Acceptance / evidence:** deterministic source file inventory, verified asset hash, no missing selection IDs, one manifest mapping runtime component to source file and licence status. No deployment.

#### W1 — Shared design tokens, fonts, logo components and star

**Tasks**
- [ ] Introduce semantic tokens to src/index.css, src/lib/tokens.js and Tailwind configuration together; remove inconsistent hard-coded legacy colours in target routes.
- [ ] Self-host Nunito/Poppins, with fallbacks, font weights, preloading policy and licence text.
- [ ] Implement reusable **PercyLogo** with horizontal, stacked, symbol-only, reverse and monochrome variants from the actual kit.
- [ ] Configure correct app icon, favicon, PWA icon, iOS opaque icon, Android adaptive and social OG images, respecting platform mask/size rules.
- [ ] Produce/approve a separate **PercyPointsStar** master in the existing palette; replace legacy Lucide star only after approved visual fidelity check.
- [ ] Expose accessible logo alt text and no redundant spoken decorative rays.
- [ ] Adopt identical token definitions for Framer and generated Family Report PDF branding.

**Acceptance / evidence:** screenshot comparison of 1A reference vs installed asset, legible small favicons at 16/32/48/64, no wrong-tail/face variant, fonts and token tests pass, contrast passes. Star master explicitly approved or documented release blocker.

#### W2 — Icon and illustration system

**Tasks**
- [ ] Replace generic UI glyphs with the exact 38 owner-selected source IDs for navigation, controls, behaviours and selected reward contexts.
- [ ] Ensure server-stored behaviour icon keys and client mappings round-trip; unknown legacy values safely fall back without data deletion.
- [ ] Use approved Phosphor sources for UI and registered original Streamline SVGs for eligible curated illustrations; include attribution where required.
- [ ] Integrate the exact 10 illustration placements. For Freepik Goals empty-state art, isolate behind the licence gate; do not invent a replacement.
- [ ] Keep icon components tree-shakeable and stable across desktop/mobile.
- [ ] Do not silently promote the 44 additional picker candidates.

**Acceptance / evidence:** snapshot tests for every approved mapping, no missing assets or rejected visuals; icon path provenance traceable to original SHA/ID; licence evidence recorded before public display.

#### W3 — Today's Goals backend correctness (PR #45)

**Tasks**
- [ ] Independently review migration **014**; preserve migration **013** reservation for the disabled deletion workstream; verify schema compatibility and migration tests.
- [ ] One-off per-child dated goals; weekly recurring weekday goals; family-local date boundaries, timezone and DST rules; archive/edit functionality.
- [ ] Link goals to existing behaviour categories and read configured positive award amount **on server**, never trust the client to set award amounts.
- [ ] Enforce one completion award per goal/family-local scheduled date; stable request_id idempotency; concurrency-safe DB transactions and child-row locks.
- [ ] Corrections and Undo preserve audit trail and permit valid same-day re-completion only according to PR #45 behaviour.
- [ ] Preserve cross-family isolation and existing point-event/export contracts; no retrospective balance overwrite.

**Acceptance / evidence:** migration/DB tests including 2 parents tapping simultaneously, retries, stale clients, family midnight, DST, category changes, editing archived goals, undo race and cross-family denial. No duplicate awards or negative balances.

#### W4 — Today's Goals integrated parent UI (PR #46 + v2 design)

**Tasks**
- [ ] Integrate parent-operated goal list on Home and detailed Manage Goals route/dialog without new main nav tab.
- [ ] Select child, create/edit one-off/recurring goals, show actual behaviour point values, schedule and active/archived states.
- [ ] Show retained category icon and distinct Done mark/text on completion, readable recurrence with Repeat SVG, Sparkle heading accent, 44px touch targets.
- [ ] Prevent client-supplied points, future-day completion, duplicate processing and ambiguous retries.
- [ ] Make progress and actions accessible to keyboard and screen readers; expose failure and Undo outcomes accurately.
- [ ] Empty state uses licensed actual treasure-map artwork when cleared.

**Acceptance / evidence:** E2E creates/completes/undoes/retries/edits/archives real goals; UI reflects server-authoritative date and points; no child-operated award; suitable 390px/834px/1280px views.

#### W5 — Reward picker, reward data compatibility and spending

**Tasks**
- [ ] Build picker using exact 71-source Phosphor list (not all 115 candidates), 12 owner-approved category memberships and exact accent map.
- [ ] Implement category browse plus deterministic local synonym search; de-dup combined results by canonical asset ID while showing icon in each approved category.
- [ ] Use picker-container width breakpoints 520/760; verify tile readability and scrolling for mobile dialogs.
- [ ] Support Edit optional icon change while preserving all existing reward emoji/images, points, IDs, visibility, redemption and stacking history.
- [ ] Confirm current parent-controlled redemption confirmation/Undo and insufficient-balance rules remain unchanged by icon migration.
- [ ] Keep new image-upload control disabled/absent at launch; existing images still render.
- [ ] Add migration-safe fallback for an unrecognised old icon key; no destructive bulk conversion.

**Acceptance / evidence:** exact 71/84 counts, deduplicated search, synonym test corpus, 3/5/6 responsive layout, empty/no-result states, legacy reward regression fixtures, multi-child visibility tests, zero data loss.

#### W6 — All screens + functional regression

Build and reconcile **13 user flows/screens** against the actual approved React design: Home, Children/Progress, Today's Goals, Activity, Rewards, Settings, Create/Edit Reward, Manage Goals, Create/Edit Goal, Add Points, Save/Spend, Shared Carers concept, First-run Onboarding.

Keep core actions reachable; preserve existing 5 navigation destinations, family code flows, family report PDF, JSON export, Undo, positive-only award rule, accessibility and large-family layouts.

**Shared-carer constraint:** the design-only mockup is NOT proof of server-enforced shared identity. For Day 1 launch, either implement proper adult identity/invite/roles with tenant-isolation and adversarial tests, OR hold the control behind a disabled/hidden gate and formally reconcile the product's launch scope with the owner. Never ship a pretend invite button or use a family code as proof of an authenticated carer's permission.

**Acceptance / evidence:** full regression with existing fixture data and documented intentionally unchanged behaviour. No broken export/points/rewards flows after new styling.

#### W7 — Security, privacy, legal and backup release gates

**Separate draft PR #42:** privacy/terms/DPIA are not publishable yet. Resolve legal controller identity and contact path, actual data processing/vendor inventory and international transfers, data-retention, governing law and legal review. Avoid invented corporate registration details or publishing placeholder policies as completed.

**Separate draft PR #43:** 7-day recoverable family deletion remains disabled. Its 4 flags and purge process must remain off until audited backups, tested isolated restore, deletion suppression for disaster restores, retention obligations, Railway monitored purge schedule and independent security review. Do not let v2 styling enable it.

**Backup:** db-backup Railway cron exists, but require at least one time-stamped, isolated restore drill and R2/object-retention evidence. Avoid printing secrets in build logs. Preserve tenant data isolation and photo lifecycle.

**Acceptance / evidence:** signed-off privacy/terms, DPIA review, data map, restore report, measured backups with restore point, threat model and independent review. If deletion cannot pass, keep it fully disabled and verify that state.

#### W8 — Website and documentation implementation

**Framer project:** Positive Percy, ID **asmhhacjClrbL0pqawjy**, homepage and content present. Replace site branding with exact approved logo, palette, typography and appropriate mobile/OG/favicon assets; do not publish unreviewed pages. Site text must reflect actual app availability, no unsupported claims.

**Domain:** **positivepercy.app**; email contact **positivepercyapp@gmail.com** is an initial known contact, not proof of an incorporated legal controller. Verify DNS, HTTPS, page metadata, cookie/privacy disclosures, mobile layout, accessible forms and operational waitlist/email routing before public GTM release.

**Family Report PDF:** apply same source logo, font and palette with print contrast and legible mono fallback; preserve values and PDF data logic from merged PR #41.

**Docs:** pin brand source manifest, attribution, component usage and exact release-version links in repository; avoid stale style-board images as code dependencies.

**Acceptance / evidence:** screenshots of published staging site and PDF, verified waitlist form test submission and receipt, deployed-domain check, matched logos across app/site/report, no fake signups.

#### W9 — QA, independent review, release and rollback

**Minimum automated commands (in the integration branch, not only old draft branches):**
~~~bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run check:tokens
npm test
npm run test:a11y
npm run test:ui
~~~

Supplement with DB-backed migration tests, Playwright with axe, API auth/tenant tests, concurrency retry tests and **manual mobile Safari/iPhone** smoke testing. CI must run against final source assets and bundled code, not only the text approval branch.

**Visual matrix:** 390 / 834 / 1280 CSS px; 1 / 2 / 3 / 6 children; long names, 0/many rewards, empty/due/completed/archived goals, edit/create modals, dropdowns, picker 3/5/6 columns, keyboard and 200% font scaling. Verify 16/32/48/64px brand clarity. Capture screenshots of real React renders, not AI mockups.

**Data matrix:** old and new reward imagery, existing saved/redeemed rewards, concurrent parents, failed/retried requests, local timezone midnight/DST, JWT expiry, cross-family access attempts, exports and undo after wallet changes.

**Release gates (all required):**
- [ ] Assets imported and source manifest / attribution audited; Freepik and Streamline uses legally cleared.
- [ ] Fox 1A fidelity and unique points-star owner sign-off; no old logo/placeholder.
- [ ] React layouts explicitly visually approved by owner across target widths.
- [ ] Goals backend / UI and reward-picker functions pass all relevant unit, DB and E2E tests.
- [ ] No legacy rewards/history/points lost or altered; migrations rehearsed.
- [ ] Shared-carer Day 1 choice explicitly reconciled; server roles implemented if enabled.
- [ ] Legal, privacy and backup/restore readiness confirmed for launch scope.
- [ ] Independent code, privacy and security review done.
- [ ] Final release PR approved, deployment and rollback owners identified.
- [ ] Staging smoke check and production-change window approved.

**Deploy:** after gate sign-off only, merge reviewed integration in controlled order, execute additive migrations with backup/restore readiness and observability, deploy Railway service from authorised release commit, verify logs/metrics/HTTP paths, smoke-test authenticated points/goal/reward/export flows and revert **application code** if necessary while retaining additive compatible DB schema. Never roll back the database destructively or reset family balances.

### 5. Engineer ticket and acceptance ledger

| ID | Priority | Depends on | Deliverable | Exit evidence |
| --- | --- | --- | --- | --- |
| E01 | P0 | handover | unpack/check assets + provenance manifest | exact SHA + 150 files |
| E02 | P0 | E01 | Fox/logo/tokens/font components | visual diff + token/contrast tests |
| E03 | P0 | E01/E02 | 38 icon mappings + selected illustrations | source-ID snapshots + licence report |
| E04 | P0 | PR #45 | Goals migration + ledger server review | concurrency/timezone/tenant tests |
| E05 | P0 | E02/E03/E04/PR #46 | Today’s Goals UI in v2 | real browser E2E |
| E06 | P0 | E02/E03 | reward picker 71/84 + legacy data support | selector/search/migration tests |
| E07 | P0 | E02/E05/E06 | unified screen/dialog React conversion | complete visual matrix |
| E08 | P0 | E04/E07 | cross-route regression and accessibility | full passing suite |
| E09 | P0 | PR #42 | publishable legal/privacy package | independent review |
| E10 | P0 | backup service | restore evidence and security gates | restoration record |
| E11 | P1 conditional | E04/E08 | shared-carer server identity and invitation | adversarial permission tests |
| E12 | P1 | E02 | Framer website and Family Report brand match | page/PDF + form QA |
| E13 | P0 | E01-E12 as applicable | independent launch assessment | signed release checklist |
| E14 | P0 | E13 | authorised merged release + smoke/rollback | deployment evidence |

Ticket priority is a release dependency, not an assertion that every code item is incomplete. Engineers should inspect and reuse work already in PRs before rewriting it.

### 6. Engineering decision rules

- **No silent scope creep:** extra colours, extra icon sets, new child autonomy, uploads, new reward economy and unapproved animations are out.
- **No implied owner approval:** if the register says pending exact licence or artwork, treat it as a hold; bring only material unresolved decisions back for sign-off.
- **No destructive migration:** any additive schema changes must preserve old data and support safe repeat execution; tests use existing-family data.
- **No false release claims:** CI success, a design board or a zipped asset pack alone is not a production implementation.
- **No shared secrets in design tooling:** review services stay isolated from the production database and JWT secrets.
- **No public legal placeholders:** fill mandatory legal/controller details and obtain specialist review.
- **No licence assumptions:** artwork source and permission/attribution documents must be stored and auditable before public commercial use.

### 7. Handover completion criteria

This handover document is complete when: (a) GitHub contains the 150-file brand pack and original source assets, (b) the pack is losslessly reconstructible with verified SHA, (c) the above scope/test gates and ownership are unambiguous, and (d) a reviewer can find all existing PRs and source registers from these links.

This is **engineering readiness**, not **product launch readiness**. The immediate next implementation activity is **E01 + E02: extract the Git-tracked pack, map assets and replace legacy tokens/logo in a running React integration preview**. Do not spend another sprint making alternative design boards.

---
**Change control:** This revision is the locked engineering baseline as of 15 November 2026. An explicit owner-approved change to Day 1 scope or visual selections should update the register, this document, acceptance tests and release gate together. Preserve Git history and publish a concise change record.