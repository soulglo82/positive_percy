# E01 + E02 design: asset provenance, Percy tokens, fonts, Fox 1A logo and app icons

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-15 |
| Owner | Percy v2 engineering (integration branch `claude/percy-v2-engineering-handover-f5ya53`) |
| Status | Built on the integration branch; not merged, not deployed |
| Parent plan | `docs/engineering/PERCY_V2_IMPLEMENTATION_PLAN.md`, tickets E01 and E02 |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-15 | First design, written for peer review before the build |
| 1.1 | 2026-11-15 | Peer-review findings adopted (see "Peer review record") |

## 1. Contract being repaired

The app has one colour/type/brand source of truth: `src/lib/tokens.js` (hex), mirrored as HSL channels in the `:root` block of `src/index.css` and consumed only through `tailwind.config.js`. `scripts/check-tokens.mjs` rejects any colour, size or weight that isn't a token, and `src/test/tokens.test.js` checks parity plus contrast. Today that source holds the interim Batch D brand: orange `#c2410c`, Figtree/Fredoka, the old raster mascot `public/logo-mark.png`.

E02 swaps the brand values inside that same contract. It adds no second source, so every route picks up the new brand through the existing semantic names. E01 adds a provenance manifest so every runtime brand file can be traced to the verified 150-file pack.

## 2. Code paths touching the contract (enumerated)

| Path | What changes |
| --- | --- |
| `src/lib/tokens.js` | Values remapped (table in section 3) |
| `src/index.css` `:root` | HSL mirror; `@font-face` swapped to Nunito and Poppins |
| `tailwind.config.js` | `fontFamily`, `fontWeight` (`bold` 700, `extrabold` 800) |
| `scripts/vite-tokens-plugin.js` | Unchanged code; `theme_color` follows `TOKENS.primary` (now purple) |
| `manifest.base.json` | Icons: kit PWA 192/512 plus maskable 512 |
| `index.html` | Favicon (svg, ico, 32 png), apple-touch-icon, font preload |
| `src/components/brand/Logo.jsx` | Renders kit SVGs; same props, plus `tone` |
| `src/components/brand/PointsStar.jsx` | Unchanged shape (star master is a separate open item); colour follows `--star` |
| 14 `font-display` headings | `font-semibold` becomes `font-extrabold` (page titles) or `font-bold` (section titles) |
| `src/components/child/ChildAvatar.jsx` (kid-4 consumers) | Display colour only; `colour_index` storage untouched |
| `src/lib/familyReport.js` | **Not touched.** It already uses `#4B1D8C`; brand alignment for the report is E12 |
| Server, DB, migrations | **Not touched** |

## 3. Semantic token mapping

Sources: plan section "3. Locked brand system" (six palette values) and the reviewed v2 prototype `design/previews/percy-v2-full-review.html` `:root` (supporting tints `plum`, `lav`, `amber`). No new hue families.

| Token | Old | New | Source |
| --- | --- | --- | --- |
| background | #fbf6ee | #fff6e8 | warm cream |
| card, popover | #ffffff | #ffffff | white |
| muted, secondary | #f3f1ec | #f9f3ff | prototype `lav` |
| accent | #e9e5dc | #e5dcea | fine lilac |
| foreground (and the four `*-foreground` text aliases, negative, warning-foreground) | #1f1b16 | #271737 | ink |
| muted-foreground, subtle-foreground, spend, input | #5e554a / #6b6257 / #8a8073 | #594e69 | prototype `plum` |
| primary, ring, selected-border, brand-ink | #c2410c / #1e3a5f | #4b1d8c | purple |
| primary-hover | #9a3412 | #271737 | ink (darker step without a new hue) |
| selected | #fde4d3 | #f9f3ff | prototype `lav` (active nav: purple on lav) |
| star | #e8a317 | #ffc938 | sunshine |
| star-soft, warning | #fdf0d0 / #fff4e5 | #fff1d1 | prototype `amber` |
| border | #e6e1d8 | #e5dcea | fine lilac |
| overlay | #1f1b16 | #271737 | ink |
| chart-2 | #1e3a5f | #4b1d8c | purple |
| chart-4 | #5e554a | #594e69 | plum |
| earn, earn-soft, destructive, warning-border, chart-1/3/5, kid-1/2/3/5/6 | unchanged | unchanged | functional meanings, not brand |
| kid-4, kid-4-soft | #7d3c8f / #f1e2f5 | #193466 / #dde3f0 | see 3.1 |

### 3.1 Deviations from the prototype, and why

* **Earned green stays `#2a6e33`.** The prototype's `#176543` sits at ΔE 25.3 from child teal `kid-3`. The existing invariant needs more than 35, so earned points and a child's identity stay distinguishable.
* **kid-4 changes from plum to navy.** Plum `#7d3c8f` sits at ΔE 22.8 from the new brand purple. The invariant is that a child's identity colour must not read as the primary action colour, and it needs more than 35. Navy `#193466` comes from a search over hue, lightness and saturation and passes every check: 4.5:1 or better on card, muted and background; ΔE of 26 or more from every other child; ΔE 41.6 from purple; and well clear of earn, destructive and orange. Colour is stored as `colour_index`, so this changes **display only**: no row is written and no index moves. It is user-visible, so it goes into the owner visual sign-off list.
* **Orange `#FF6A00` is not a token in this pass.** It is 2.87:1 on white and 2.68:1 on cream, so it fails text and focus-ring contrast. The kit's own `--percy-focus-color` is purple. Orange enters the app only inside the logo artwork. If a decorative orange token is needed, E03 or E07 adds it with a "never text" test, the same way `star` is handled.
* **The test "active nav is not orange on selected" is replaced, not deleted.** It guarded the old orange primary, which failed 4.24 on its tint. The new invariant is purple on lav, active label at 4.5 or better, and the test asserts that instead.

## 4. Fonts

* Nunito 700/800 and Poppins 400/500/600: Latin subset WOFF2 from `@fontsource/nunito@5.3.0` and `@fontsource/poppins@5.3.0` (SIL OFL 1.1). The files are copied byte for byte into `public/fonts/` with the packages' `LICENSE` as `OFL-nunito.txt` and `OFL-poppins.txt`. Figtree and Fredoka files and notices are removed.
* `fontFamily.sans` is Poppins and `fontFamily.display` is Nunito, each with system fallbacks. Preload Poppins 400, which is the body text.
* `fontWeight`: `bold` 700 and `extrabold` 800 exist **only for Nunito**. Poppins ships no 700, and a bold request on Poppins would make the browser synthesise a faux bold.
* **Guard:** a test scans `src/**/*.jsx` and fails when a class string has `font-bold` or `font-extrabold` without `font-display`. Counter-example: `<p className="font-bold">` fails (fixture). Not covered: a weight passed through `cn()` from a separate variable, or a parent applying `font-display` while a child adds `font-bold`. The second case is safe, because Nunito is inherited. The first case is caught by the existing "built from a variable" rule in check-tokens.
* **Reverse direction:** `font-semibold` on Nunito resolves to the 700 face. 600 isn't shipped, and CSS font matching picks the next heavier weight, so nothing is synthesised.

## 5. Logo and icons

* **Runtime copies, byte-identical,** go under `public/brand/`: `fox-1a-symbol-full.svg`, `positive-percy-horizontal-full.svg` and `positive-percy-horizontal-reverse.svg` (the kit README's "Required integration" files). App icons follow the same README: `public/icon-192.png`, `public/icon-512.png` and `public/maskable-512.png` from `PWA/`; `public/apple-touch-icon.png` from `PWA/`; `public/favicon.ico`, `public/favicon.svg` and `public/favicon-32.png` from `Web/`.
* **Rendered with `<img>`, not inlined.** The SVGs share the gradient id `fox1a-orange`, and inlining two of them on one page would collide. A static scan of the copied SVGs finds no `<script>`, `href`, `<image>`, `foreignObject`, `@import` or event handler; the only `url(...)` is the internal gradient. A test enforces this.
* **`Logo` props stay compatible:** `size`, `wordmark`, `decorative`, `className`, plus a new `tone` (`full` or `reverse`).
  * Symbol only: the height is `size`, and the width is `round(size*365/459)`, the kit's aspect ratio.
  * `wordmark`: the horizontal lockup at height `size`, with width from 1350/380. The lockup is an image of text, so it carries `alt="Positive Percy"`. Previously the alt was empty and the name was HTML text. The header call sites change `size={32}` to `size={40}` so the lettering stays legible.
  * `decorative`: `alt=""` and `aria-hidden`.
* **Cache-busting:** `?v=3` on icon and manifest links, because installed PWAs cache icons aggressively.
* `logo-mark.png`, `logo.png`, `logo_old.png` and the old icons are deleted from `public/` once nothing references them (`grep` control in the test plan). Git history preserves them. The Batch D icons are overwritten in place at the same paths.

## 6. E01 provenance manifest

`design/brand/RUNTIME_ASSETS.json` holds one entry per runtime brand file: `runtime` path, `source` path inside `design/brand/library/...`, `sha256`, and `licence` (`owner-approved Fox 1A trace; fidelity sign-off pending` or `SIL OFL 1.1 via @fontsource 5.3.0`).

The test `src/test/brandAssets.test.js` checks four things:
1. Every manifest entry's runtime file hash equals its source file hash, which equals the recorded `sha256`.
2. Every file under `public/brand/`, every `public/*icon*`/`favicon*` file and every `public/fonts/*` file is listed in the manifest, so no untraced runtime asset exists.
3. No file under `public/` matches a legacy asset name (`logo-mark.png`, `logo.png`, `logo_old.png`, `figtree-*`, `fredoka-*`).
4. Every SVG in `public/` passes the active-content scan.

**Counter-examples (all executable in the test):** editing one byte of `public/brand/*.svg` fails (1); adding `public/brand/stray.svg` fails (2); recreating `public/logo-mark.png` fails (3); an SVG with `<script>` fails (4, by fixture).

**Not covered:** visual fidelity of the trace at small sizes. That is a human check on the screenshot evidence below, and stays on the owner sign-off list.

The 150-file archive check (SHA-256 and count) runs in the existing `scripts/brand/unpack-stage1-brand-pack.py`. For this session it was also verified independently: the parts were rebuilt with `base64 -d`, which gave a matching SHA-256 `e7e93dde…3638`, 3,197,548 bytes and 150 members with zero CRC failures, and a `diff -r` against the committed library was identical. The diff was shown to fire on a one-byte edit.

## 7. Edge cases (triggering input → expected outcome)

| Input | Expected |
| --- | --- |
| Child with `colour_index = 3` | Renders navy; DB row unchanged |
| Child loaded before migration 010 (no index), fourth oldest | Navy, by fallback order; unchanged logic |
| `Logo size={16}` symbol | 13×16 image, no distortion (explicit width and height) |
| `Logo wordmark tone="reverse"` on a light background | Developer error. White text would be invisible, so a dev-mode `console.warn` fires when `tone="reverse"` is used without the `wordmark`/symbol on purple. Docs state the contract. No call site uses reverse yet |
| Offline first load, font not cached | `font-display: swap` shows the system fallback, with no invisible text |
| Font file 404 (deploy missing `public/fonts`) | Fallback stack renders; the build test asserts the files exist |
| Old installed PWA | New icons on the next manifest fetch; `?v=3` forces it |
| Browser without SVG favicon support | `favicon.ico` and the 32px PNG are linked as well |
| `font-bold` on body text | Test fails (section 4 guard) |

## 8. Abuse cases

* **Malicious SVG in a future kit update** is blocked by the active-content scan test, and SVGs are served as `<img>`, which never runs scripts anyway.
* **A swapped runtime asset that isn't the approved art** fails the hash parity against the library, and the library is checksum-pinned to the archive.
* **Third-party font CDN tracking** can't happen, because fonts are self-hosted and no Google Fonts request is made. The prototype's `@import` is deliberately not carried over.

## 9. Outcome records

Screenshot evidence goes under `docs/engineering/evidence/e02/`:
* the header, the login and the dashboard at 390 px and 1280 px, before and after;
* a favicon strip at 16/32/48/64;
* the 1A reference beside the installed render.

## 10. Test plan

* `npm test`: the whole suite, including the updated `tokens.test.js` (parity, contrast pairs and the new pairs) and the new `brandAssets.test.js`.
* `npm run check:tokens`, `npm run lint`, `npm run build`.
* The existing Playwright `ui` job runs in CI on the PR head (axe included).
* **Not covered by any automated test:** the perceived fidelity of the traced Fox at 16 px, and whether the purple-dominant look matches the owner's intent on every route. Both are owner visual sign-off items. Routes are restyled by tokens only; per-screen v2 layouts are E07.

## 11. Rollout and reversal

There is no deployment in this ticket. The work sits on the integration branch and builds on PR #50's head. Reverting is one `git revert` of the E02 commit, because the change has no data, schema or server effect. Before any production release, the plan's W9 gates still apply.

## 12. Out of scope (owned by later tickets)

* E03: icons and illustrations, including the Phosphor package and the treasure map behind the licence gate.
* E06: the reward picker.
* E07: per-screen v2 layouts.
* E12: Family Report and Framer.
* The dedicated points-star master, which is not approved. The Lucide star stays and is recoloured to sunshine. This remains a release blocker, as the plan states.

## Peer review record

The fresh-context review of v1.0 raised findings, and v1.1 answers them:

| # | Finding | Disposition |
| --- | --- | --- |
| R1 | (filled after review) | |
