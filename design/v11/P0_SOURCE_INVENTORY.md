# Positive Percy V1.1 — P0 source inventory and Fox 1A fidelity record

| | |
|---|---|
| Version | 0.1.0 |
| Issued | 23 November 2026 |
| Owner | Percy V1.1 design engineering |
| Status | Complete for stop gate P1. Findings only; no asset was changed. |
| Tracks | Issue #66, draft PR #71, `docs/design/PERCY_V11_CLAUDE_CODE_EXECUTION_HANDOVER.md` |

Every statement below was checked in this session against the file named beside it. Where something could not be checked, it says so.

## 1. What the repository holds

| Asset | Where | What it is | Checked how |
|---|---|---|---|
| Fox 1A seated mascot, full colour | `public/brand/fox-1a-symbol-full.svg` (copy of the kit's `02_SVG_Masters` file) | A vector **trace**, not an illustrator file. 3 paths, 0 curves, integer coordinates: body (1 shape), cream areas (4 shapes), star with rays (4 shapes). 9.3 KB. | Parsed the path data; sha256 `071d7614…0ac3c` matches `design/brand/RUNTIME_ASSETS.json` |
| The approved original | `…/Fox_1A_Complete_Logo_Kit/01_Source_And_Proof/approved-1A-source-crop.png` | A **341 × 435 px raster crop** of the refinement board. The "1A" label and three callout lines sit over the artwork; the paws are cut off by the bottom edge. sha256 `4953497c…fc66d`. | Opened the image; measured it |
| The refinement board itself | not in the repository | `Positive Percy Fox Logo Refinement Board.png` is named in `07_Handoff/logo-manifest.json` but the file is absent | File search by name (the same search finds `FOX_1A_POSE_LIBRARY.md`, so the search works) |
| Illustrator / Figma / EPS source | not in the repository | None | File search for `.ai .fig .sketch .eps .afdesign` |
| Logo variants | `public/brand/` (12 SVG), kit `02_SVG_Masters` (15 SVG), `03_Transparent_PNG` (36), `04_App_Icons`, `05_Website_And_Social`, `06_Print_And_Documents` | Symbol, horizontal and stacked lockups in full colour, purple, black, reverse; wordmark in three colours; app icons; social and print files. All use the same traced geometry. | Listed the 150-file pack; rendered the 12 runtime SVGs on the board |
| Pose artwork (walking, leaping, reaching, peeking, resting) | none | `docs/brand/FOX_1A_POSE_LIBRARY.md` locks five **concepts**. No artwork file exists for any of them. | File search for `*pose*`; `public/assets/` does not exist |
| Motion / GIF / Lottie | none | Only the V1 `star-pop` and `total-rise` CSS keyframes in `src/index.css` | Read `src/index.css` |
| Fonts | `public/fonts/` | Nunito 700/800, Poppins 400/500/600, WOFF2, Latin and Latin Extended. SIL OFL 1.1. | Listed; licences alongside |
| Icons | `design/assets/phosphor/` | Phosphor duotone and fill SVGs, MIT. The approved mapping is `src/components/icons/approvedIcons.js`. | Read both |
| Brand tokens | `src/index.css`, kit `02_Tokens/` | Purple `#4B1D8C`, orange `#FF6A00`, sunshine `#FFC938`, cream `#FFF6E8`, ink `#271737`, lilac `#E5DCEA`, plus V1 semantic and six child colours | Read `src/index.css` |
| Child photos | none in the repository | A photo is each family's own upload: `children.avatar_url` (`server/db.js`), rendered by `src/components/child/ChildAvatar.jsx` at 32, 48 or 64px | Read the three files |
| Streamline reward art | `public/reward-art/`, `design/assets/streamline/` | CC BY 4.0. The registry records the owner's decision of 20 November that licensing is settled; the credits wording in `public/licenses/CREDITS.txt` is still marked DRAFT. | Read the registry notes and credits |
| Freepik treasure map 3570506 | kit `04_Illustrations/` only | **Gated.** `design/brand/RELEASE_GATES.json` gate is `open`, `clearance: null`. Not used in any V1.1 file. | Read the gate file |

## 2. Fox 1A fidelity checklist

Compared by eye on the production board (approved board crop beside the traced master, whole figure and three close-ups).

| Check | Requirement | Traced master | Result |
|---|---|---|---|
| Facial expression | Closed, smiling eye; head tilted up | Present | Matches |
| Pointed muzzle | Long, pointed, towards the star | Present | Matches |
| Ears | Two tall pointed ears | Present | Matches |
| Proportions | Upright, slender, seated | Present | Matches |
| Tail direction and marking | Grows left, curls up, white swoop inside | Present | Matches |
| Single yellow star | One star, three rays | Present, as one separate shape | Matches |
| No mirroring | Never flipped | No flip in any V1.1 style; the QA script checks every fox for a negative horizontal scale | Matches |
| Primary wordmark | Traced from the board lettering | Present, unchanged | Matches |
| Orange | Palette `#FF6A00` | Gradient `#FF6A00` → `#FF5200` | **Gap** |
| White areas | Brief says white | Filled cream `#FFF6E8` | **Gap** |
| Star colour | Palette sunshine `#FFC938` | `#FFA600` | **Gap** |
| Edge quality | Smooth curves | Straight segments only; faceted from about 144px | **Gap** |
| Complete figure | Whole fox | The only original crops the paws and has labels over it | **Gap** |
| Editable for poses | Separate head, legs, tail | Body is one closed shape | **Gap** |
| Stacked logo | Whole wordmark visible | The "y" of Percy runs to the last pixel row of the 800 × 890 canvas and is cut off (measured on `positive-percy-stacked-full.svg`; the other three stacked files look the same on the board) | **Gap** |

## 3. Findings about the earlier V1.1 prototype (PR #71 at `e6ec4e2`)

1. **It does not show Fox 1A.** `design/previews/percy-v11-working-home-children.html` renders the fox as the 🦊 emoji (two `<span style="font-size:6…px">🦊</span>` elements). The Fox 1A path data does not appear in the file. `docs/design/PERCY_V11_HOME_CHILDREN_IA_DECISION.md` ("The real fixed Fox 1A SVG is embedded unchanged") and the visual-system spec ("unaltered original SVG used as an image") are wrong on this point.
2. Headings ask for `font-weight: 1000`. Nunito ships at 700 and 800 only.
3. The QA script run against it finds 51 text elements under the size limit and 12 touch targets under 44px. That run is kept as the control that proves the checks can fail.
4. **Reward requests.** The IA decision lists "reward requests" on Home. V1 has no request flow: the server has parent-initiated `POST /api/children/:id/redeem` and `…/savings/redeem` only. Adding one would be new functionality, so the V1.1 prototype leaves it out. Owner decision if wanted later.

## 4. Gaps and blockers

The numbered blockers B1 to B6, each with what clears it, are in `design/v11/fox1a/asset-manifest.json` (`blockers`). In short: there is no editable original (B1), the trace cannot be posed or enlarged cleanly (B2), no pose art exists (B3), three colours disagree with the palette (B4), limb motion is blocked on B2 and B3 (B5), and the stacked logo files are clipped (B6).

## 5. Rights

Recorded per asset in the manifest (`rights`). Nothing in the V1.1 files depends on an uncleared asset: they use only the Fox 1A kit, Nunito and Poppins (OFL), and Phosphor (MIT). Presence of a file in the repository was not treated as a licence.

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-11-23 | First issue |
