# Positive Percy — Fox 1A Additional Pose Library

**Decision:** PROVISIONALLY LOCKED for implementation  
**Recorded:** 16 November 2026  
**Source of truth:** approved **Fox 1A** (left-hand fox from the 14 November 2026 refinement board); see `FOX_1A_LOGO_USAGE_GUIDE.pdf` in the Positive Percy project library.

## Purpose and status

These are **five approved pose concepts for now**. They are not a new logo or a replacement mascot. The owner has explicitly approved proceeding with these concepts and retains the right to replace individual illustrations later without changing their app integration points.

Previous AI-generated pose boards are exploration **only**: do not treat those boards, their invented details, or the generic fox as the certified Fox 1A vector master. No independent final vector artwork for the five new poses is represented as completed by this record.

## Locked pose concepts

| Stable ID | Name | Required pose/silhouette | Intended contexts |
|---|---|---|---|
| `walking` | Walking Percy | Four-legged walking stride; head gently angled up; signature tail flows behind | Progress, goals journeys |
| `leaping` | Leaping Percy | Clearly airborne full-body leap; legs extended; reaching towards the approved single yellow star | Milestones, celebrations |
| `reaching` | Reaching Percy | Standing on hind legs; front paws reaching up | Goals, achievements |
| `peeking` | Peeking Percy | Character and forepaws peeking around edge; genuine off-edge composition | Website banners, empty states, marketing accents |
| `resting` | Resting Percy | Clearly curled-up sleeping silhouette, calm expression | Quiet moments, gentle reassurance |

**Baseline:** original seated Fox 1A stays the unchanged primary brand mascot and logo. Do not name a generated concept pose “original” or substitute an approximation.

## Non-negotiable identity constraints

- Preserve approved Fox 1A **pointed muzzle/face, distinctive ears, slender silhouette, expression language, white belly and tail markings, and direction/shape of the tail** in anatomically appropriate views.
- Exact source-traced master is the fidelity reference; **never** redraw from generic fox prompts, the old fox-with-foliage, or Fox 1B.
- Core colours from the logo usage guide: purple `#4B1D8C`, orange `#FF6A00`, yellow `#FFC938`, cream `#FFF6E8`; white accents remain white.
- The **primary logos, icon variants, official wordmark and original seated mascot** must remain unchanged. Character poses are secondary editorial/UI illustrations, not logos.
- For brand continuity use the single yellow star concept; extra sparkle overlays are separate UI decoration, not a new set of brand symbols.
- Any final pose that fails source fidelity should use the original Fox 1A artwork as a temporary safe fallback, not an invented new mascot.

## Engineering integration contract

Expose stable semantic illustration keys: `fox1a.walking`, `fox1a.leaping`, `fox1a.reaching`, `fox1a.peeking`, `fox1a.resting`. Resolve each key through a central asset manifest/component rather than hardcoding file paths in screens.

Suggested *future* asset locations (not evidence files exist):
- `public/assets/brand/fox1a/poses/<id>.svg` for validated SVGs
- `public/assets/brand/fox1a/poses/<id>.png` as transparent raster fallback

Render with correct aspect ratio and accessible alternate text when informative; hide purely decorative instances from assistive technology. No text baked into artwork. Pose graphics should not alter business logic, points semantics, or status messaging.

**Replaceability rule:** a future artwork revision may change the resolved asset for an existing key without changing UI usages. Version artwork in the asset manifest; retain the stable keys.

## Release gate

1. Locate/source the approved Fox 1A master vector from the locked brand asset set.
2. Produce distinct silhouettes and make a side-by-side fidelity review against the actual master.
3. Export verified, transparent production assets in SVG and PNG, with source attribution/asset manifest.
4. Wire them via stable keys and verify desktop/mobile crops; obtain final owner visual sign-off.

**This record locks the five pose decisions and their use cases, not a claim that the new artwork has passed production QA.**
