# Positive Percy V1.1 — design foundation (P0 to P2)

| | |
|---|---|
| Version | 0.1.0 |
| Issued | 23 November 2026 |
| Owner | Percy V1.1 design engineering |
| Status | **For owner visual approval.** Design files only. Nothing here is imported by `src/`, built into `dist/`, or deployed. |
| Brief | `docs/design/PERCY_V11_CLAUDE_CODE_EXECUTION_HANDOVER.md` |

## Open these first

Self-contained pages (fonts, icons and the Fox 1A file are inlined; they work offline):

| Page | What it is |
|---|---|
| `review/fox1a-production-board.html` | Fox 1A: what exists, fidelity check, size tests, pose briefs, motion storyboards, blockers |
| `review/component-showcase.html` | Type, colour, spacing, photo rules and all ten components in every state |
| `review/home-children.html` | Working Home and Children prototype (synthetic data, no API) |

Screenshots: `evidence/after/` (six widths, edge cases, 200% text), `evidence/before/` (V1 run locally with a sample family), and `evidence/before-after-*.png`.

## Files

| Path | Purpose |
|---|---|
| `P0_SOURCE_INVENTORY.md` | Source inventory and Fox 1A fidelity record |
| `HANDBACK.md` | The handback report (sections A to F of the brief) |
| `fox1a/asset-manifest.json` | Stable `fox1a.<pose>` keys, provenance, export spec, motions, rights, blockers. The board renders from this file. |
| `tokens/percy-v11-tokens.css` | The single token source |
| `components/percy-v11-components.css`, `.js` | Component styles and renderers shared by the showcase and the prototype |
| `src/` | Page sources with `{{…}}` placeholders |
| `build.mjs` | Inlines repo assets into `review/`. Refuses to build if the Fox 1A file's hash or path data changes. |
| `qa/run-qa.mjs` | Browser checks; writes `evidence/qa-report.json` and the screenshots |

## Rebuild and check

```bash
npm ci
node design/v11/build.mjs
node design/v11/qa/run-qa.mjs
```

Query strings for the prototype: `?children=1..6`, `?long=1` (long first name), `?child=c1..c6`.

## What this is not

- Not the React implementation (P3 starts after approval).
- Not new fox artwork. Every fox shown is `public/brand/fox-1a-symbol-full.svg`, unaltered.
- Not real data, and no photographs. A photo appears only if the reviewer picks one from their own device; it stays in that browser tab.
- The sun, hill, clouds and flag are simple code-drawn shapes that stand in for the look. They are not illustrator artwork.

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-11-23 | First issue: inventory, Fox 1A board and manifest, tokens, components, showcase, Home and Children prototype, QA script and evidence |
