# Positive Percy — Fox 1A complete logo assets

**Approved direction:** Fox 1A, specifically the LEFT fox on the original refinement board. The vector source was extracted from that board's large, approved artwork — not from a redrawn substitute.

## What is included

- `01_Source_And_Proof/`: Approved 1A image crop, independent vector preview, side-by-side source comparison, multi-version contact sheet.
- `02_SVG_Masters/`: Transparent motif, original-board outlined wordmark, horizontal, stacked and one-colour masters. **These SVGs contain genuine vector paths**, no bitmap embedding, web fonts or external image dependencies.
- `03_Transparent_PNG/`: Transparent full colour, black, purple, white logo variants in multiple display sizes.
- `04_App_Icons/`: All three approved 1A app treatments: vivid orange square/white fox; cream square/orange fox with border; purple circular orange-and-cream fox. iOS icon, Android launcher/adaptive foreground, PWA manifest icons, favicon SVG/ICO, Apple touch icon, Safari mask icon.
- `05_Website_And_Social/`: Website header/footer, profile pictures, Open Graph 1200×630, cover and banner graphics.
- `06_Print_And_Documents/`: Print-friendly full-colour and one-colour SVGs for letters, reports, PDF layouts, signage and stationery.
- `07_Handoff/`: Manifest, instructions, CSS/HTML usage snippets and versioning notes.

## Identity and usage

Original design from **Positive Percy Fox Logo Refinement Board.png**, upper-left 1A, NOT 1B. The 1A mark has the upright/slender fox, tilted muzzle and closed smiling eye; tail grows to the LEFT, curled upward, with the same white swooping interior shape as the source. One yellow star and three rays. Wordmark paths are traced from the approved board's own logo lettering, not redrawn using a random font.

Palette: purple `#4B1D8C`, orange `#FF6A00`, sunshine `#FFC938`, cream `#FFF6E8`, ink `#271737`. Typography elsewhere: Nunito headings / Poppins body (font files handled by deployment pipelines, not distributed here).

## Source fidelity and transparency

These are traced outlines from an approved raster board. They are editable SVG **reconstructions** rather than a source-authored Illustrator/Figma master. All geometry is based on the board; there is no alternate fox design and no reuse of the earlier inaccurate image-generated fox. Antialiasing and simplified subpixel edges may differ slightly from the original, especially in tiny letterforms.

App icon colour variants are **treatments of the same 1A source**. Only the logo mark, opacity and backgrounds change; do not swap in 1B or draw the fox with a different tail.

## Required integration

- Use `02_SVG_Masters/positive-percy-horizontal-full.svg` for light website and product headers.
- Use `02_SVG_Masters/positive-percy-horizontal-reverse.svg` on purple/dark areas; this is transparent, so the enclosing background must be dark.
- Use `04_App_Icons/positive-percy-app-orange-white-1024.png` for iOS; Android launchers may use purple or orange based on installed theme.
- Set PWA `icons` to `04_App_Icons/PWA/icon-192.png`, `icon-512.png`, `maskable-512.png` with proper public paths and `purpose: maskable` on the maskable file.
- Use `04_App_Icons/Web/favicon.ico` and `/favicon.svg`, and `PWA/apple-touch-icon.png`.
- Use one-colour black vector for monochrome print; reverse white vector on dark documents.
- SVGs are authored in px viewBoxes; vector paths scale to any print resolution.

**Do not edit source mascot geometry for different placements.** The approved 1A artwork is shared by every variant.
