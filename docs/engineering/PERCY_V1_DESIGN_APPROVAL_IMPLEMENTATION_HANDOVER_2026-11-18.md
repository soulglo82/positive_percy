# Positive Percy — V1 Owner Design Approval & Implementation Handover
**Approval date:** 18 November 2026 (Asia/Singapore)
**Owner statement:** “ok this looks good for now as V1 release.”
**Decision:** V1 design direction is approved for engineering implementation. **This is NOT approval of a production deployment, licensing exception, database migration, new permissions, or release without tested readiness.**

## Approved immutable design baseline
- **HTML review:** [PERCY_V1_COMPLETE_REVIEW.html](https://github.com/soulglo82/positive_percy/blob/18769f7e9fab82bb6739d06c0bebea62951bd44a/design/previews/PERCY_V1_COMPLETE_REVIEW.html).
- **Exact source commit:** `18769f7e9fab82bb6739d06c0bebea62951bd44a` — do **not** implement off a movable branch pointer.
- **HTML Git blob SHA:** `9de1df2c172010830f04f0d5a7c34d818b5d9006` (verified).
- **Source assets:** approved `design/stage1/APPROVAL_REGISTER.json`, `design/assets/phosphor/duotone/`, `design/assets/streamline/`, 150-file brand archive/library and exact Fox 1A under `public/brand/`; use original asset IDs with provenance.
- **Approved map for visual review:** exact original `treasure-map_3570506.png` embedded in the HTML from GitHub. **Commercial licence/attribution proof still required before public deployment**.
- The reviewed HTML is an **illustrative design**, not production code; example child names, balances, dates and streaks are **sample data**.

## Scope locked for V1 page implementation
1. **Home:** existing focused layout as shown in immutable approved HTML, **family streak strip at the top**, selected-child family strip, Today's Goals **before** weekly total and available-now summary, a **separate** larger-goal savings progress section, **Quick Points** (not Quick positive actions), no Recent Activity and no redundant Home movie-night teaser. Preserve meaningful parent/child copy and clean responsive single-line numeric labels.
2. **Children:** child-specific weekly target progress and larger-goal progress; consistent visible **Edit** actions for every editable target/goal row; clearly distinguish weekly points, available-now points, saved/allocated points, spent points and the reward cost; no silent balance transfer or auto-redemption.
3. **Activity:** complete audit/history with filter controls; retain legible event labels, parent-authorised corrections and traceable Undo; not redundant with Children.
4. **Rewards:** per-reward Edit buttons, parent-managed child visibility and assignment, multi-reward choices and exact selected original artwork. **71 unique approved Phosphor Duotone icons** in **12** groups (**84** category placements), local name/synonym search and dedup. Container grid 3 columns <520px, 5 at 520–759px, 6 at >=760px; existing rewards/icons/images preserved without destructive updates; no new uploads at V1.
5. **Settings:** consistently styled Edit actions; group children, goal scheduling, categories/Quick Points, family and access, downloadable **Family Report PDF**; the **technical Family data export (JSON) tile is omitted from the V1 Settings UI** as approved. **Do not delete the underlying data-export endpoint or compromise data portability**; retain legal/privacy compliance mechanisms.
6. **Supporting screens:** Welcome/Goals-empty with exact treasure map, parent-run Today's Goals Manage/Create/Edit (goal icon, recurrence, explicit Done, 44px touch), Add/Edit Reward + full icon picker, Award Points, parent-confirmed Redeem, child view without standalone child credentials, and onboarding covering everyday goals, positive behaviours anytime, and bigger achievements. Forms follow the clean **Manage Goals** pattern, not legacy inconsistent grids.

## Design and interaction invariants
- **Fox 1A** is locked: face, right/left tail direction/markings, proportions, star and wordmark from verified source. Do not use any generative mascot, mismatched preview artwork or invented new pose.
- Colours: purple `#4B1D8C`, orange `#FF6A00`, yellow `#FFC938`, cream `#FFF6E8`, ink `#271737`, lilac border `#E5DCEA`; font Nunito (headings) and Poppins (UI). Maintain functional earned-green, semantic tints, and distinct child identity colour tokens. Meet contrast requirements.
- **Edit** actions have a consistent right-aligned row/card treatment and minimum 44px targets across editable screens. Meaningfully different actions (Complete, Add, Redeem, Download, Undo) use their own named patterns. Preserve keyboard/focus/screen reader behaviours.
- Model streak from consecutive family-local days, not mere `activeDays`, and avoid punitive resets/deductions; existing display is sample until backed by verified API tests.
- Weekly and larger-goal **points pools / allocation transfers** must be server-backed with ledger and permissions safeguards; do not invent balances/ledger updates from the HTML prototype.
- Parent-confirmed spending only. No independent child accounts. Every point mutation must be duplicate-safe, server-authorised and auditable. Keep current families, balances, reward records, history, photos and reports.
- All V1 scope exceptions must be recorded and owner-reviewed before substituting a different behaviour or visual.

## Engineering execution plan (after this design approval)
**Step 0: establish integration branch & baseline.** Reconcile, test and integrate draft PRs **#45–#54** by dependency rather than directly merging any design prototype; check existing live branch/deployment first. E01/02 brand+fonts #51, E03 exact assets #52, E04 goals backend #53, E05 goals UI #54; older #46 layout is superseded by the approved review.

**Step 1: production React UI and components.** Convert approved HTML pages/components into actual React navigation/flows, responsive layouts, shared Edit/Button/Field/Row/Cards with automated screenshot comparisons. Add full 71-icon picker as E06 and page redesign E07. Keep brand source assets versioned in GitHub.

**Step 2: contracts & safeguards.** Verify goals point-value, family-local date/idempotency, consecutive-day streak, split-weekly-vs-saved ledger/accounting, permission checks and explicit confirmation for redemption. If a feature does not have safe server backing, raise a blocking issue rather than quietly simulate live behaviour.

**Step 3: prove QA.** Test real API flows and data migration with existing-family fixtures, duplicates/Undo/corrections, rewards/saving consistency, account security, cross-device navigation, a11y (minimum 44px, keyboard, contrast, reduced-motion), responsive screenshots at **390/834/1280px**, and restore from backup. Compare visual output with exact approved HTML at each critical state.

**Step 4: launch gates.** Check Freepik map and Streamline licences/attribution, approved points-star artwork or explicitly recorded acceptable V1 fallback, child privacy/legal controller placeholders resolved for launch, storage/retention/erasure decisions, role authorization, actual Railway backups+restore and Framer website consistency. Get a **separate explicit owner production-release decision** after QA evidence. Merge and deploy only then.

## Implementation handover format
Engineer must provide:
- PR stack and source SHA list with explanation of integrations/deletions;
- screenshot comparison for all five screens and supporting flows;
- data/ledger/streak/reward/permissions test evidence;
- a gated checklist with status **done / blocked / owner decision required**;
- deployment and rollback procedure, with working DB restore evidence;
- clear “ready for release” conclusion only when all mandatory gates pass.

**Approval interpretation:** The owner is accepting the **look and feel for V1 implementation**, not asserting every mockup's example feature already exists in the app, and not waiving legal, QA, licensing, security or release checks. Do not reopen visual choices without a concrete implementation/accessibility defect or further owner request.
