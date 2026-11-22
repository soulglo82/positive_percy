# E03 design: approved icons and illustrations

| Field | Value |
| --- | --- |
| Version | 1.2 |
| Issued | 2026-11-17 |
| Owner | Percy v2 engineering, on branch `claude/percy-v2-e03-icons-illustrations` (stacked on PR #51) |
| Status | Reviewed design; being built on the branch; not merged or deployed |
| Parent plan | `PERCY_V2_IMPLEMENTATION_PLAN.md` W2, ticket E03 |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.2 | 2026-11-22 | §11: owner decision on the legacy behaviour icons (decision 1) and on the default Quick Points (decision 2, in part). Legacy keys are now drawn in the approved icon family; no stored key changes |
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

## 11. Legacy behaviour icons in one style; default Quick Points (owner decision, 22 November) (v1.2)

**Owner's findings (visual review of the release candidate).** "The logos for kindness and bravery also look out of place and not in the same style as the others." After seeing the options: "icon update is good" (K1 heart for Kindness, B1 shield with star for Bravery, the four starting behaviours restyled). And: "kindness and caring are almost the same thing, choose another option as the default quick points."

**Prior rulings found.** §1 contract 2 ("no stored key is rewritten, no default seed changes, and no legacy key is re-pointed") and §9 decisions 1 and 2, which left the mapping and the defaults to the owner. Review finding B6: mapping Kindness and Caring to the same hand-and-heart drawing would duplicate it. The owner has now decided; this section replaces the "no legacy key is re-pointed" and "no default seed changes" parts of contract 2. **"No stored key is rewritten" stands.**

### 11.1 Contract

1. **Every behaviour icon is drawn in the one icon family the app uses (Phosphor Duotone).** Each of the 16 legacy keys draws the Phosphor Duotone glyph of the same subject. An unknown key draws the Phosphor circle.
2. **Nothing stored changes.** The key list (27 keys, app and server) is unchanged; no migration; a family's behaviours keep their keys and their meaning. Only the drawing changes, for existing families too.
3. **Every glyph is the exact pinned upstream file** (Phosphor core `2b75f3a`), recorded in the register and in `UPSTREAM_VERIFICATION.json`, as §1 contract 1 requires. Nothing is drawn or generated.
4. **New families' default Quick Points** are Kindness, Helpfulness, Bravery and Resilience. Caring stays a default behaviour but is no longer a default Quick Point. Existing families' own choices are not touched.

### 11.2 The mapping

| Legacy key | Used by default for | Phosphor Duotone glyph | Basis |
| --- | --- | --- | --- |
| `heart` | Kindness | `heart` | Owner's choice K1 |
| `shield` | Bravery | `shield-star` | Owner's choice B1 |
| `handshake` | Helpfulness | `handshake` | Owner: the recommended set. Already approved for Helping |
| `hand-heart` | Caring | `hand-heart` | Owner: the recommended set. Already approved art |
| `mountain` | Resilience | `mountains` | Same subject |
| `brush` | Chores | `broom` | Same subject. The key was seeded with the broom emoji for Chores, and the broom is the art already approved for Chores; the paint brush is Creativity's (design review) |
| `book-open` | Homework | `book-open` | Same subject |
| `sparkles` | Adventurous | `star-four` | Same subject. Not `sparkle`: that is the Today's Goals header accent (design review) |
| `star` | New behaviours | `star` | Same subject |
| `palette`, `brain`, `bed` | – | `palette`, `brain`, `bed` | Same subject |
| `footprints` | – | `footprints` | Same subject |
| `music` | – | `music-notes` | Same subject |
| `check` | – | `check` | Same subject. Not `check-circle`: that is the "Done" mark on a completed goal and keeps that one meaning (design review) |
| `circle` and any unknown key | – | `circle` | Same subject |

The owner chose four of these by name. The other twelve follow the owner's direction that behaviour icons share one style: restyling only four would leave Resilience, Chores, Homework and Adventurous in the old style beside them in "Give Percy Points". They are shown to the owner on the real screens for sign-off (G2).

**One drawing, one meaning.** No two legacy keys draw the same glyph, and none draws a navigation, control or goal mark (guarded).

**Look-alikes between a legacy key and an approved key.** Five legacy keys draw the same glyph as an approved key: `hand-heart` and `kindness`, `handshake` and `helping`, `brain` and `learning`, `bed` and `sleep`, `brush` and `chores`. When a behaviour stores one of those legacy keys, the picker leaves its twin out, so every tap on "Change icon" changes the drawing (design review B3: otherwise the first tap on Caring's icon appeared to do nothing). A parent can still give two behaviours the same icon by choice, for example Kindness changed to the hand-and-heart that Caring starts with; the picker has always allowed that.

### 11.3 Build

- **Register** (`design/stage1/APPROVAL_REGISTER.json`): a new group `decisions.behaviors_legacy`, one entry per legacy key, each with its `basis` (`owner_choice_2026-11-22` or `same_subject_restyle_2026-11-22`). The 11 entries of `decisions.behaviors` are untouched.
- **Sources:** `star`, `shield-star`, `footprints`, `circle`, `check` and `star-four` are added to `design/assets/phosphor/duotone/` from the pinned commit; `heart` and `book-open` are already there. All eight get a record in `UPSTREAM_VERIFICATION.json` (fetched on 22 November and compared by SHA-256).
- **Generator** (`scripts/brand/build-approved-icons.mjs`): reads the new group into a `legacy` context. A missing or unrecognised `basis` stops the build.
- **App** (`src/lib/categoryIcons.js`): the 16 legacy keys map to their approved icons from the `legacy` context; the fallback is the Phosphor circle. The Lucide behaviour imports go, and may not come back (the retired-glyph guard). `pickerChoices` leaves out a stored key's twin. Screen-reader labels follow the drawings ("Shield with star", "Broom", "Mountains", "Sparkle").
- **Every drawing of a behaviour goes through `CategoryIcon`** (the tiles, Today's Goals, Manage goals, the behaviour settings). The family report draws no icons, and Activity rows use fixed icons by kind, so neither changes.
- **Browser tests:** the long-name tile test swaps Resilience, not Caring, out of Quick Points (Caring is no longer one, and a fifth would be refused).
- **History rows:** `Starting points` (flag) and `Balance correction` (scale) keep their Lucide glyphs; they are not behaviours and have no approved context.
- **Default Quick Points** (`server/routes.js`, family creation): `is_quick_action` true for Resilience and false for Caring. `server/db.js` seeds no Quick Point flags and is unchanged.

### 11.4 Edge cases (input → expected)

| Input | Expected |
| --- | --- |
| A family whose behaviour has key `heart` | The Phosphor heart; the stored key is still `heart` after any edit |
| A key not in the list (`zzz`, an old emoji, `constructor`) | The Phosphor circle |
| Editing a behaviour with a legacy key | The picker still offers the stored key first, then the 11 approved keys (unchanged) |
| A family created before this change | Its Quick Points are whatever it had. Nothing is changed for it |
| A new family | Quick Points: Kindness, Helpfulness, Bravery, Resilience; eight default behaviours as before |
| The family report (PDF) and Activity rows | Unchanged: the report draws no behaviour icons and Activity uses fixed icons by kind |
| A behaviour with key `check` used for a goal | The plain tick in the goal's row; the "Done" mark stays the circled tick |
| Caring (stored `hand-heart`), "Change icon" tapped once | The next icon is a different drawing (not `kindness`, its twin) |
| A family left with no Quick Points (pre-existing: the creation seed is not one transaction) | Unchanged by this design; the parent chooses them in Settings |

### 11.5 Guards

- Each legacy key draws an approved icon with the id in the table (a swap back to Lucide, or a wrong glyph, fails).
- The generated module equals a fresh build; every icon equals its source file, which equals the recorded upstream hash (existing guards, now covering the six new records).
- The generator refuses an entry without a recognised basis (counter-example in the test).
- No two legacy keys share a glyph; none uses a navigation, control or goal glyph (the test first proves the "Done" mark is in the reserved set).
- For every legacy key, each step round the picker changes the drawing and the cycle returns to the stored key.
- A new family has exactly four Quick Points and they are the four named; Caring exists and is not one.
- Not covered by a test: whether the glyphs look right together. That is the owner's sign-off.

### 11.6 Rollout and reversal

One commit on the release candidate. No data or migration. Reverting it restores the Lucide drawings and the old default; no stored value depends on it. Families created in between keep the Quick Points they were given.

### 11.7 Design review (independent, before the build finished)

Three blocking findings, all adopted: the browser test fixture swapped Caring, which would now be a fifth Quick Point (it swaps Resilience); `check` drew the "Done" mark (it draws the plain tick); a stored key's look-alike made "Change icon" appear to do nothing (the twin is left out). Also adopted: the broom for `brush`; the four-point star for `sparkles`; the corrected statement about the family report and Activity; labels; a guard that one drawing has one meaning.

**Superseded by this section:** §1 contract 2 ("no default seed changes, and no legacy key is re-pointed"), §2.3's statement that legacy keys stay Lucide, the "Legacy behaviour" row of §6, the first row of §7, and decisions 1 and 2 of §9.

**For the owner's attention.**
- Existing families, including the owner's, keep the Quick Points they have: Caring stays a Quick Point there until changed in Settings › Quick Points. Only new families get the new default.
- Twelve of the sixteen glyphs are engineering's same-subject mapping, not individual owner picks. The ones a new family sees are Resilience (mountains), Chores (broom), Homework (open book) and Adventurous (four-point star).

