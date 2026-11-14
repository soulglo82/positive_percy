# Positive Percy — Stage 1 final selected design system (14 November 2026)

**Status: DAY 1 VISUAL SELECTIONS COMPLETE; NOT A PRODUCTION RELEASE.** This handover consolidates explicit owner approvals, not implied selections or unsourced substitutes. The [canonical approval register](APPROVAL_REGISTER.json) and [approval worksheet](06_APPROVAL_WORKSHEET.md) remain authoritative. All changes are limited to this isolated design branch.

## Brand identity across app, website and documents
- Approved direction: Fox **1A** — sleek slender seated fox with one yellow star, alongside a custom purple outlined **Positive Percy** wordmark. No generic or previous fox logo substitution.
- Exact master vector and wordmark: **not located in repository**; mandatory release input.
- Brand points currency: dedicated points-star master required. The existing `src/components/brand/PointsStar.jsx` is **legacy Lucide Star**, not the approved new brand master. The decorative Streamline star is not points currency.
- Fonts: **Nunito 700/800 for headings**; **Poppins 400/500/600 for body and UI**. Self-host licensed font files and SIL OFL notices; current production Batch D Figtree/Fredoka is legacy.
- Colors: purple `#4B1D8C`, orange `#FF6A00`, sunshine `#FFC938`, cream `#FFF6E8`, ink `#271737`, lilac `#E5DCEA`. White on vibrant orange and orange/yellow on cream are not guaranteed accessible for normal text; final actual contrast QA required.
- Application, marketing website, family-report PDF and documentation should consume equivalent semantic tokens and original source artwork; no separate brand style for another medium.

## Parent reward icon picker — Day 1 selections
- **12 categories, 84 placements, 71 distinct selected icons.** Additional 44 previously browsed candidates are **not** approved for launch; any new icons post-launch require a separate selection.
- Discovery: categories **plus** local icon-name and common-synonym search. Keep icons in all approved categories; deduplicate combined search results by `asset_id`. Exact synonym dictionary and ranking can be settled in engineering UX review without replacing the selected icons.
- Picker uses category-specific approved accent colors (see table); preserve Phosphor Duotone SVG geometry. Do not use accent hues for low-contrast essential small text.
- Grid responds to **available picker container width**, not viewport: below **520px = 3 columns**; **520–759px = 5**; **760px+ = 6**.
- New parent image uploads disabled for launch, revisit after separate storage/privacy review. Existing saved rewards, emoji, images, points, IDs and redemption history preserved; optional icon changes in Edit, no forced migration.
- Phosphor-only picker launch-source rule remains a **proposed engineering/licensing constraint, not additional owner approval**.

| Selected category | Accent | Icons | Explicit selected Phosphor names |
|---|---|---:|---|
| Fun & games | orange | 7 | `game-controller`, `dice-five`, `balloon`, `basketball`, `football`, `bowling-ball`, `puzzle-piece` |
| Treats & food | orange | 6 | `ice-cream`, `cake`, `cookie`, `popcorn`, `pizza`, `hamburger` |
| Outings | sunshine | 10 | `mountains`, `car`, `airplane`, `tent`, `train`, `bus`, `bicycle`, `ticket`, `sun`, `fire` |
| Learning & growth | purple | 10 | `music-notes`, `lightbulb`, `palette`, `paint-brush`, `notebook`, `graduation-cap`, `pencil`, `books`, `guitar`, `microscope` |
| Family & kindness | purple | 6 | `smiley`, `hands-clapping`, `handshake`, `medal`, `hand-heart`, `gift` |
| Creative time | sunshine | 7 | `paint-brush`, `piano-keys`, `film-slate`, `music-notes`, `scissors`, `microphone`, `pen` |
| Tech & media | purple | 4 | `game-controller`, `watch`, `television`, `device-mobile` |
| Things & pocket money | orange | 5 | `backpack`, `t-shirt`, `piggy-bank`, `money`, `ticket` |
| Nature & outdoors | sunshine | 7 | `tree`, `sun`, `moon-stars`, `paw-print`, `butterfly`, `fish`, `mountains` |
| Sports & movement | orange | 8 | `basketball`, `football`, `soccer-ball`, `bicycle`, `tennis-ball`, `person-simple-run`, `ping-pong`, `swimming-pool` |
| Celebrations | sunshine | 7 | `confetti`, `sparkle`, `crown`, `medal`, `trophy`, `cake`, `smiley-wink` |
| Animals & pets | purple | 7 | `cat`, `dog`, `fish`, `butterfly`, `rabbit`, `bug`, `cow` |

## Today's Goals — exact source and behaviour
- Preserve the original category icon when a goal is marked completed. Show separate `phosphor:check-circle:duotone` with visible **Done** text.
- Recurrence uses `phosphor:repeat:duotone` and readable actual schedule; missing a day never deducts points.
- The header has a small decorative `phosphor:sparkle:duotone`, with no unapproved animation.
- Minimum completion tap target **44×44 CSS px**, visible icon **24×24 CSS px**.
- These exact Phosphor SVG files are already staged at `design/assets/phosphor/duotone/`.
- Goal completion remains adult-operated, server-ledger idempotent and undo-safe.

## Exact context icon mapping — 38 approved

### nav

- Home: `phosphor:house-line:duotone`
- Progress: `phosphor:users:duotone`
- Activity: `phosphor:chart-line-up:duotone`
- Rewards: `phosphor:gift:duotone`
- Settings: `phosphor:gear:duotone`

### controls

- Complete: `phosphor:check-circle:duotone`
- Goals: `phosphor:target:duotone`
- Add: `phosphor:plus-circle:duotone`
- Edit: `phosphor:pencil:duotone`
- Schedule: `phosphor:calendar-dots:duotone`
- Pause: `phosphor:pause-circle:duotone`
- Undo: `phosphor:arrow-counter-clockwise:duotone`
- Archive: `phosphor:archive:duotone`
- Help: `phosphor:info:duotone`
- Child switch: `phosphor:user-switch:duotone`

### behaviors

- Kindness: `phosphor:hand-heart:duotone`
- Learning: `phosphor:brain:duotone`
- Helping: `phosphor:handshake:duotone`
- Chores: `phosphor:broom:duotone`
- Movement: `phosphor:bicycle:duotone`
- Reading: `phosphor:book-open-text:duotone`
- Routines: `phosphor:list-checks:duotone`
- Self-care: `phosphor:bathtub:duotone`
- Community: `phosphor:hands-clapping:duotone`
- Creativity: `phosphor:paint-brush:duotone`
- Sleep: `phosphor:bed:duotone`

### rewards

- Gaming time: `streamline:plump:duo:computer-devices:controller-1`
- Movie night: `streamline:plump:duo:images-photography:film-slate`
- Ice cream treat: `streamline:plump:duo:food-drink:ice-cream-2`
- New book: `phosphor:book-bookmark:duotone`
- Bike ride: `streamline:plump:duo:map-travel:bicycle-bike`
- Gift: `streamline:plump:duo:interface-essential:give-gift`
- Day out: `streamline:plump:duo:culture:ticket-1`
- Cake treat: `streamline:plump:duo:food-drink:cake-slice`
- Art activity: `streamline:plump:duo:interface-essential:paintbrush-2`
- Photo adventure: `streamline:plump:duo:images-photography:camera-1`
- Music time: `streamline:plump:duo:entertainment:music-note-2`
- Family outing: `streamline:plump:duo:map-travel:beach`

## Exact illustration/decorative placements — ten approved

- moments: Home welcome — `streamline:stickies:colors:school-science:star`
- moments: Progress milestone — `streamline:stickies:colors:travel-rating:reward`
- moments: Reward redeemed — `streamline:kameleon:pop:entertainment:party-poppers`
- moments: First-run onboarding — `streamline:kameleon:pop:school-science:robot`
- moments: Reward creation form — `streamline:stickies:colors:shopping-shipping:gift-reciept`
- moments: Goals empty state — `freepik:icon:treasure-map:3570506`
- elements: small decorative sticker — `streamline:stickies:colors:school-science:star`
- elements: celebration burst — `streamline:kameleon:pop:entertainment:party-poppers`
- elements: positive progress badge — `streamline:stickies:colors:travel-rating:medal`
- elements: learning spot art — `streamline:kameleon:pop:school-science:chalkboard`

**Freepik Bright Adventure Map #3570506:** approved for the Goals empty state. The actual matching 512×512 PNG is in the Positive Percy Project Library as `/Postive Percy/treasure-map_3570506.png`. It has not been checked into the repository, and the exact asset-specific licence/attribution document has not been stored. No replacement illustration is authorised.

## Source, licenses and design release gates
- Approved Phosphor icons: original staged SVGs pinned to `2b75f3ad12b420c9504ef05df8d2564a28f8500e`, MIT licence.
- Approved Streamline visuals/reward examples: original selected staged SVGs pinned to `52d750c9ce051e51cb181b7a78932120c48541d0`; check relevant CC BY 4.0 attribution and selection/redistribution terms; selected source variants stay unchanged.
- Freepik map: use the exact uploaded PNG, retain the relevant downloaded licence record when integrated.
- Do **not** replace Fox 1A / points star with the legacy `public/logo-mark.png` or generic Lucide Star.
- Before release: obtain true Fox 1A master and custom wordmark, dedicated points-star, integrate uploaded exact map and licence, self-host fonts, run true React previews at **390 / 834 / 1280px**. Test 1/2/3/6 children, long names, empty and many rewards, empty/completed goals, search/dedupe, keyboard/screen readers, contrast, legacy reward migration, role/permission enforcement, idempotent points ledger, family-local schedule/Undo and end-to-end tests.
- Independent code/privacy/security review plus explicit owner visual sign-off precedes any merge/deployment.

**No production changes, merges or deployments are approved by this document.**
