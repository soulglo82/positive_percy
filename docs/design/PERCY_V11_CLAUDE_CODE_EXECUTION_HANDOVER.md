# Positive Percy V1.1 — Claude Code execution handover
**Owner direction:** 23 November 2026. **Status:** DESIGN PREPARATION ONLY — no merge, production deployment, or expanded feature scope.  
**Tracking:** issue #66; design PR #71; prior specification `docs/design/PERCY_V11_VISUAL_SYSTEM_AND_FOX_ASSET_SPEC.md`.  
**Live V1:** Leave untouched. This work must remain isolated.

## Primary goal
Finish a **distinctive, premium visual system**, not another V1 card reskin or a synthetic image-generation mockup. The owner broadly likes the bright illustrated Adventure World combined with B/Progress Studio’s stronger editorial typography. The owner accepts the **functional distinction** of Home (daily actions) and Children (progress/management) as promising, but **has not approved either screen's finished styling**.

### Owner feedback to address explicitly
1. Current HTML still looks similar to V1. A working UI is not equivalent to a polished new design.
2. The displayed Percy is the original static **Fox 1A logo asset**. A full, source-faithful logo, illustration **and motion/GIF** family is still missing.
3. Font sizing, line-height, spacing, baseline alignment, component dimensions and positions are inconsistent; some prototype Quick Points labels were 9–10 px.
4. Child photographs are far too small or replaced by initials. Use existing user-provided child photos **where authorised**, with prominent responsive image treatment, initials fallback. Do not invent stock/AI photos.

## Role split
**Claude Code — lead integration/design engineering:** audit source, establish design tokens and showcase, create isolated code prototypes, capture real responsive screenshots, test, prepare handback. Do not represent AI-generated illustrations as shipping assets.

**Illustration/vector production:** Requires a source-faithful original editable Fox 1A master and potentially human illustrator/vector tracing. If source is insufficient, record a blocker and deliver artwork briefs/pose boards, not an invented 'approved' mascot. Fox source tracing in GitHub is not certified original illustrator vector.

**Codex — independent reviewer:** review completed assets/component conventions and the React PR after the owner picks the direction; identify fidelity, layout, accessibility, data-semantic and regression issues. Codex must not concurrently edit Claude Code’s branch.

## Work packages (in order of approval; preparation can overlap)

### P0. Provenance and inventory — complete before drawing
- Review `docs/brand/FOX_1A_POSE_LIBRARY.md`, the approved Fox 1A refinement board/usage guide, `design/brand/library/Positive_Percy_Stage1_Brand_System/`, the latest live logo source and manifests.
- Inventory real master vectors, board-derived tracings, approved logo exports, locked colour/font/icon files, existing child-avatar photo pipeline, approved/uncleared Streamline/Freepik assets.
- Create a traceable master/fidelity checklist: facial expression, pointed muzzle, ears, proportions, orange/white colours, **tail direction and original marking**, single yellow star, primary wordmark, no mirroring.
- Identify gaps and rights/license status; do not infer cleared commercial-use licenses from the asset's presence in GitHub.

### P1. Fox 1A production-asset board — owner review required
- Preserve the official seated logo and its existing accepted variants; no redesign of brand master.
- Five provisionally approved **pose concepts**: walking, leaping, reaching, peeking, resting. Compare each proposed asset to exact original side by side.
- Propose additional waving, celebrating, pointing, thinking, encouraging and reward-time poses only as **new proposals**.
- Produce a comparison board with face/tail closeups and tests at small-size (48px), mid-size (96px), full hero sizes.
- Define art use cases for Home, goal completion, milestone, bigger-goal reached, award points, reward redeemed, onboarding, empty-state and help.
- Output an asset manifest with stable `fox1a.<pose>` IDs, provenance, reuse rules, editable vector source and required SVG/PNG/WebP exports. If exact final vector artwork cannot be obtained yet, mark **NOT SHIP READY**.
- Motion plan: greeting wave/peek loop, short award-point response, goal complete, milestone, bigger goal reached, reward redeemed, optional resting idle; offer vector/CSS/Lottie where valid plus GIF/WebP marketing exports, static/reduced-motion alternatives. Do not render animated generic fox variants.

**STOP GATE P1:** Owner reviews the fidelity and illustration/motion direction **before** new character artwork enters a production component.

### P2. UI tokens and component showcase — can proceed while P1 is sourced
- Preserve approved Nunito 700/800 headings, Poppins 400/500/600 body; document semantic text roles, font sizes, weights, line heights and responsive rules in an inspectable token source. Starting spec: hero 32px mobile, page 28px, section 22px, card 18px, body 16px, supporting 14px, actions 15px; refine for owner signoff.
- Semantic tokens: colour, radius, shadows, spacing grid, focus, input and buttons, illustration slots and motion. Use existing locked purple/cream/orange palette; accessible earned-green for completed/progress meanings.
- Component showcase: `ChildAvatar` (photo first), `ChildSelector`, `QuickPointTile`, `TodayGoalRow`, `PercyProgressRings`, `BiggerGoalDestination`, `AchievementBanner`, `ManageAction`, `AppNavigation`, `PercyHeroSlot`.
- **Avatar sizing target:** selected child 64–72px on phone, other children 48–56px, Children profile hero 96–112px, larger on tablet/desktop. Prefer real existing child-photo fields; no generated portraits. Keep name always readable, fallback initials same size, handle absent/broken photos and 1/2/3/6 children.
- Minimum 44px touch areas; no primary-action labels under 14–15px to squeeze four across. At narrow phones use two columns or a labelled scroller.
- Check screens at 320, 359, 360, 390, 834, 1280px; enlarged fonts and zoom; test long names/text, no child photo, no goals and full/over-target cases. No clipping, overflow or magic negative offsets.
- Render ring values from actual metrics only: daily completed/scheduled, weekly earned/target and selected **named goal** saved/cost; Available points is a balance, not a ring. Clamp the visual ring, never the displayed number; show neutral state if denominator zero.
- Ensure Home’s business actions / Child management semantics remain unchanged. Do not add a child login or independent child device.
- Visual benchmark: **compare a coherent Home/Children component composition to original illustrated inspirations**, not merely V1 with new colours or rings.

**STOP GATE P2:** Deliver source files + component board + screenshot evidence for owner **typography/spacing/photo/design** approval before integration across the app.

### P3. Real Home and Children React prototype — after P1/P2 design approval
- Home is the parent-operated **daily action centre**: child selection, Quick Points, Today's Goals, reward requests and available points.
- Children is the parent **planning/progress area**: weekly target, named savings, bigger-goal journey, achievements, edit goals/rewards/savings.
- Do not duplicate Quick Points and completion actions on Children. Do not create identical progress hero layouts on both.
- Use actual source-backed assets and existing V1 data flows, not hard-coded synthetic/demo numbers. Preserve server-ledger award/undo/idempotence and savings confirmations.
- Test production-equivalent browser accessibility, screenshots/overflow at all six widths, keyboard/contrast/reduced-motion and points/savings regressions.
- **STOP before merge or deployment.** Owner approves exact design and commit; then roll the agreed visual system through Activity/Rewards/Settings as a separate scoped step.

## Required handback from Claude Code, now
A single report including:
A. Source inventory and original-Fox fidelity gaps.
B. Proposed illustration/animation board with clearly flagged unapproved entries.
C. Typography, spacing and photo component showcase.
D. Interactive Home/Children concept with before/after screenshots at phone and desktop, and honest distinction from generated art.
E. Tests/QA evidence and outstanding licensing/art blocker list.
F. Exact branch/head/PR for design review. **No production merge.**

**Definition of success:** the owner sees an obviously more polished, coordinated Percy design, with real-source Fox 1A and photos, readable text, consistent spacing and clearly different Home versus Children. Shipping artwork and live integration are separate approvals.
