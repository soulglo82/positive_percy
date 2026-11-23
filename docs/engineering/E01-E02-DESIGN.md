# E01 + E02 design: asset provenance, Percy tokens, fonts, Fox 1A logo and app icons

| Field | Value |
| --- | --- |
| Version | 1.2 |
| Issued | 2026-11-15 |
| Owner | Percy v2 engineering (integration branch `claude/percy-v2-engineering-handover-f5ya53`) |
| Status | Built and in production with V1 (23 November 2026). §5a is built on `claude/percy-v1-engineering-handover-f5ya53` and is not released until the owner approves it |
| Parent plan | `docs/engineering/PERCY_V2_IMPLEMENTATION_PLAN.md`, tickets E01 and E02 |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-15 | First design, written for peer review before the build |
| 1.1 | 2026-11-15 | Adopts the peer-review findings (see "Peer review record"); records the build and the verification evidence |
| 1.2 | 2026-11-23 | The home-screen icon is the kit's iPhone icon (owner's choice); its address carries the file's hash; tests forbid transparency in icons a phone masks (§5a) |

## 1. Contract being repaired

The app has one source of truth for colour, type and brand:
- `src/lib/tokens.js` holds the hex values.
- The `:root` block of `src/index.css` mirrors them as HSL channels.
- `tailwind.config.js` is the only consumer.

`scripts/check-tokens.mjs` rejects any colour, size or weight that is not a token. `src/test/tokens.test.js` checks parity and contrast.

Before this change, that source held the interim Batch D brand: orange `#c2410c`, Figtree and Fredoka type, and the old raster mascot `public/logo-mark.png`.

E02 swaps brand values inside that same contract. It adds no second source, so every route picks up the new brand through the existing semantic names. E01 adds a provenance manifest, so every runtime brand file traces back to the checksummed 150-file pack.

## 2. Code paths touching the contract

| Path | Change |
| --- | --- |
| `src/lib/tokens.js` | Values remapped (section 3); `chart-3` and `chart-5` removed (unused); confetti uses `kid-1` instead of `brand-ink` |
| `src/index.css` `:root` | HSL mirror regenerated from `tokens.js`; `@font-face` swapped to Nunito/Poppins, Latin and Latin Extended |
| `tailwind.config.js` | `fontFamily`; `fontWeight` (`bold` 700, `extrabold` 800); `chart` keys 1, 2, 4 |
| `scripts/vite-tokens-plugin.js` | Code unchanged; `theme_color` follows `TOKENS.primary`, which is now purple |
| `manifest.base.json` | Kit PWA 192 and 512 icons, maskable 512, `?v=3` |
| `index.html` | Favicons (ico, svg, 32 png), apple-touch-icon, Poppins preload, `og:*` meta |
| `src/components/brand/Logo.jsx`, `logoArt.js` | Renders the kit SVGs; adds `variant` and `tone`; existing props unchanged |
| `src/components/brand/PointsStar.jsx` | Same Lucide shape; sunshine fill with a `warning-border` outline |
| `src/lib/childColour.js` | Unused `text` slot removed |
| `src/Layout.jsx`, `HeroCard.jsx` | Header lockup size and link label; round hero badge |
| 13 files with `font-display` headings | `font-semibold` becomes `font-extrabold` (title and total sizes) or `font-bold` |
| `src/lib/familyReport.js` | **Not touched.** It already uses `#4B1D8C`; report brand alignment is E12 |
| Server, database, migrations | **Not touched** |

## 3. Semantic token mapping

The values come from two places:
- Plan section "3. Locked brand system" gives the six palette values.
- The reviewed v2 prototype, `design/previews/percy-v2-full-review.html` `:root`, gives the supporting tints `plum`, `lav` and `amber`.

No new hue families are introduced.

| Token | Old | New | Source and reason |
| --- | --- | --- | --- |
| background | #fbf6ee | #fff6e8 | warm cream |
| card, popover | #ffffff | #ffffff | white |
| muted, secondary | #f3f1ec | #f9f3ff | prototype `lav` |
| accent | #e9e5dc | #eee4f0 | prototype progress-track tint; a hover surface distinct from muted and selected |
| selected | #fde4d3 | #e5dcea | fine lilac; its own surface, not muted and not card |
| foreground (plus the `*-foreground` text aliases, negative, warning-foreground, overlay) | #1f1b16 | #271737 | ink |
| muted-foreground, subtle-foreground, spend | #5e554a / #6b6257 | #594e69 | prototype `plum` |
| input | #8a8073 | #857a96 | plum tint: 4.02 on card, 3.75 on cream, 3.69 on lav. Field borders stay lighter than secondary text, as in Batch D |
| primary, ring, selected-border, brand-ink, chart-2 | #c2410c / #1e3a5f | #4b1d8c | purple |
| primary-hover | #9a3412 | #35136a | darker purple, same hue family; white on it is 14.5 |
| star | #e8a317 | #ffc938 | sunshine |
| star-soft, warning | #fdf0d0 / #fff4e5 | #fff1d1 | prototype `amber` (section 12) |
| border | #e6e1d8 | #e5dcea | fine lilac |
| chart-4 | #5e554a | #594e69 | plum |
| chart-3, chart-5 | #e8a317 / #c2410c | removed | unused in src; they kept the retired star and orange alive |
| earn, earn-soft, destructive, warning-border, chart-1, kid-1/2/3/5/6 | unchanged | unchanged | functional meanings, not brand |
| kid-4, kid-4-soft | #7d3c8f / #f1e2f5 | #8a6b0f / #eeebd5 | ochre (section 3.1) |

### 3.1 Deviations from the prototype, and why

* **Earned green stays `#2a6e33`.** The prototype's `#176543` is ΔE 25.3 from the child teal `kid-3`. The existing invariant requires more than 35, so earned points and child identity colours stay distinguishable.
* **kid-4 changes from plum to ochre.**
  * Plum `#7d3c8f` is ΔE 22.8 from the new brand purple. The invariant requires more than 35, so a child colour never reads as the primary action colour.
  * v1.0 chose navy `#193466`. The review found navy is ΔE 19.5 from ink, so a navy band reads as a dark rule.
  * v1.1 searched again with two added rules: ΔE above 30 from ink, and above 20 from destructive. Ochre `#8a6b0f` passes every rule with a minimum margin of 7.8. Its nearest child colour, cocoa, is 27.8 away. Its text contrast is above 4.5 on card, lav and cream.
  * Colour is stored as `colour_index`, so only the display changes: no row is written and no index moves. The change is visible to families, so it is on the owner visual sign-off list.
* **No "far from secondary text" rule for child colours.** The review proposed ΔE above 20 from muted-foreground; slate `kid-6` is 13.1 from plum. I answered this structurally rather than with a guard:
  * The `text` slot of `CHILD_COLOURS` had no consumers. A grep found no `text-kid-*` and no `colour.text` anywhere in src.
  * The slot is removed, and a test pins the slot set to band, border, ring and soft.
  * A child colour can no longer be used as text, so it cannot be mistaken for secondary text, and kid-6 stays as it is.
* **Orange `#FF6A00` is not a token.** It is 2.87:1 on white and 2.68:1 on cream, so it fails both text and focus-ring contrast. Focus stays purple. Orange appears only inside the logo artwork. A test asserts that no token equals `#ff6a00`. If a decorative orange is needed later, E03 or E07 adds it with a "never text" test, the same way `star` is handled.
* **The Batch D test "active nav is not orange on selected" is replaced, not deleted.** It guarded the old orange, which failed at 4.24 on its tint. The new invariants are:
  * primary and foreground on selected are at least 4.5;
  * selected differs from muted, card and accent.

## 4. Fonts

* **Faces.** Nunito 700 and 800, and Poppins 400, 500 and 600.
  * Latin and Latin Extended WOFF2 files are split by `unicode-range`, so accented child names get real glyphs.
  * They come from `@fontsource/nunito@5.3.0` and `@fontsource/poppins@5.3.0` (SIL OFL 1.1). Both tarballs' sha512 matched the npm registry at import.
  * They are vendored as source in `design/brand/fonts/` and copied byte for byte into `public/fonts/`, along with each package's `LICENSE` as `OFL-nunito.txt` and `OFL-poppins.txt`.
  * The Figtree and Fredoka files and their notices are removed.
* **Families.** `fontFamily.sans` is Poppins and `fontFamily.display` is Nunito, both with system fallbacks. Poppins Latin 400 (body text) is preloaded.
* **Weights.** `bold` (700) and `extrabold` (800) exist only for Nunito; Poppins ships no 700. `font-synthesis: none` is already set on `html`, so a bold request on Poppins silently renders 600. The guard below makes sure that never happens unnoticed.
* **Guard: bold weights only on Nunito.** A test scans `src/**/*.{js,jsx,ts,tsx}`. It fails when a string contains `font-bold` or `font-extrabold` without `font-display`, unless that line opens `DialogTitle` or `AlertDialogTitle` (their base class sets `font-display`).
  * Fixtures that fail: `<p className="font-bold">` and `const w = 'text-sm font-extrabold'`.
  * Fixtures that pass: `font-display font-extrabold`, a DialogTitle, `font-semibold`, `font-boldish`.
  * Not covered, both false positives that fail loudly rather than let a wrong weight through:
    * another component whose base class supplies `font-display`;
    * a parent that applies `font-display` to a child which adds `font-bold` in a separate string.
* **Other direction.** `font-semibold` on Nunito resolves to the real 700 face: CSS font matching picks the next heavier weight, and nothing is synthesised.

## 5. Logo and icons

* **Runtime copies under `public/brand/`, byte-identical.** All 12 files from `02_SVG_Masters`: symbol, horizontal and stacked, each in full, reverse (white), mono-purple and mono-black. This is the plan W1 variant list.
* **App icons**, following the kit README section "Required integration":
  * from `PWA/`: `public/icon-192.png`, `public/icon-512.png` and `public/maskable-512.png` (with `purpose: maskable`);
  * `public/apple-touch-icon.png`: from `iOS/apple-touch-icon-180.png` since v1.2. This departs from the kit README, which names `PWA/apple-touch-icon.png`; the reason and the owner's choice are in §5a;
  * from `Web/`: `public/favicon.ico`, `public/favicon.svg` and `public/favicon-32.png`;
  * `public/og-image.png`, from `05_Website_And_Social/open-graph-1200x630.png`, with `og:*` meta tags.
* **Not applicable to this web app.** These are recorded in `RUNTIME_ASSETS.json` under `excluded_from_runtime`:
  * The iOS `AppIcon-1024` and the Android adaptive foreground and background layers are for native app builds. There is no native app, and Android launchers use the PWA maskable icon.
  * Print, PDF, letterhead and social cover files belong to E12 (report and website).
* **Rendered with `<img>`, not inlined.** The SVGs share the gradient id `fox1a-orange`, so inlining two of them on one page would collide.
  * The scan of the kit SVGs found no script, href, image, foreignObject, @import or event handler. The only `url(...)` in them is that internal gradient.
  * A test enforces this on every SVG in `public/`.
* **`Logo` component.**
  * Existing props are unchanged: `size`, `wordmark`, `decorative` and `className`.
  * New: `variant` (`symbol`, `horizontal`, `stacked`) and `tone` (`full`, `reverse`, `mono-purple`, `mono-black`). The artwork table is a pure module, `src/components/brand/logoArt.js`.
  * Height equals `size`. Width comes from the viewBox ratio: 365×459, 1350×380 or 800×890. A test reads the viewBoxes.
  * Without `decorative`, the image gets `alt="Positive Percy"`. With `decorative`, it gets `alt=""` and `aria-hidden`.
* **Call sites.**
  * Header links carry `aria-label="Positive Percy home"` around a decorative lockup, at size 40 on desktop and 36 on mobile. The E2E name check reads labels, not image alts.
  * The Home hero puts the non-square symbol in a fixed 40×40 circle, so the badge stays round.
* **Cache-busting.** Icon and manifest links use `?v=3`, because installed PWAs cache icons aggressively. The home-screen icon's link instead carries the start of its file's hash (§5a).
* **Legacy logo files removed.** `logo-mark.png`, `logo.png` and `logo_old.png` are deleted from `public/`. The only reference was `Logo.jsx`; nothing in `server/`, `e2e/` or `index.html` used them. Git history preserves the files. The Batch D icons are overwritten in place.
* **`.gitattributes`.** SVGs are `-text`, binaries are `binary`, and archive parts are `-text`, so line-ending conversion can never change hashed bytes.

### 5a. The home-screen icon (owner, 23 November 2026)

**What was wrong.** The first V1 home-screen icon was the kit's `PWA/apple-touch-icon.png`: a cream tile with an orange border, rounded, with see-through corners. For a shortcut saved from Safari, an iPhone fills see-through pixels with black and cuts its own rounded corners, so the icon showed dark slivers at its corners and a border that did not follow the phone's own corner. Picture: `docs/engineering/evidence/v1-home-screen-icon/options-as-an-iphone-draws-them.png`. It is a simulation (black behind the image and a plain rounded mask at about the iPhone's corner ratio), not a photograph of a phone.

**Decision.** In the engineering session of 23 November the owner was shown that picture and chose option A: the kit's own iPhone icon, `iOS/apple-touch-icon-180.png` (orange, white fox, square, no alpha), in place of the `PWA/` file. The kit README names the `PWA/` file for this use, so this is a deliberate departure from the kit's instruction, made because that file cannot work on an iPhone. The chosen file is a member of the pinned archive, so no new artwork enters the app. Options B (the kit's maskable icon: fox too small on a home screen) and C (the approved fox rearranged on cream: a new asset, shown in the picture only) were not chosen.

**Contract.** The page declares exactly one home-screen icon. Every image a phone masks is a square whose file has no alpha channel and no transparency chunk: the home-screen icon (180 px) and any manifest icon whose purpose includes `maskable`. The other icons (`icon-192`, `icon-512`, favicons) are shown as they are and may keep see-through corners.

**Cache.** iPhones are widely reported to keep a home-screen icon by its address; Apple does not document it and it was not checked on a device. The address in `index.html` ends with the first eight characters of the file's own SHA-256, so a changed file cannot ship under an old address. The other icons keep `?v=3`; they did not change.

**What it does not do.** A shortcut already on a home screen keeps the picture it was saved with (known iPhone behaviour; not checked on a device here). It has to be removed and added again from Safari.

**Tests** (`src/test/brandAssets.test.js`). The list of masked icons is read from the page and the manifest, not written into the test: every `apple-touch-icon` link of `index.html` and every `maskable` manifest icon must be the stated square size and unable to hold transparency. The page must have exactly one home-screen link, and its address must match its file's hash. The transparency reader is checked against seven small PNGs built in the test (RGB, grey, palette; RGBA, grey with alpha; palette and RGB with a transparency chunk) and one real see-through file. On the old icon the masked-icon test and the address test failed. Two wrong setups were tried and both turn the tests red: a second home-screen link to a see-through file, and `maskable` added to `icon-192`.

**Not covered:** what a real iPhone draws (no device in the test bench); a solid image saved with an alpha channel (it fails the test although it would look right, which matches the contract as written); file types other than PNG.

**Reversal.** Revert the commit. Restoring only the old file would fail these tests, by design.

## 6. E01 provenance manifest

`design/brand/RUNTIME_ASSETS.json` has one entry per runtime file, with four fields:
- `runtime`: the shipped path;
- `source`: inside `design/brand/library/`, or `design/brand/fonts/` for fonts;
- `sha256`;
- `licence`: either owner-approved Fox 1A with fidelity sign-off pending, or SIL OFL with the package version and tarball sha512.

The test `src/test/brandAssets.test.js` runs these checks:
0. The 36 parts rebuild the pinned archive, with the expected size and SHA-256, and the committed library equals the 150 ZIP members byte for byte. The test uses a small ZIP reader, so CI re-checks the chain instead of trusting the library.
1. For every entry, the runtime file's hash equals the source file's hash, which equals the recorded `sha256`. Logo and icon sources must sit inside the library.
2. Every file in the whole `public/` tree is in the manifest, and every manifest entry exists. Nothing untraced ships and no stale entry remains.
3. No legacy file name ships: `logo-mark.png`, `logo.png`, `logo_old.png`, `figtree-*`, `fredoka-*`.
4. Every SVG in `public/` passes the active-content scan.

Further checks in the same file:
- Logo variant and tone parity with `public/brand`.
- viewBox ratios.
- Every `index.html` and manifest reference exists.
- Every `@font-face` URL ships, and `public/fonts` holds exactly those 10 WOFF2 files.

**Counter-examples.** Each was run as a mutation on 2026-11-15 and turned the named check red; the file was then restored:

| Mutation | Fails |
| --- | --- |
| One byte appended to `public/brand/fox-1a-symbol-full.svg` | (1) |
| `public/brand/stray.svg` added | (2), and the Logo parity test |
| `public/logo-mark.png` restored | (3) |
| One byte appended to a library file | (0) |

SVG fixtures cover script, image, xlink:href, event handler, external url() and @import, for (4).

**Not covered:**
- Fonts are anchored to the npm tarball integrity checked at import. That check is not re-run in CI, because the tarballs are not vendored.
- Visual fidelity of the traced fox at small sizes. This is a human check (section 9).

## 7. Edge cases (triggering input → expected outcome)

| Input | Expected |
| --- | --- |
| Child with `colour_index = 3` | Renders ochre; database row unchanged |
| Child loaded before migration 010 (no index), fourth oldest | Ochre, by fallback order; logic unchanged |
| `Logo size={16}` symbol | 13×16 image, no distortion (explicit width and height) |
| `Logo tone="reverse"` on a light background | Developer error: the white art is invisible. The component cannot know its background, so this is a documented contract. No call site uses reverse yet; E07 owns the first use and its screenshot check |
| Non-square symbol in a round badge (Home hero) | Fixed 40×40 circle, symbol centred |
| Child name with accents (Zoë, Łukasz, Nguyễn) | Latin and Latin Extended faces load by `unicode-range`. Characters outside both (for example Cyrillic) fall back to the system font |
| Offline first load, font not cached | `font-display: swap` shows the system fallback; no invisible text |
| Font file missing from a deploy | Fallback stack renders; the test asserts that every `@font-face` file ships |
| Old installed PWA | New icons on the next manifest fetch; `?v=3` forces it |
| Installed PWA status bar | `theme_color` is now purple. Android draws a purple bar with light icons. iOS `apple-mobile-web-app-status-bar-style=default` ignores theme-color and keeps a white bar, unchanged |
| Browser without SVG favicon support | `favicon.ico` and the 32 px PNG are also linked |
| `font-bold` on body text | Test fails (section 4 guard) |

## 8. Abuse cases

* **A malicious SVG in a future kit update.** The active-content scan test fails. Separately, `<img>` never runs SVG scripts.
* **A swapped runtime asset.** The hash parity against the library fails.
* **A coordinated edit of library, runtime and manifest**, where someone swaps the art and updates all three. Check (0) still fails, because CI re-derives the library from the pinned archive.
* **Third-party font CDN tracking.** Fonts are self-hosted, and no Google Fonts request is made. The prototype's `@import` was deliberately not carried over.

## 9. Outcome records

Screenshots are in `docs/engineering/evidence/e02/`:
- Login, dashboard, rewards, activity and settings at 390 and 1280 px, before and after. They use a synthetic "Evidence Family" on a local throwaway database.
- `favicons-and-1a-reference.png` (taken at v1.1; it shows the first home-screen icon, replaced in §5a): favicons at 16, 32, 48 and 64 px, the apple-touch icon, the maskable icon inside a circle mask, and the approved 1A board crop beside the installed SVG.

## 10. Test plan

Automated:
- `npm test`, with and without `TEST_DATABASE_URL`;
- `npm run check:tokens`, `npm run lint`, `npm run build`;
- `npm run test:ui` (Playwright with axe, 4 viewports).

**Not covered by any automated test:**
- Perceived fidelity of the traced fox at 16 px. In the evidence image it is recognisable but barely legible at 16 px.
- Whether the purple-led look matches the owner's intent on every route.

Both are owner visual sign-off items. Routes are restyled by tokens only; per-screen v2 layouts are E07.

## 11. Rollout and reversal

There is no deployment in this ticket. The work lives on the integration branch, built on PR #50's head. Reverting is one `git revert` of the E02 commit: there is no data, schema or server effect. The plan's W9 gates apply before any production release.

## 12. Out of scope, and recorded decisions

* **Owned by later tickets:**
  * E03: icons and illustrations, including the Phosphor package and the treasure map behind its licence gate.
  * E06: the reward picker.
  * E07: per-screen v2 layouts.
  * E12: Family Report, Framer, and the print and social files.
* **Dedicated points-star master: not approved.** The Lucide star stays, with a sunshine fill and a `warning-border` outline. Sunshine alone is 1.37:1 on its star-soft chip; the outline is 3.25:1 there, and a test asserts at least 3. This remains a release blocker, as the plan says.
* **`warning` and `star-soft` share amber `#fff1d1` deliberately.** They were already nearly identical in Batch D (`#fff4e5` and `#fdf0d0`), and every warning surface has a `warning-border` edge that reward chips do not.

## Peer review record

A fresh-context review of v1.0 on 2026-11-15 raised 4 blocking and 9 non-blocking findings. Each finding was checked against the code before acting on it.

| # | Finding | Disposition |
| --- | --- | --- |
| B1 | `selected` equals `muted` (#f9f3ff); the avatar fallback vanishes on card | Adopted: selected is lilac and accent is #eee4f0; a test asserts selected differs from muted, card and accent |
| B2 | Navy kid-4 is ΔE 19.5 from ink | Adopted: kid-4 is ochre, with tests for ΔE above 30 from ink and above 20 from destructive. The muted-foreground rule is answered structurally by removing the text slot (section 3.1) |
| B3 | W1 variants (stacked, mono, reverse), OG image, iOS and Android icons missing | Adopted: all 12 SVG masters and the OG image ship. Native-only icons are recorded as not applicable, with the reason |
| B4 | Font hash parity has no source | Adopted: fonts vendored under `design/brand/fonts/`, tarball sha512 recorded in the manifest |
| N1 | The coverage glob misses `maskable-512.png` | Adopted: coverage is the whole `public/` tree, checked both ways |
| N2 | Guard reasoning wrong (`font-synthesis: none`, the variable claim, DialogTitle false positive, `.js` not scanned) | Adopted: section 4 corrected, title components allowed, `.js` and `.ts` scanned |
| N3 | The star vanishes on star-soft (1.37) | Adopted: `warning-border` outline, with a test for at least 3 |
| N4 | `warning` merged with `star-soft` | Answered: intentional, recorded in section 12 |
| N5 | `input` as dark as secondary text | Adopted: #857a96 |
| N6 | `primary-hover` equals ink; `brand-ink` duplicated in confetti | Adopted: #35136a; confetti uses kid-1 |
| N7 | chart-3 and chart-5 keep retired values | Adopted: removed (unused) |
| N8 | Edge cases: reverse warning cannot be built, oval hero badge, non-Latin names, status bar | Adopted: section 7 rows added; warning dropped; hero badge fixed; Latin Extended shipped |
| N9 | No CI library-vs-archive check; no `.gitattributes`; invalid focus-colour citation | Adopted: check (0), `.gitattributes`, citation removed |

## Verification record (2026-11-15, this branch)

| Check | Result |
| --- | --- |
| Independent archive rebuild (`base64 -d`, not the unpack script) | SHA-256 e7e93dde…3638, 3,197,548 bytes, 150 members, CRC clean. `diff -r` against the library: identical (control: it fires on a one-byte edit) |
| `npx vitest run` with `TEST_DATABASE_URL` (local Postgres 16) | 26 files, 534 tests passed, 0 skipped |
| `npx vitest run` without a database | 388 passed, 146 skipped (database suites). Baseline: 239 passed, 146 skipped |
| `npm run check:tokens` | Tokens OK (72 files) |
| `npm run lint` | 0 errors, 5 warnings (the same 5 as baseline) |
| `npm run build` | Built |
| `npx playwright test` (4 viewports, axe, local Postgres) | 31 passed, 9 skipped (specs that run at one viewport by design). The first run failed "controls with no name" on the header link, because the check does not read the lockup's alt. Fixed with an explicit link label, not by changing the check |
