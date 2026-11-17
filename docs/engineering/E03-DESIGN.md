# E03 design: approved icons and illustrations

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-17 |
| Owner | Percy v2 engineering, on branch `claude/percy-v2-e03-icons-illustrations` (stacked on PR #51) |
| Status | Design for peer review; nothing built yet |
| Parent plan | `PERCY_V2_IMPLEMENTATION_PLAN.md`, W2 and ticket E03 |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-17 | First design, for peer review |

## 1. Contract

There are two contracts.

1. Every glyph or illustration that represents an owner-approved context is drawn from the exact approved source file. Nothing is generated, redrawn or recoloured. Each approved asset must trace to:
   - its register entry, in `design/stage1/APPROVAL_REGISTER.json` v1.9;
   - its checked-in file under `design/assets/`;
   - the pinned upstream URL in that entry. Phosphor sources are pinned at core commit `2b75f3a`; Streamline sources at streamline-vectors commit `52d750c`.
2. Behaviour icon keys stored on the server (`behavior_categories.icon_key`) still round-trip unchanged.
   - Adding new approved keys is additive.
   - No stored key is rewritten.
   - An unknown key renders a neutral fallback and is never deleted.

Out of contract:
- Glyphs for which no owner-approved context exists. These are chevrons, close, trash, copy, eye, download and similar. They stay as Lucide, because "do not infer approvals for unselected items".
- The 71-icon reward picker, which is E06.

## 2. Inventory and where each asset lands

### 2.1 Navigation (5): `src/Layout.jsx`, desktop bar and mobile tab bar

| Context | Approved asset | Replaces |
| --- | --- | --- |
| Home | phosphor:house-line:duotone | Lucide `Home` |
| Progress (the "Child" tab) | phosphor:users:duotone | Lucide `User` |
| Activity | phosphor:chart-line-up:duotone | Lucide `Activity` |
| Rewards | phosphor:gift:duotone | Lucide `Gift` |
| Settings | phosphor:gear:duotone | Lucide `Settings` |

Tab labels are unchanged. Whether "Child" should become "Progress" is a copy decision for E07 and is not touched here.

### 2.2 Controls (10)

Each row lists the call sites this design maps to the context. A call site is mapped only where the control's meaning **is** that context.

| Context | Asset | Call sites |
| --- | --- | --- |
| Complete | check-circle:duotone | `TodaysGoalsPanel` completion control and done mark (Lucide `Check`/`CheckCircle2` there only) |
| Goals | target:duotone | `TodaysGoalsPanel` heading icon (`ClipboardCheck`) |
| Add | plus-circle:duotone | Every Lucide `Plus` that starts an "add / new" action: `Rewards`, `ChildCard` (add points), `RewardCard`, `BehaviorCategoryManager`, `ManageGoalsDialog`, `FamilyLogin` (create family) |
| Edit | pencil:duotone | Every Lucide `Pencil` (7 sites; all are edit actions) |
| Schedule | calendar-dots:duotone | `ManageGoalsDialog` schedule field (none exists yet; registered for E05) |
| Pause | pause-circle:duotone | None in the current UI (registered for E05) |
| Undo | arrow-counter-clockwise:duotone | The `undo` reserved history row in `categoryIcons.js` (Lucide `RotateCcw`) |
| Archive | archive:duotone | `ManageGoalsDialog` archive button |
| Help | info:duotone | `ParentProfile` "show tips" row (Lucide `Lightbulb`). The `AddRewardModal` "ideas" toggle is not Help and stays as it is |
| Child switch | user-switch:duotone | None in the current UI. The `ChildView` selector is a list of avatars, not a switch control. Registered for E07 |

Lucide `Gift`, where it means "rewards / spend" (`ChildCard` Spend, `SpendRewardsModal`, `ChildView`, `Rewards` title, `WelcomeFamilyDialog`, `AddRewardModal`), maps to the Rewards asset gift:duotone. It is the same concept as the approved Rewards context, and leaving it as Lucide would put two different gift drawings on one screen. It is listed explicitly so the owner can veto it.

### 2.3 Behaviours (11) and stored keys

The server stores one of 16 legacy keys (`server/iconKeys.js`).

**New keys.** E03 adds 11 approved keys to **both** `server/iconKeys.js` and `src/lib/categoryIcons.js`: `kindness learning helping chores movement reading routines self-care community creativity sleep`. Each renders its approved Phosphor asset. The existing parity test keeps the client and server lists equal.

**Legacy keys.**
- Four legacy keys whose Lucide glyph is the *same named pictogram* as an approved asset render that approved asset: `hand-heart`→Kindness asset hand-heart, `handshake`→Helping asset handshake, `brain`→Learning asset brain, `bed`→Sleep asset bed. This is a style swap of the same drawing, not a new meaning.
- The other 12 legacy keys (`star heart shield mountain brush book-open palette footprints music check sparkles circle`) keep their current Lucide glyph.
- Mapping those 12 to approved icons would assign meanings the owner never chose. That mapping is listed as an **owner decision** (section 9), with a proposal.

**Picker.** `BehaviorCategoryManager` offers the 11 approved icons. If a category's current key is a legacy key, the picker also shows that key, selected, so opening and saving the form never changes it silently.

**New-family defaults.** The `routes.js` family-create seed and the `db.js` IMPL-5 seed change only where the default's *name* equals an approved context: Kindness→`kindness` and Chores→`chores`. The other six defaults keep their keys. Existing rows are never updated.

### 2.4 Reward contexts (12)

These are 11 Streamline Plump Duo assets plus phosphor:book-bookmark.
- They are registered and verified in E03.
- **They are not rendered in E03.** Rewards display each reward's stored emoji. Assigning context icons to templates or to stored rewards is reward-data work, owned by E06 (plan W5: "never migrate/replace all icons automatically").
- Showing them in the selectable picker also needs the open picker licence decision (the register's `proposed_engineering_constraints`).

### 2.5 Goals interactions (3 sources)

- **Asset swaps in E03:**
  - check-circle (Complete);
  - repeat:duotone, replacing Lucide `Repeat2` in `ManageGoalsDialog`;
  - sparkle:duotone, decorative, next to the Today's Goals heading, `aria-hidden`.
- **Behaviour rules, owned by E05:** keep the category icon on a completed goal, show visible "Done" text, show the schedule text. Where the current draft panel already shows text, it is kept.

### 2.6 Illustrations (9 cleared; 1 excluded)

Each is served as an `<img>` from `public/illustrations/`. They are byte copies, so they are covered by the existing whole-`public/` provenance test once added to `design/brand/RUNTIME_ASSETS.json`.

| Moment / element | Asset | Placement | Size |
| --- | --- | --- | --- |
| Home welcome | stickies star | `HeroCard` no-children state, decorative accent beside the heading; the Fox badge stays | 40 px |
| Progress milestone | stickies reward | `ChildCard`, only when this week's points have reached the weekly target (data already on the card) | 40 px |
| Reward redeemed | kameleon party-poppers | `SpendRewardsModal` confirmed-success state only | 120 px |
| First-run onboarding | kameleon robot | `OnboardingTips` first card | 120 px |
| Reward creation form | stickies gift-reciept | `AddRewardModal` header | 48 px |
| Small decorative sticker / celebration burst | same files as Home welcome / Reward redeemed | Covered by the two rows above | |
| Positive progress badge | stickies medal | **No placement in E03** | |
| Learning spot art | kameleon chalkboard | **No placement in E03** | |
| Goals empty state | Freepik #3570506 | **Excluded: licence pending.** The empty state stays text-only, with no substitute art | |

All illustrations are decorative (`alt=""`, `aria-hidden`), because the surrounding text carries the meaning. Rule 5 in the stage-1 doc, "one spot art at a time", holds: none of these placements is on the same view at once, except the Home welcome sticker. That sticker appears only when there are no children, and then there are no child cards.

The two elements with no placement are a **proposed deferral**. The register selects the artwork but names no screen, and adding them now would mean inventing placements. Their placement belongs to E07 screen design. This deferral is put to peer review (R3).

## 3. Rendering

- `src/components/icons/approvedIcons.js` is a **generated** module, written by `scripts/brand/build-approved-icons.mjs` from the register.
  - Each entry holds: `id`, `viewBox`, `inner` (the SVG's inner markup, verbatim), `source` (repo path), `sha256`, `licence`.
  - It covers every register asset under nav, controls, behaviors, rewards and the three goals-interaction sources: 41 distinct ids.
- `<PercyIcon id="phosphor:gift:duotone" className="h-5 w-5" />` renders `<svg viewBox aria-hidden focusable="false" class>` with `inner` set through `dangerouslySetInnerHTML`.
  - The markup is a build-time constant from checked-in files that the active-content scan has passed. Nothing comes from users or the network.
  - `title` / `aria-label` are only used when the icon stands alone. Existing call sites already label their buttons.
- **Phosphor duotone** uses `fill="currentColor"` with a 0.2-opacity layer, so it takes the token text colour.
- **Streamline** art keeps its original colours. CC BY requires a statement if anything is changed, so nothing is changed.
- **Unknown id:** the dev build throws; production renders nothing. A test asserts that every id used in `src/` exists.

## 4. Licences and attribution

- **Phosphor (MIT).** The licence text at commit `2b75f3a` is fetched and shipped as `public/licenses/phosphor-MIT.txt`.
- **Streamline (CC BY 4.0).** Each work needs credit, a licence link and a statement of whether it was changed. Shipped:
  - `public/licenses/streamline-CC-BY-4.0.txt`, containing the legal code;
  - a "Credits and licences" section in Settings with **draft text**.
- **Owner approval:** the draft text is customer-facing, so its exact wording needs owner approval before release. It is a PR blocker. The draft is in section 9.
- **Verification:** before any file is used, every source file is fetched from its pinned upstream URL and compared byte for byte. The results are recorded in the design's verification record, with sha256 values in the generated module.

## 5. Guards (each with an input that makes it fail)

| Guard | Fails on | Does not cover |
| --- | --- | --- |
| Generated module equals a fresh run of the generator over the register (drift) | Hand edit of `approvedIcons.js`; register changed without regenerating | Register content itself being wrong (owner-owned) |
| Each entry's `sha256` equals its source file's hash, and the source path is the register's `source_file` | One byte changed in `design/assets/...` | Upstream later changing; pinned commits make that moot |
| Active-content scan on every `inner` (same rules as E01) | `<script>` or an external `href` in a source | (none listed) |
| Every `<PercyIcon id=...>` literal in `src/` exists in the module | A typo in an id | Ids built from variables. **Rule:** ids must be literals or come from `categoryIcons.js` maps; check-tokens' "built from a variable" rule does not apply to `id`, so a test scans for `id={` on PercyIcon and requires a literal or a known map lookup |
| Retired-glyph ban: no import of Lucide `Home, User, Activity, Settings, Pencil, Plus, Archive, Repeat2, CheckCircle2, ClipboardCheck, RotateCcw, Gift` anywhere in `src/` (except `categoryIcons.js` legacy draws) | Re-importing Lucide `Pencil` | A mapped context drawn with a *different* Lucide name (e.g. `Edit2`). Partly closed by listing the common aliases `Edit, Edit2, Edit3, PlusCircle, CirclePlus, House` |
| Server/client key parity (existing test) | A key added only on one side | (none listed) |
| Legacy keys still render (each of the 16 resolves to some icon), unknown key gives the neutral fallback | Deleting a legacy key from the map | (none listed) |
| Illustrations: provenance and coverage through the E01 manifest test | A stray or edited file in `public/illustrations` | (none listed) |
| Freepik exclusion: no file under `public/` hashes to the Freepik PNG, and its name appears nowhere in `src/` | Copying the map into `public/` | A re-encoded copy; the licence gate is documented, and the owner check is the backstop |

## 6. Edge cases

| Input | Expected |
| --- | --- |
| Category with legacy key `heart` | Lucide Heart, as today. The picker shows the 11 approved icons plus Heart, with Heart selected |
| Category with `hand-heart` | Approved Phosphor hand-heart. Stored key unchanged |
| Category with an unknown key `zzz` (old client, bad import) | Neutral fallback circle; key unchanged; picker shows no selection |
| Older server receives a new key (rollout order) | Server validation rejects keys it doesn't know. This ships as one deploy; client and server are in the same repo and release |
| Export/import of family data with new keys | Keys are strings and pass through; the export test is unchanged |
| Child reaches the weekly target exactly (`week_points == weekly_target`) | Milestone sticker shows (`>=`) |
| `weekly_target` is 0 or null | No milestone sticker (guarded) |
| Reduced motion | No animation is added anywhere |
| Phosphor icon inside a `text-primary-foreground` button | Takes `currentColor`, so it is white on purple |

## 7. Abuse cases

- **A malicious SVG lands in `design/assets`:** the active-content scan fails before it reaches the module, and `dangerouslySetInnerHTML` only ever receives generated constants.
- **Someone swaps an approved asset for an unapproved one:** the source path must equal the register's `source_file`, and the hash must match.

## 8. Test plan

- New `src/test/approvedIcons.test.js` (the guards in section 5).
- Updated `categoryIcons.test.js` and server key tests.
- The E01 `brandAssets` test extends naturally through the manifest.
- `npm test` with a database, `check:tokens`, `lint`, `build`, and Playwright with axe. axe catches unlabeled icon-only buttons.
- Before/after screenshots of the same five screens, plus Manage Goals and Settings › Behaviours.
- **Not covered:** whether the owner agrees with each call-site mapping in 2.2. Screenshots and this table are the evidence for that.

## 9. Owner decisions raised (PR blockers, not built as assumptions)

1. **Legacy behaviour key mapping (proposal; not applied).**

   | Legacy key | Proposed approved key |
   | --- | --- |
   | heart | kindness |
   | brush | chores (the default "Chores" seed uses it) |
   | book-open | reading |
   | palette | creativity |
   | footprints | movement |
   | music | creativity |
   | check | routines |

   Keep Lucide for `star`, `shield`, `mountain`, `sparkles` and `circle`; these have no approved context. If approved, it is a render-only mapping, with no data change.
2. **Gift-as-Rewards mapping** (section 2.2), so the owner can veto it.
3. **Credits text (draft, customer-facing):** "Icons from Phosphor Icons (MIT licence). Illustrations and reward icons from Streamline (streamlinehq.com), CC BY 4.0, used unchanged. Licence texts: [links]."
4. **The two element placements** (medal, chalkboard): deferred to E07 unless the owner names screens now.

Still excluded: Freepik map (licence) and PointsStar (unapproved).

## 10. Rollout and reversal

- **Rollout:** no deploy. The work goes on a stacked draft PR into PR #51's branch. It contains no migration and no rewrite of stored data.
- **Server changes:** additive only (new allowed keys, new-family seed for two defaults).
- **Reversal:** revert the commit.
  - Families who picked a new key before a revert would hold keys an older server rejects on *edit* but still renders as the fallback.
  - That is safe (no data loss) and documented.
  - It is moot while nothing is deployed.
