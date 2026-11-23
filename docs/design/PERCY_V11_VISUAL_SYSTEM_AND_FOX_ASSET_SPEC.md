# Positive Percy V1.1 — Finish the actual design system (owner feedback 23 Nov 2026)

**Status:** Design-specification workstream. Owner has endorsed the broad Home/Children responsibilities, **not** approved the current visual finish. Keep V1 production unchanged. Tracks #66 and draft #71.

## A. What has been observed in the current #71 HTML (not a guess)
- The child selector currently renders the child's **initial letter** inside `<span class="face">`, not a photo. Photo-first selection must be designed using the existing V1 child-photo field when wired to real app state, with a meaningful initials fallback. No fake stock/AI photos.
- `Quick Points` labels are **10px**, reducing to **9px at 360px and below**. This is too small for primary actions and must not ship.
- Hero / body / controls rely on assorted one-off sizes and positions; need a semantic, testable type/spacing system before adding more pages.
- Current Fox artwork is the **unaltered original SVG used as an image**. No approved expressive pose library or animations have been produced; showing the logo asset again does not complete the character system.

## B. Typography proposal for owner approval

Use the already-approved **Nunito 700/800 headings**, **Poppins 400/500/600 body**; retain approved brand colours and 44px minimum hit areas.

| Semantic role | Mobile | Tablet / desktop | Typeface | Intended usage |
|---|---|---|---|---|
| Editorial hero | 32/38px | 44/52px | Nunito 800 | Home/Children feature headline |
| Page title | 28/34px | 34/42px | Nunito 800 | First-level screen heading |
| Section title | 22/28px | 26/32px | Nunito 800 | Goals, points, achievements |
| Card title | 18/24px | 20/26px | Nunito 700 | Named rewards, child summary |
| Main body | **16/24px** | 16/24px | Poppins 400 | Core descriptions, goal names |
| Supporting body | **14/20px** | 14/20px | Poppins 400 | Evidence labels, supporting detail |
| Action/button label | **15/20px** | 15/20px | Poppins 600 | Quick Points, Complete, Manage |
| Overline/metadata | 12/16px | 12/16px | Poppins 600 | Only non-essential labels |
| Important number | 28–40px | 36–52px | Nunito 800, tabular | Points/progress counters |

**Never shrink interactive labels to 9/10/11px to fit four columns.** At narrow widths use a **two-column Quick Points grid** or a horizontally scrollable, labelled action rail; retain full names. Keep support text no smaller than 14px where readability matters. 320px designs must pass at browser zoom / larger text settings. Empty and long-name states cannot clip.

Alignment rules: align the primary header and body content to one mobile content edge; use a consistent 8px spacing cadence (with 4px substeps). Titles align to the content container, and number/ring legends align consistently with their own data. No arbitrary 1–4px variations without a component reason. Do not change previously locked **centred Activity 'This week' figures**.

## C. Child image component specification (photo first)

- **Selected child on Home selector:** **64–72px visible round photo** at phone widths, with a strong high-contrast name/selected state beside it; 48–56px for unselected child chips where space permits.
- **Children profile hero:** **96–112px visible round photo** on phones, approx. 120–144px on wider layouts.
- Use existing authorised stored child photos; do not invent or download photos. Render **initials fallback** at same dimensions when photo missing, failed, or not yet loaded. Set `object-fit:cover` with safe focal default, respect original aspect ratio, and avoid cropping off faces if focal metadata is available.
- **At 320px:** do not shrink all three children to illegible chips. Use a horizontally scrollable selector or selected child + overflow selector; each clickable surface stays ≥44px. Test 1/2/3/6 children, very long names, no photo and failed image.
- Child photo is meaningful identity content, and is never replaced by a tiny decorative circle or a generic AI-generated portrait.

## D. Fox 1A art-production system

**Locked original:** seated Fox 1A and primary wordmark/logo. Do not change facial shape, pointed muzzle, ears, slender silhouette, white belly, tail **direction** and distinct white marking, colours or single-yellow-star motif. Checked-in `public/brand/fox-1a-symbol-full.svg` is a board-derived trace rather than the illustrator's certified master; first verify the exact source and owner's visual fidelity. Preserve existing approved logo exports rather than creating independent reinterpretations.

**Package 1 — identity exports (reuse same approved master):**
Primary horizontal and stacked lockups, mascot-only symbol, dark/light variants, favicon/PWA sizes, mono variants, printable SVG/PDF and web-ready transparent PNG/WebP. Include clear-space and min-size rules; provenance, hashes and filename manifest. No silent logo redesign.

**Package 2 — illustration poses (deliver EDITABLE independent vector artwork):**
- **Already provisionally approved:** `walking`, `leaping`, `reaching`, `peeking`, `resting` (source: `docs/brand/FOX_1A_POSE_LIBRARY.md`).
- **New proposals, require owner selection:** `waving`, `celebrating`, `pointing`, `encouraging`, `thinking`, `reward_time`. Reuse a pose with alternate crop instead of needless duplicated art.
- Required use contexts: Home greeting, Today's Goals, award points, bigger-goal journey, earned reward, first-run onboarding, error/empty state, milestone, weekly achievement.
- Compare original beside each proposed full-body pose. Face/tail close-up fidelity crops mandatory; no generic fox substituting approved 1A. No AI-generated artwork as production asset.
- Asset pipeline: editable SVG source + optimised transparent SVG and PNG/WebP exports; 48px/96px/fill-hero proof sizes, accessible alt rules and metadata/rights manifest. Store versioned assets in GitHub under `public/assets/brand/fox1a/` with semantic registry; do not assume files already exist.

**Package 3 — motion / animation (app-native first, GIFs as exports):**
1. Welcome wave/peek loop (gentle, e.g. ~2s).
2. Award-point happy bounce/one-star effect (single short response, not compulsive loop).
3. Today's Goal check celebration (short, one-shot).
4. Weekly milestone cheer / leap (short, one-shot).
5. Reward redeemed celebration (short, one-shot).
6. Bigger goal achieved / finish-line moment (short, one-shot).
7. Resting / idle loop (sparing use).

Prefer composited SVG/CSS or approved vector animation source for the app, with GIF/WebP/MP4 exports for marketing or fallback where needed. No copyrighted non-original motion art. Supply static fallback and `prefers-reduced-motion`; keep accessible and performance-conscious. The exact motion format/codec is an engineering choice, not an unapproved product capability.

**Commercial/licensing:** use source-verified artwork, confirmed licences, attribution where applicable, and a traceable manifest. Streamline/Freepik assets remain gated as already documented. AI concept artwork is not launch-ready without redrawing/independent approval.

## E. Layout and component completion gate

Before extending beyond Home and Children:
1. A shared design token file for type, spacing, surfaces, borders/radii, shadow, motion and imagery.
2. Component catalogue for header, child photo/chips, Quick Point tile, Today's Goal row, larger-goal destination, progress ring, milestone banner, manage-action, reward card and app nav; consistent internal padding/alignment.
3. Real responsive previews at **320,359,360,390,834,1280px**, browser zoom and increased text settings; no clipping, overflow, hardcoded 9px label workarounds.
4. Source-based icon, Fox and photo audits including empty/missing-photo/failed-image states.
5. Visual owner approval of **Home and Children at mobile and desktop** after the asset and typography decisions, BEFORE copying the system to Activity/Rewards/Settings.
6. Preserve current V1 business logic and server-owned balances; keep design work on isolated branches until explicit owner release approval.

**Owner direction:** Distinct responsibilities are broadly promising. Do not treat the current HTML prototype as final design approval; rebuild the visual hierarchy and photo component with real source-backed artwork and explicit type rules.
