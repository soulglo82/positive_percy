# Stage 1 · Your icon and illustration decision worksheet

> **Partial owner choices recorded (13 Nov 2026).** The 38 earlier decisions plus 12 explicitly selected parent-picker category lists are recorded in [APPROVAL_REGISTER.json](APPROVAL_REGISTER.json). All other design decisions remain unselected. All three previously rejected icon contexts now have explicitly selected source assets; other design decisions remain unselected.

**[Start here](START_HERE.md)** · [Menu & controls](01_NAV_CONTROLS.md) · [Behaviours](02_BEHAVIOURS_GOALS.md) · [Rewards](03_REWARDS.md) · [Visual accents](04_ILLUSTRATIONS_ELEMENTS.md) · [Parent icon picker](05_PARENT_PICKER.md)

## 1. Navigation and controls

| Function | Selected source icon name | Weight/variant | None / More options? | Notes |
|---|---|---|---|---|
| Home | `phosphor:house-line:duotone` | duotone | Selected | Candidate names: `house`, `house-simple`, `house-line` |
| Progress | `phosphor:users:duotone` | duotone | Selected | Candidate names: `user`, `users`, `user-circle` |
| Activity | `phosphor:chart-line-up:duotone` | duotone | Selected | Candidate names: `pulse`, `chart-line-up`, `clock-counter-clockwise` |
| Rewards | `phosphor:gift:duotone` | duotone | Selected | Candidate names: `gift`, `ticket`, `shopping-bag` |
| Settings | `phosphor:gear:duotone` | duotone | Selected | Candidate names: `gear`, `sliders-horizontal`, `wrench` |
| Goals | `phosphor:target:duotone` | duotone | Selected | Candidate names: `target`, `list-checks`, `calendar-check` |
| Complete | `phosphor:check-circle:duotone` | duotone | Selected | Candidate names: `check-circle`, `seal-check`, `check-square` |
| Add | `phosphor:plus-circle:duotone` | duotone | Selected | Candidate names: `plus-circle`, `plus`, `note-pencil` |
| Edit | `phosphor:pencil:duotone` | duotone | Selected | Candidate names: `pencil-simple`, `note-pencil`, `pencil` |
| Schedule | `phosphor:calendar-dots:duotone` | duotone | Selected | Candidate names: `calendar-dots`, `repeat`, `calendar-check` |
| Pause | `phosphor:pause-circle:duotone` | duotone | Selected | Candidate names: `pause-circle`, `hand-palm`, `clock` |
| Undo | `phosphor:arrow-counter-clockwise:duotone` | duotone | Selected | Candidate names: `arrow-counter-clockwise`, `clock-counter-clockwise`, `arrow-u-up-left` |
| Archive | `phosphor:archive:duotone` | duotone | Selected | Candidate names: `archive`, `tray`, `folder` |
| Help | `phosphor:info:duotone` | duotone | Selected | Candidate names: `info`, `question`, `chat-circle-text` |
| Child switch | `phosphor:user-switch:duotone` | duotone | Selected | Candidate names: `users`, `user-switch`, `caret-down` |

**Additional shared style decision:** [ ] Phosphor regular/duotone [ ] Streamline Freehand [ ] Streamline Plump Duo [ ] Other, pending source/licence verification. **No box checked by default**.

## 2. Behaviours and Today's Goals

| Category/context | Selected icon name | Weight/variant | None / More options? | Notes |
|---|---|---|---|---|
| Kindness | `phosphor:hand-heart:duotone` | duotone | Selected | Candidate names: `heart`, `hand-heart`, `smiley` |
| Learning | `phosphor:brain:duotone` | duotone | Selected | Explicit owner selection from new source options |
| Helping | `phosphor:handshake:duotone` | duotone | Selected | Candidate names: `hand-heart`, `handshake`, `hands-clapping` |
| Chores | `phosphor:broom:duotone` | duotone | Selected | Candidate names: `broom`, `spray-bottle`, `house` |
| Movement | `phosphor:bicycle:duotone` | duotone | Selected | Candidate names: `bicycle`, `basketball`, `person-simple-run` |
| Reading | `phosphor:book-open-text:duotone` | duotone | Selected | Candidate names: `book-open-text`, `book-bookmark`, `books` |
| Routines | `phosphor:list-checks:duotone` | duotone | Selected | Candidate names: `list-checks`, `calendar-check`, `check-square` |
| Self-care | `phosphor:bathtub:duotone` | duotone | Selected | Explicit owner selection from new source options |
| Community | `phosphor:hands-clapping:duotone` | duotone | Selected | Candidate names: `hands-clapping`, `heart`, `users` |
| Creativity | `phosphor:paint-brush:duotone` | duotone | Selected | Candidate names: `palette`, `paint-brush`, `music-notes` |
| Sleep | `phosphor:bed:duotone` | duotone | Selected | Candidate names: `bed`, `moon-stars`, `moon` |

**Goals interaction decisions (four behaviour choices + exact three source SVGs approved, 14 Nov 2026):** Completed state **A — retain category icon + separate Done indicator** (exact SVG `phosphor:check-circle:duotone` with visible **Done** text) · Recurrence **A — repeat icon + human-readable schedule** (exact SVG `phosphor:repeat:duotone`) · Header **B — small playful sparkle accent** (exact SVG `phosphor:sparkle:duotone`) · Control **A — minimum 44×44 CSS px touch target with 24×24 CSS px glyph**. The three SVGs are exact original Phosphor Duotone files already staged in the asset library. Exact colour/placement still requires a running React visual review. No production change or deployment authorised.

| Remaining Goals design item | Status | Notes |
|---|---|---|
| Completed-goal icon behaviour | **Approved — Option A + pinned SVG** | Keep category glyph and add `phosphor:check-circle:duotone` with visible Done text; no server/ledger logic changes |
| Recurring goal indicator | **Approved — Option A + pinned SVG** | `phosphor:repeat:duotone` and actual schedule (e.g., Mon/Wed/Fri); not a streak, no missed-day penalty |
| Header accent | **Approved — Option B + pinned SVG** | `phosphor:sparkle:duotone` beside Today's Goals heading; decorative, no animation approved |
| Control sizing and weight | **Approved — Option A** | Primary completion control minimum 44×44 CSS px interactive target / 24×24 CSS px glyph. Preserve approved source artwork and accessible labels |

**Owner-approved exact SVG source files (14 Nov 2026):**

- `phosphor:repeat:duotone` — [pinned original SVG](https://github.com/soulglo82/positive_percy/blob/design/percy-stage1-interactive-preview/design/assets/phosphor/duotone/repeat.svg) · MIT, Phosphor pinned source commit `2b75f3ad12b420c9504ef05df8d2564a28f8500e`
- `phosphor:sparkle:duotone` — [pinned original SVG](https://github.com/soulglo82/positive_percy/blob/design/percy-stage1-interactive-preview/design/assets/phosphor/duotone/sparkle.svg) · MIT, Phosphor pinned source commit `2b75f3ad12b420c9504ef05df8d2564a28f8500e`
- `phosphor:check-circle:duotone` — [pinned original SVG](https://github.com/soulglo82/positive_percy/blob/design/percy-stage1-interactive-preview/design/assets/phosphor/duotone/check-circle.svg) · MIT, Phosphor pinned source commit `2b75f3ad12b420c9504ef05df8d2564a28f8500e`

Colour/spacing requires final visual QA. Repeat and sparkle are now exact asset approvals, not merely generic visual-direction decisions. The check-circle glyph is approved as a **separate** Done indicator, never a replacement for the original goal/category icon.

**Approval boundary:** Stage 1 design-only decision. No production code edits, branch merge or deployment.

## 3. Reward artwork

| Example reward | Selected asset_id / exact filename | Family | Points-star handling | Notes |
|---|---|---|---|---|
| Gaming time | `streamline:plump:duo:computer-devices:controller-1` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |
| Movie night | `streamline:plump:duo:images-photography:film-slate` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |
| Ice cream treat | `streamline:plump:duo:food-drink:ice-cream-2` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |
| New book | `phosphor:book-bookmark:duotone` | Phosphor · Duotone | Dedicated Percy star only | Explicit owner selection from new source options |
| Bike ride | `streamline:plump:duo:map-travel:bicycle-bike` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |
| Gift | `streamline:plump:duo:interface-essential:give-gift` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |
| Day out | `streamline:plump:duo:culture:ticket-1` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |
| Cake treat | `streamline:plump:duo:food-drink:cake-slice` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |
| Art activity | `streamline:plump:duo:interface-essential:paintbrush-2` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |
| Photo adventure | `streamline:plump:duo:images-photography:camera-1` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |
| Music time | `streamline:plump:duo:entertainment:music-note-2` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |
| Family outing | `streamline:plump:duo:map-travel:beach` | Streamline · Plump Duo | Dedicated Percy star only | Owner selected exact source vector |

**Catalogue direction:** **Unselected** · Plump Duo / Phosphor / Mixed only by explicit approval · Picker licensing: **review required**.


### Resolved alternatives for three previously rejected contexts

The owner has now selected one exact SVG for each previously rejected context. The remaining alternatives below have not been approved.

| Context | New alternatives (source-verified) | Status |
|---|---|---|
| Learning | `phosphor:brain:duotone`, `phosphor:lightbulb:duotone`, `phosphor:atom:duotone`, `phosphor:student:duotone`, `phosphor:microscope:duotone`, `phosphor:notebook:duotone` | **Selected: `phosphor:brain:duotone`** |
| Self-care | `phosphor:shower:duotone`, `phosphor:bathtub:duotone`, `phosphor:first-aid:duotone`, `phosphor:bandaids:duotone`, `phosphor:shield-check:duotone` | **Selected: `phosphor:bathtub:duotone`** |
| New book | `streamline:stickies:colors:school-science:book-library`, `phosphor:books:duotone`, `phosphor:book-bookmark:duotone`, `phosphor:book-open-text:duotone` | **Selected: `phosphor:book-bookmark:duotone`** |

## 4. Illustrations and elements

| Potential placement | Selected actual SVG (or None) | Size/colour | Motion allowed? | Notes |
|---|---|---|---|---|
| Home welcome | `streamline:stickies:colors:school-science:star` | Original artwork | No by default | Explicit owner-selected source SVG |
| Goals empty state | **Freepik · Bright Adventure Map · asset `3570506` — selected, licence pending** | Original artwork, pending acquisition | No by default | [Source asset](https://www.freepik.com/icon/treasure-map_3570506); exact author/licence and attribution must be verified before production use |
| Reward redeemed | `streamline:kameleon:pop:entertainment:party-poppers` | Original artwork | No by default | Explicit owner-selected source SVG |
| Progress milestone | `streamline:stickies:colors:travel-rating:reward` | Original artwork | No by default | Explicit owner-selected source SVG |
| First-run onboarding | `streamline:kameleon:pop:school-science:robot` | Original artwork | No by default | Explicit owner-selected source SVG |
| Reward creation form | `streamline:stickies:colors:shopping-shipping:gift-reciept` | Original artwork | No by default | Explicit owner-selected source SVG |
| small decorative sticker | `streamline:stickies:colors:school-science:star` | Original artwork | No by default | Explicit owner-selected source SVG |
| celebration burst | `streamline:kameleon:pop:entertainment:party-poppers` | Original artwork | No by default | Explicit owner-selected source SVG |
| positive progress badge | `streamline:stickies:colors:travel-rating:medal` | Original artwork | No by default | Explicit owner-selected source SVG |
| learning spot art | `streamline:kameleon:pop:school-science:chalkboard` | Original artwork | No by default | Explicit owner-selected source SVG |

**Mascot scenes:** No new fox artwork until the verified Fox 1A master is available. **Points:** The approved separate points-star is compulsory in point balances and prices.

### Approved external alternative (14 Nov 2026) — blocked until licensed

Owner explicitly selected **Freepik Bright Adventure Map** as the Goals empty-state illustration.

- Source reference: [freepik.com/icon/treasure-map_3570506](https://www.freepik.com/icon/treasure-map_3570506)
- Internal ID: `freepik:icon:treasure-map:3570506`
- Decision: **Design-selected, subject to licensing verification**; not permission to deploy.
- Asset file: **not acquired or committed**. Exact author, licence type, attribution, and commercial web/mobile reuse rights must be checked and the downloadable licence retained before engineering can use it.
- The earlier three rejected Streamline candidates and six later unselected Streamline candidates remain unchanged. This is **not** a decision to omit an empty-state illustration.
- Freepik links can redirect to Magnific; that redirect alone is not proof of a licence for this exact asset.

### Earlier genuine-source alternatives for Goals empty state (not approved)

| Candidate | Exact source ID | Status |
|---|---|---|
| 1. empty clipboard | `streamline:plump:duo:interface-essential:empty-clipboard` | **Unselected** |
| 2. task list edit | `streamline:plump:duo:work-education:task-list-edit` | **Unselected** |
| 3. calendar add | `streamline:plump:duo:interface-essential:calendar-add` | **Unselected** |
| 4. notepad text | `streamline:plump:duo:interface-essential:notepad-text` | **Unselected** |
| 5. dartboard | `streamline:kameleon:pop:interface-essential:dartboard` | **Unselected** |
| 6. lightbulb | `streamline:plump:duo:interface-essential:lightbulb` | **Unselected** |

These are selectable in the [interactive illustrations review](https://percy-stage1-design-selector-production.up.railway.app/?section=visual). The previous three options remain logged as rejected, not silently erased.

## 5. Parent reward icon picker

### Owner-approved category/icon memberships — 13 Nov 2026

These selections specify **exact icons offered under each category**, not any unlisted behaviour or design rules. The repeated identical picker submission is recorded only once.

| Category | Exact Phosphor Duotone icon names selected | Count |
|---|---|---:|
| Fun & games | `game-controller`, `dice-five`, `balloon`, `basketball`, `football`, `bowling-ball`, `puzzle-piece` | 7 |
| Treats & food | `ice-cream`, `cake`, `cookie`, `popcorn`, `pizza`, `hamburger` | 6 |
| Outings | `mountains`, `car`, `airplane`, `tent`, `train`, `bus`, `bicycle`, `ticket`, `sun`, `fire` | 10 |
| Learning & growth | `music-notes`, `lightbulb`, `palette`, `paint-brush`, `notebook`, `graduation-cap`, `pencil`, `books`, `guitar`, `microscope` | 10 |
| Family & kindness | `smiley`, `hands-clapping`, `handshake`, `medal`, `hand-heart`, `gift` | 6 |
| Creative time | `paint-brush`, `piano-keys`, `film-slate`, `music-notes`, `scissors`, `microphone`, `pen` | 7 |
| Tech & media | `game-controller`, `watch`, `television`, `device-mobile` | 4 |
| Things & pocket money | `backpack`, `t-shirt`, `piggy-bank`, `money`, `ticket` | 5 |
| Nature & outdoors | `tree`, `sun`, `moon-stars`, `paw-print`, `butterfly`, `fish`, `mountains` | 7 |
| Sports & movement | `basketball`, `football`, `soccer-ball`, `bicycle`, `tennis-ball`, `person-simple-run`, `ping-pong`, `swimming-pool` | 8 |
| Celebrations | `confetti`, `sparkle`, `crown`, `medal`, `trophy`, `cake`, `smiley-wink` | 7 |
| Animals & pets | `cat`, `dog`, `fish`, `butterfly`, `rabbit`, `bug`, `cow` | 7 |

**Selected:** 12 categories, 84 category placements, 71 distinct MIT Phosphor SVGs. **Not approved yet:** colours, responsive grid behaviour, search tags, upload support and any inclusion of Streamline in the parent-selectable picker.

### Parent picker — approved UX choices and remaining decisions

**Further approvals (14 Nov 2026):** A — **no new reward image uploads at launch**, possible post-launch review; A — **preserve all existing saved rewards and allow optional icon change in Edit**. These approvals do not authorise any destructive migration, loss of previous reward imagery or data, new file-storage service, or production deployment.

**Owner approvals (14 Nov 2026):** A — browse the 12 previously owner-selected categories **plus search**; A — **3 columns on phones and 5 or 6 on larger displays**; B — **approved Percy palette accents by category**.

**Additional owner approvals (14 Nov 2026):** C — launch with exactly **71 previously approved distinct icons** (84 approved placements) and plan an expansion only **after launch**, subject to separate asset approval; A — retain approved category memberships while **deduplicating search results by asset ID**; A — support **icon names and everyday-language synonyms** for local search. The other 44 candidates are not launch-approved; no new icon assets are admitted by these selections. These are Stage 1 design approvals only. Name/synonym matching is approved as a principle; the exact synonym dictionary and search result ranking remain open. Do not infer approval of exact responsive breakpoints, icon surface treatments, category-to-colour mapping, or licence redistribution. Uploads and saved-reward handling are separately recorded below. The 12 exact category/icon membership lists (84 placements, 71 distinct icons) are preserved without any additions or removals.


| Decision | Proposed default to review | Your approval |
|---|---|---|
| Library | 71 distinct owner-approved Phosphor Duotone icons, 84 placements in 12 categories | **Approved — C:** Launch with 71; expand after launch only after additional review. The other 44 candidates are **unapproved** |
| Visible categories | 12 proposed categories | **Unselected** |
| Cross-category duplicates | Preserve the owner-selected category memberships; deduplicate combined search by `asset_id` | **Approved — A**: an icon may appear in multiple categories, but only once per search result set |
| Grid density | 3 across phones, 5–6 on wider displays | **Approved — A: 3 on phones, 5 or 6 larger**; exact breakpoint and large-screen count pending |
| Search and discovery | Categories + search field; match icon names and common-language synonyms | **Approved — A for discovery and A for matching**; exact synonym dictionary, ranking and UI placement remain unselected |
| Colour variants | Category accents drawn from approved Percy palette (`#4B1D8C`, `#FF6A00`, `#FFF6E8`) | **Approved — B**; exact category-colour mapping and contrast testing pending |
| Picker source licensing | MIT-only until written Streamline confirmation | **Unselected** |
| Reward image uploads | Disabled at launch; potential post-launch reconsideration | **Approved — A**: no new parent image uploads at launch, revisit only after storage/security/privacy review and separate sign-off |
| Existing saved rewards | Keep existing reward icons, emoji, images, amounts, history and IDs intact; allow optional replacement of icon in Edit | **Approved — A**: non-destructive; no automatic replacement or bulk migration |
| Picker source policy | MIT Phosphor-only picker at launch; separate attribution/licence for curated Streamline and Freepik | **Proposed engineering constraint, NOT owner-approved**; no picker redistribution of other families without rights review and approval |

## Sign-off and handover

**You approve these in order:**
1. Exact navigation + control mappings and family/weight rule
2. Behaviour icon mappings and Goals completion controls
3. Reward icon family and specific artwork, **not** arbitrary icon-family examples
4. Which illustrated/decorative placements stay, or “none”
5. Scope of the parent reward picker and its default library

After choices are recorded, the engineering team will produce **one true running React preview** with the same source files, actual Nunito/Poppins and verified Fox 1A, at **390 / 834 / 1280 px**. Only that React build should be treated as a final design sign-off candidate.

**No merge/deploy** from these boards. Existing app architecture, parent permissions and saved rewards remain unchanged.
