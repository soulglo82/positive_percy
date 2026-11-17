# E03 design: approved icons and illustrations

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-17 |
| Owner | Percy v2 engineering, on branch `claude/percy-v2-e03-icons-illustrations` (stacked on PR #51) |
| Status | Reviewed design; being built on the branch; not merged or deployed |
| Parent plan | `PERCY_V2_IMPLEMENTATION_PLAN.md` W2, ticket E03 |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-17 | First design, for peer review |
| 1.1 | 2026-11-17 | Peer review adopted (6 blocking, 7 non-blocking; see "Peer review record"). Inferred mappings moved from build into owner decisions. Reward-context icons removed from the runtime module. Placements narrowed to those with a real, single-instance home |

## 1. Contract

1. **Every glyph or illustration for an owner-approved context is the exact approved source file.** Nothing is generated, redrawn or recoloured.
   - Each approved asset traces to:
     - its register entry (`design/stage1/APPROVAL_REGISTER.json` v1.9);
     - its checked-in file under `design/assets/`;
     - its pinned upstream URL (Phosphor core `2b75f3a`, Streamline vectors `52d750c`).
   - Upstream equality was checked on 2026-11-17 and is committed in `design/brand/UPSTREAM_VERIFICATION.json`.
2. **Stored behaviour icon keys round-trip unchanged.**
   - New keys are additive.
   - No stored key is rewritten, no default seed changes, and no legacy key is re-pointed.
   - An unknown key draws the neutral fallback and is kept.

Out of contract:
- Glyphs with no approved context. These stay Lucide, because approvals cannot be inferred.
- The 71-icon picker, which is E06.

## 2. What E03 builds

### 2.1 Navigation (5), `src/Layout.jsx` only

| Context | Approved asset | Replaces |
| --- | --- | --- |
| Home | house-line:duotone | Lucide `Home` |
| Progress (the "Child" tab) | users:duotone | Lucide `User` |
| Activity | chart-line-up:duotone | Lucide `Activity` |
| Rewards | gift:duotone | Lucide `Gift` |
| Settings | gear:duotone | Lucide `Settings` |

Page headings that reuse these Lucide names are a different meaning and are **not** changed:
- `Settings` on the Family settings title;
- `Activity` on the Activity title;
- `Home` on the "Family name" section.

### 2.2 Controls: one row per call site

| Context | Asset | Call sites (all read in this session) |
| --- | --- | --- |
| Edit | pencil:duotone | All 7 Lucide `Pencil`: EditRewardModal:76, RewardCard:48, BehaviorCategoryManager:369, EditChildModal:102, ChildCard:57, ManageGoalsDialog:235, ParentProfile:157. Each is an edit action |
| Add | plus-circle:duotone | All 7 Lucide `Plus`: RewardCard:102 ("Add to stack"), BehaviorCategoryManager:393, ChildCard:115 (add points), ManageGoalsDialog:139, FamilyLogin:115 (create family), Rewards:116 (new reward). Each starts an add or create action |
| Archive | archive:duotone | ManageGoalsDialog:239 |
| Undo | arrow-counter-clockwise:duotone | `undo` reserved history row in `categoryIcons.js` (Lucide `RotateCcw`) |
| Help | info:duotone | ParentProfile:278 "Need help rewarding behaviour? View parenting tips" (Lucide `Lightbulb`). The AddRewardModal "ideas" toggle is not Help and stays |
| Schedule | calendar-dots:duotone | ManageGoalsDialog:162, the `Schedule` legend (decorative, before the text) |
| Complete | check-circle:duotone | TodaysGoalsPanel:138, the **Done mark only**, next to the visible "Done" text |
| Goals | target:duotone | TodaysGoalsPanel:85 "Manage goals" button (Lucide `Settings2`) |
| Pause | pause-circle:duotone | No pause control exists. Registered for E05 |
| Child switch | user-switch:duotone | The "Choose a child" group (TodaysGoalsPanel:88) has no visible label to carry an icon. Adding one is a layout change, which belongs to E05/E07. Registered |

Goals-interaction sources:
- **repeat:duotone** replaces `Repeat2` at ManageGoalsDialog:168. That is the recurring choice.
- **sparkle:duotone** is a small decorative accent next to the Today's Goals heading.

**Deliberately not changed: TodaysGoalsPanel:127.** Today, a completed goal swaps its tile icon to a check. The register's `completed_goal` rule forbids that ("never replace [the category icon] with the done checkmark"). The fix needs the goal API to return the category `icon_key`, and `todaysGoals.js` does not return it. That is E05 behaviour work. The line keeps its Lucide glyphs and is listed in the guard's exemption with this reason, so E05 cannot miss it.

### 2.3 Behaviours: new keys and picker

- **New keys.** The 11 approved keys `kindness learning helping chores movement reading routines self-care community creativity sleep` are appended, in the same order, to both `server/iconKeys.js` and `src/lib/categoryIcons.js`. Parity is kept by the existing test, which is updated to expect 27 keys. Each new key draws its approved Phosphor asset.
- **Legacy keys.** All 16 legacy keys draw exactly what they draw today. There is no swap and no reseed: review B6 and N1 showed that both are inference and that they create duplicate icons.
- **Picker.** `PICKER_KEYS` holds the 11 approved keys. The edit control cycles through `[current key if it is not approved] + PICKER_KEYS`, so a legacy key can always be returned to. The create form keeps its `'star'` default, shown first in the same way.
  - Whether new categories should default to an approved key is an owner decision (section 9).
  - `ICON_KEYS` stays the full list used for parity and validation.

### 2.4 Illustrations

These are served as `<img alt="" aria-hidden>` from `public/illustrations/`. Each file is a byte copy, recorded in `design/brand/RUNTIME_ASSETS.json`.

| Moment | Asset | Placement | Why this place |
| --- | --- | --- | --- |
| Home welcome | stickies star | HeroCard no-children state, beside the heading. The Fox badge stays | It appears once, only before any child exists |
| First-run onboarding | kameleon robot | OnboardingTips first step, **only when opened from the dashboard first run** (new `firstRun` prop). Settings › tips does not show it | It appears once |
| Reward creation form | stickies gift-reciept | AddRewardModal title, **replacing** the Lucide `Gift` glyph (no stacking) | It appears once |

## 3. What E03 does not build, and why

| Item | Reason | Goes to |
| --- | --- | --- |
| 12 reward-context icons (11 Streamline + book-bookmark) | No current UI shows them. Template titles in `reward-templates.js` don't match the context names. Rendering them would change reward data or display (W5). The Streamline fills also fail `check-tokens`. **Changes the E03 ledger line "38 mappings"**, so it is flagged as an owner/plan decision | Owner decision 5, then E06 |
| Reward redeemed (party poppers) | No success state exists. The dialog closes before the toast so Undo can be tapped (SpendRewardsModal:39–48). There is also a second path through stacked redemption. A success view would change the redemption and Undo flow | Owner decision 6 |
| Progress milestone (reward sticker) | It would show on several child cards at once, which breaks stage-1 rule 5 ("one spot art at a time") | Owner decision 6 |
| Medal, chalkboard elements | Artwork is selected, but no screen is named | Owner decision 6 / E07 |
| Small sticker and celebration burst elements | Same files as Home welcome and Reward redeemed; covered by those rows | (none) |
| Goals empty state (Freepik #3570506) | Licence pending. The empty state stays text-only, with no substitute | Licence gate |
| Completed-goal icon rule, Done styling, 44 px target with a 24 px glyph | Goal UI behaviour | E05 |

## 4. Rendering

- **Generated module.** `scripts/brand/build-approved-icons.mjs` writes `src/components/icons/approvedIcons.js` from the register.
  - It covers nav, controls, behaviours and the 3 goals sources: 28 Phosphor ids. Reward contexts are excluded, per section 3.
  - Each entry holds `viewBox`, the root `fill` (Phosphor draws with `currentColor`), `inner` (verbatim markup), `source`, `upstream`, `licence` and `sha256`.
  - The module starts with a `/*! @license */` Phosphor MIT notice, which esbuild keeps.
- **`<PercyIcon id className>`** renders `<svg viewBox fill aria-hidden focusable="false">` with the inner markup.
  - The markup is a constant generated from checked-in, scanned, upstream-verified files; nothing comes from users or the network.
  - Every current call site already labels its button or sits beside text.
- **`approvedIcon(id)`** returns a component with the Lucide calling shape (`className`, `aria-hidden`), so `categoryIcons.js` maps can hold both kinds.

## 5. Licences and attribution

Checked in as evidence under `design/brand/licenses/`:
- `phosphor-MIT.txt`, fetched from core `2b75f3a`;
- `streamline-vectors-README@52d750c.md`, the upstream licence statement: "CC BY 4.0 … give appropriate credit and provide a link to the Streamline website";
- `CC-BY-4.0.txt`, from the SPDX license list. creativecommons.org is blocked by this environment's network proxy; sha256 is recorded.

Served under `public/licenses/`:
- the two licence texts;
- `CREDITS.txt` (draft).

These are reachable without logging in. The Settings page also gets a "Credits and licences" link row (draft text).

**Owner decision 3:** the exact credits wording is customer-facing, so it needs approval.

## 6. Guards

| Guard | Fails on | Doesn't cover |
| --- | --- | --- |
| Drift: committed module == `build()` | Hand edit, or a register change without regenerating | Wrong register content (owner-owned) |
| Each entry's `sha256` == its source file's hash == the `UPSTREAM_VERIFICATION.json` upstream hash for that id | One byte changed in `design/assets/...` | Re-running the upstream fetch in CI (no network there; the record is the anchor) |
| Active-content scan on `inner`, plus **no `url(` and no `id=`** in inline entries (duplicate inline ids break) | `<script>`, external href, gradient refs | (none listed) |
| Every `PercyIcon id="..."` / `approvedIcon('...')` literal exists; a non-literal id fails the scan | A typo in an id; `id={x}` | (none listed) |
| Per-file Lucide bans: listed names can't be imported in the mapped files (Layout: Home, User, Activity, Gift, Settings; Pencil and Plus anywhere in `src/`; ManageGoalsDialog: Archive, Repeat2; ParentProfile: Lightbulb; TodaysGoalsPanel: Settings2). Common aliases also banned: Edit, Edit2, Edit3, PlusCircle, CirclePlus, SquarePen | Re-importing a retired glyph | The TodaysGoalsPanel:127 exemption is explicit (`Check`, `CheckCircle2`, `ClipboardCheck` allowed there until E05) |
| Key parity (existing) + 27 keys + order | Key added on one side only | (none listed) |
| Legacy behaviour: every legacy key draws exactly its previous Lucide component; unknown keys draw `Circle` | A swap sneaking in | (none listed) |
| Picker round trip: cycling from a legacy key comes back to it; cycling from an approved key never yields a legacy key | Legacy key lost after one tap | UI-level (unit test on the pure cycle function) |
| Illustrations: each `/illustrations/x.svg` in `src/` is a register `visuals` asset with status `selected`; every `<img src="/illustrations/...">` has `alt=""` | Using the medal, or a pending-licence asset; missing `alt` | (none listed) |
| Freepik exclusion: no `public/` file hashes to the Freepik PNG; `treasure-map` appears nowhere in `src/` | Copying the map in | A re-encoded copy; the owner check is the backstop |
| Manifest chain (E01 test, amended): sources may sit in the library, `design/brand/fonts`, `design/brand/licenses` or `design/assets`. A `design/assets` source must have its upstream hash in `UPSTREAM_VERIFICATION.json` | A stray public file; an unverified `design/assets` source | (none listed) |

## 7. Edge cases

| Input | Expected |
| --- | --- |
| Category `heart`, `hand-heart`, `brush` (legacy) | Unchanged Lucide glyphs. Picker cycle starts at the current key and can return to it |
| Unknown key `zzz` | Circle; key preserved; picker treats it as current |
| A family picks a new key, then the code is reverted | The older server rejects that key on *edit* with a 422 and draws a circle. No data loss. To keep this clean, the server key list ships in its own commit, which must not be reverted alone (N3) |
| `todaysGoals` completed tile | Unchanged until E05 (see section 2.2) |
| Settings tips opened later | No robot (no `firstRun`) |
| Approved icon in a white-on-purple button | `currentColor` makes it white |

## 8. Test plan

- New `src/test/approvedIcons.test.js`, covering section 6.
- Updated `categoryIcons.test.js` (27 keys and the legacy-identity rule).
- Server tests unchanged: the seed is unchanged.
- Amended `brandAssets.test.js` manifest chain.
- Full `npm test` with a database, `check:tokens`, `lint`, `build`, and Playwright with axe.
- Before and after screenshots: nav, Settings › behaviours (with picker), Manage goals, Today's goals, Add reward, and the first-run tips.
- **Not covered:** owner agreement on each mapping. The screenshots and section 2.2 are the evidence for that.

## 9. Owner decisions raised (PR blockers; none built as assumptions)

1. **Legacy behaviour key mapping.** Proposal: heart→kindness, brush→chores, book-open→reading, palette→creativity, footprints→movement, music→creativity, check→routines, hand-heart/handshake/brain/bed→Kindness/Helping/Learning/Sleep art. `star`, `shield`, `mountain`, `sparkles` and `circle` stay Lucide. Note the clash: default "Caring" is `hand-heart`, so mapping both Kindness and Caring to hand-heart would duplicate the icon.
2. **Defaults.** Should new families' default categories, and new-category creation, use approved keys? (Today: `heart`, `handshake`, `shield`, `mountain`, `hand-heart`, `brush`, `book-open`, `sparkles`, and `star` for new categories.)
3. **Credits wording** (draft): "Icons by Phosphor Icons (MIT licence). Illustrations by Streamline, https://streamlinehq.com, licensed CC BY 4.0, used unchanged. Full licence texts: /licenses/".
4. **Gift and UserPlus.** Should Lucide `Gift` (Spend, reward dialogs) use the approved Rewards gift, and Lucide `UserPlus` (add child) use the approved Add icon? Not built.
5. **The 12 reward-context icons.** E03 delivers 26 of the 38 contexts' mappings plus 3 goals sources. The 12 reward contexts move to E06, which changes the plan ledger line.
6. **Placements still needed:** Reward redeemed, Progress milestone, medal, chalkboard.

Still excluded: the Freepik map (licence) and PointsStar (unapproved).

## 10. Rollout and reversal

- **Rollout:** no deploy. The work goes on a stacked draft PR into PR #51's branch. There is no migration and no data rewrite, and no seed changes.
- **Reversal:** revert the UI commit. The server key-list commit stays (section 7).

## Peer review record

The fresh-context review of v1.0 (2026-11-17) raised 6 blocking and 7 non-blocking findings. I checked the code for each before acting (TodaysGoalsPanel:85–138, SpendRewardsModal:36–50, ManageGoalsDialog:158–170, check-tokens on the module, and all Pencil, Plus and Lightbulb sites).

| # | Finding | Disposition |
| --- | --- | --- |
| B1 | Complete mapped onto the forbidden category-icon swap at :127 | Adopted: check-circle only on the Done mark at :138. :127 is exempted and handed to E05 |
| B2 | Ban list hits headings the design never mapped | Adopted: bans are per file and per name; the page headings are explicitly unchanged |
| B3 | check-tokens fails on Streamline hex values in the module | Adopted: reward contexts removed from the runtime module (section 3, decision 5) |
| B4 | Reward redeemed targets a state that doesn't exist | Adopted: deferred to the owner (decision 6) |
| B5 | The E01 manifest test would reject `design/assets` and licence sources | Adopted: licence sources checked in; the test is amended with an upstream-record chain |
| B6 | Kindness reseed plus hand-heart swap duplicates icons | Adopted: neither is built; both go to decisions 1–2 |
| N1 | The 4-key swap is inference | Adopted: dropped, into decision 1 |
| N2 | Picker cycle loses legacy keys; `'star'` default | Adopted: cycle includes the current key; the default goes to decision 2 |
| N3 | Server tests, revert risk, no import route | Adopted: seeds untouched; key list in its own commit; the import row is removed |
| N4 | Schedule legend, Child switch, UserPlus, Goals placement | Schedule and Goals adopted. Child switch answered (no label to carry it). UserPlus goes to decision 4 |
| N5 | Several milestone stickers at once; robot in Settings; double gift | Adopted: milestone deferred; robot behind `firstRun`; gift-reciept replaces the glyph |
| N6 | Deferrals are unilateral; Gift built despite §9 | Adopted: reward contexts become decision 5; Gift is not built |
| N7 | CC BY credit form, MIT in bundle, missing guards | Adopted: Streamline README credit form, public `/licenses`, `/*! @license */`, and the extra guards in section 6 |

## Verification record (2026-11-17, this branch)

| Check | Result |
| --- | --- |
| Upstream fetch of all 47 register assets (pinned URLs) | 47 of 47 equal to the checked-in files. Control: a regular and a duotone gift hash differently. Recorded in `design/brand/UPSTREAM_VERIFICATION.json` |
| Generated module | 28 Phosphor ids. `check-tokens` OK on the file. Drift test green |
| Mutations, each restored afterwards: Lucide `Pencil` re-imported in Rewards; module viewBox hand-edited; id typo `pencel` in ChildCard; one byte added to `gear.svg`; Freepik PNG copied into `public/` | Each made its own guard fail (drift, upstream equality, id existence, per-file ban, Freepik exclusion) |
| `npx vitest run` with `TEST_DATABASE_URL` (local Postgres 16) | 27 files, 636 tests passed |
| `npm run check:tokens` / `npm run lint` / `npm run build` | Tokens OK (74 files) / 0 errors, 5 warnings (baseline) / built; `dist/` holds `illustrations/` and `licenses/` |
| `npx playwright test` (4 viewports, axe) | 31 passed, 9 skipped (single-viewport specs) |
| `/licenses/CREDITS.txt` served by the app without login | 200 with the credits text. Before E03 the same path returned the app's fallback page |
| Screenshots | `docs/engineering/evidence/e03/`, before (PR #51 head `ef21435`) and after, at 390 px |
