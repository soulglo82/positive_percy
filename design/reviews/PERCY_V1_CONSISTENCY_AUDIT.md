# Positive Percy V1 — page and control consistency audit

**Status: DESIGN FOR OWNER REVIEW ONLY.** This is not owner approval, React implementation authorisation, permission to merge, or permission to deploy. Snapshot under review: `18769f7e9fab82bb6739d06c0bebea62951bd44a`, [complete HTML](https://github.com/soulglo82/positive_percy/blob/18769f7e9fab82bb6739d06c0bebea62951bd44a/design/previews/PERCY_V1_COMPLETE_REVIEW.html).

## Cross-page findings and required standard

| Finding | Defect in earlier review | Resolution in this design snapshot |
|---|---|---|
| Edit controls inconsistent | "Manage", "Configure", standalone edit, different widths/positions | Same right-aligned **Edit** button for every editable card/row on Children, Rewards, Settings and Manage Goals. Minimum 44px height, 76px minimum width, approved purple/white treatment. Other actions keep distinct names (Add, Download, Redeem, View). |
| Inconsistent buttons, spacing, alignment | Different action heights, card padding and button corners | Shared 44px+ control sizing, common border radius, focus ring, consistent row/header alignment and page gaps. |
| Form hierarchy dated and cluttered | Dense 1990s-style bare forms, tiny helper copy and scattered actions | Goal form, reward form/picker and Award Points now reuse clean Manage Goals visual pattern: header, grouped inputs, one primary Save/Award action, secondary Cancel, readable labels. |
| Rewards editing ambiguous | One edit action beneath the entire catalogue, hardcoded Movie Night | Edit action on each actual reward card; clicking opens the form with its selected name/cost in this design preview. |
| Children editing inconsistent | Weekly target, bigger goal and goal rows mixed different styles | Weekly target and bigger goal use same Edit treatment; each goal row has its own Edit, mirroring Manage Goals. |
| Home duplicated Rewards | "A little treat: Movie night" added a redundant reward card | Removed from Home; weekly reward catalogue remains on Children/Rewards. |
| Naming inconsistent | "Quick positive actions" vs "Quick Points" | Use **Quick Points** throughout the relevant Home/Settings copy. |
| Consumer-facing technical export | "Family data export (JSON)" and technical explanation added clutter | Removed *from Settings review UI only*. No server/API export removal is authorised. Family Report PDF retained. |
| Welcome artwork invisible | External map hotlink failed in local HTML | **Exact approved Freepik adventure map #3570506 is embedded byte-for-byte** as a data URI. Licence proof remains mandatory before public release. |
| Source icon substitution in picker | Old eight-icon mock selector or category-name fallback glyphs | **Full 71 original source-verified Phosphor Duotone SVGs** embedded across 12 approved category memberships; combined search deduplicates by asset ID. |
| Font availability | External CSS Google Fonts call | Five approved E02 Nunito/Poppins WOFF2 files embedded for offline review. |
| Brand drift | Generated fox and generic glyphs | Original Fox 1A as supplied in source-based prototype, no newly generated mascot. |

## Screen-by-screen disposition

- **Home:** Retain owner-selected **Focused Home**. Sample family streak **at top**. Selected-child strip next, Today's Goals ahead of weekly totals, dedicated larger-goal savings progress bar and Quick Points. Remove redundant Movie Night teaser and Recent Activity feed. Goal-completed state retains category icon plus separate Done mark. Streak number is illustrative, not a verified backend calculation.
- **Children:** Distinguish weekly earned, available points and saved towards bigger goals. Weekly target / bigger goal cards and each child goal have matching Edit actions. Multiple reward choices. Any pool transfer remains design-only until authenticated server contract and ledger tests exist.
- **Activity:** An auditable history, filters and dated entries; no duplicate feed on Home. Reward redemptions/undo must remain accurately signed and traceable; data are examples.
- **Rewards:** Source-verified Streamline catalogue artwork. Consistent per-card Edit button, visibly separate New Reward. The edit form takes the chosen sample reward's name and cost, not a default for every card.
- **Settings:** Four groups: Behaviours & Quick Points, Children & Goals, Family & Access, Reports & Privacy. Edit controls consistently aligned on editable rows. Delete only the customer-visible JSON tile—not data-export capabilities. Shared-carer permissions remain an implementation gate.
- **Manage Goals:** Clean row pattern used as the reference for the three rebuilt flows. Individual Edit per goal. Schedule and category are visible.
- **Create/Edit Goal:** Name, linked behaviour and recurring vs one-off schedule grouped; no silent resets to historic start dates; 44px controls.
- **Create/Edit Reward + icon picker:** Source-verified 71 approved unique icons / 84 placements; 12 categories; local names and synonyms; responsive container grid 3 columns <520, 5 columns 520–759, 6 columns >=760. Search de-duplicates across categories. Existing saved icons/images are not bulk replaced; new image uploads excluded at launch.
- **Award Points:** Child-first selection; approved behaviours; optional note, one clear parent-award button, no automatic bonus or real points awarded in preview.
- **Child View:** No independent child account and no unauthorised redemption; parent confirmation still required when implemented.
- **Welcome:** Adventure map as approved, not generic star. Design inclusion permitted; licensing before public use.
- **Onboarding:** Explicitly describes daily routines, positive behaviours anytime and bigger achievements, not only screen time.

## Verification and outstanding release gates

**Local source-equivalent preview checks:** Playwright Chromium visited five tabs plus seven supporting views at 390px, 834px and 1280px (36 page/viewport combinations). Browser reported no JS exceptions, no horizontal overflow. Edit button heights matched across screens. Tested editing a child's weekly target, a specific goal, a specific reward, an editable Settings item, 12 picker category tabs, and absence of the JSON tile. Result: tests passed.

The published source-matched GitHub revision additionally embeds the actual 71 original SVGs, exact Freepik PNG and five font files, which were separately checked by file IDs/source counts. **Browser screenshot parity of that precisely inlined GitHub commit and accessibility with real screen readers remain an engineering visual-QA gate.**

**Still blocked on owner/sign-off or implementation evidence:** final design approval; commercial licence proof for Freepik map and any applicable Streamline use; dedicated Percy points-star artwork; live consecutive-day streak rule; server-enforced weekly vs bigger-goal point allocations and permissions; shared-carer access; backup-restore proof; legal/privacy; full implementation/accessibility tests; separate release approval.

**Never treat "looks better" or this report as permission to implement, merge or deploy.**
