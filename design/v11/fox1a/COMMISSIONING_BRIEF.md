# Positive Percy — Fox 1A illustration commissioning brief

| | |
|---|---|
| Version | 0.1.0 |
| Issued | 23 November 2026 |
| Owner | Positive Percy (the owner commissions and approves; engineering prepared this brief) |
| Status | Ready to send to an illustrator once the owner approves it. No artwork has been made. |
| Companion files | `design/v11/fox1a/asset-manifest.json` (keys, exports, blockers), `design/v11/review/fox1a-production-board.html` (visual board) |

## 1. What we need, in one paragraph

A clean, layered, curve-based vector redraw of our existing mascot, Percy the fox (we call this version "Fox 1A"), that matches the approved artwork exactly. Then eight new poses of the same character, drawn from that master. Then corrected versions of our stacked logo files. This is a faithful redraw and extension of an approved character, not a redesign.

## 2. What we can send you

| File | What it is | Limits |
|---|---|---|
| `approved-1A-source-crop.png` (341 × 435 px) | The approved artwork, cropped from the board it was chosen on | Small. A "1A" label and three callout lines sit over it. The paws are cut off at the bottom edge. |
| `fox-1a-symbol-full.svg` | An automatic trace of that crop, used in the app today | Straight line segments only, no curves; the body is one shape. Use it for proportions, not as linework. |
| The 12 current logo files (symbol, horizontal and stacked lockups, in full colour, purple, black and reverse) | The current brand set | All are built on the same trace. The stacked lockups cut off the bottom of the "y" in Percy. |
| `FOX_1A_LOGO_USAGE_GUIDE.pdf` | The usage guide | — |

The board the crop came from (`Positive Percy Fox Logo Refinement Board.png`) and any original design file are not in our repository. **If the owner can supply either, send it first: it is the better reference.**

## 3. Character rules (all deliverables)

Keep exactly:

- Upright, slender seated silhouette; head tilted up towards the star.
- Long pointed muzzle; closed, smiling eye; two tall pointed ears with light inner areas.
- White belly and chest.
- The tail grows to the **left** and curls up, with the white swoop marking inside it.
- One yellow star with three short rays.
- Flat colour, no outlines, no gradients beyond the subtle one on the body (to be confirmed, see section 7).

Never:

- Mirror the fox, or redraw it from a generic fox, from the older fox-with-foliage drawing, or from "Fox 1B".
- Add extra stars, sparkles or text to the artwork.
- Use AI-generated images as a source or as a deliverable.

## 4. Deliverables

### 4.1 Master (first, approved before anything else)

`fox1a.seated`: the existing seated pose, redrawn cleanly in curves, with the paws complete.

- Layered and named: `head`, `ear-left`, `ear-right`, `eye`, `muzzle`, `body`, `belly`, `leg-front-left`, `leg-front-right`, `leg-back`, `tail`, `tail-marking`, `star`, `rays`. Each limb, the head and the tail must be a separate group, so they can be posed and animated.
- Must overlay the approved crop with no visible difference at 96 px and at 400 px.

### 4.2 Poses (after the master is approved)

| Key | Pose | Used for | Status |
|---|---|---|---|
| `fox1a.walking` | Four-legged walking stride, head gently up, tail flowing behind | Children progress journey | Approved concept |
| `fox1a.leaping` | Airborne full-body leap, legs extended, reaching for the star | Weekly milestone, bigger goal reached | Approved concept |
| `fox1a.reaching` | Standing on hind legs, front paws reaching up | Goal completed, achievements | Approved concept |
| `fox1a.peeking` | Head and forepaws peeking around an edge (cropped at the edge) | Empty states, onboarding, website | Approved concept |
| `fox1a.resting` | Curled up asleep, calm expression | Quiet moments, nothing scheduled | Approved concept |
| `fox1a.waving` | Seated as the master, one front paw raised in a wave | Home greeting, onboarding welcome | Owner priority (23 Nov) |
| `fox1a.celebrating` | Upright, both front paws up, tail high, star above | Award points, reward redeemed | Owner priority (23 Nov) |
| `fox1a.pointing` | One paw pointing to the side, towards a piece of the screen | Help, tips | Owner priority (23 Nov) |

Not commissioned now: thinking, encouraging and reward-time (reuse other poses).

### 4.3 Logo repair

Re-export the four stacked lockups (full colour, purple, black, reverse) with clear space under the wordmark so the "y" is not cut off. Use clean wordmark outlines; the current traced letters are rough at large sizes. **Do not change the lettering or the layout.**

### 4.4 Files for every master and pose

- Editable source: layered SVG with named groups, plus the native file (AI, Figma or Affinity).
- Optimised SVG: transparent, no embedded images, no text, cropped to the figure with even clear space.
- PNG, transparent: 256, 512 and 1024 px on the long edge. WebP, transparent: 512 px.
- A proof sheet for each pose: beside the seated master at the same height; face and tail close-ups; at 48 px, 96 px and 208 px on cream `#FFF6E8`, white and purple `#4B1D8C`.

## 5. Motion (optional add-on, after the poses)

The app animates whole SVG groups with CSS, so the layered poses are enough. If quoted separately: short one-shot loops for the welcome wave, award response, goal check, weekly milestone, reward redeemed and bigger goal reached, plus a resting idle loop, each 0.7 to 2.4 seconds. Supply them as Lottie JSON, with GIF/WebP/MP4 exports for marketing and a still frame for each. Storyboards are on the production board.

## 6. Acceptance

Each item is accepted by the owner, in this order: master, then each pose, then logo repair. A pose passes when it passes every rule in section 3 at 48 px and at full size. Until a pose is accepted, the app keeps showing the seated master in its place.

## 7. Decisions the owner makes before sending

1. Star colour: `#FFA600` (as in the current trace) or `#FFC938` (palette "sunshine").
2. Inner areas: white or cream `#FFF6E8`.
3. Body: keep the subtle orange gradient (`#FF6A00` → `#FF5200`) or flat `#FF6A00`.
4. Rights: the contract assigns full commercial rights in the master, poses and source files to the owner.
5. Budget and timeline.

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-11-23 | First issue, from the P1 board and the owner's review of 23 Nov (layered master, five approved poses plus waving, celebrating and pointing, stacked-logo repair, keep the approved mascot colours until the master is reviewed) |
