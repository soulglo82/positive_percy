# Positive Percy V1.1 — two tabs must serve two distinct jobs
**Date:** 23 November 2026  
**Status:** Owner visual review; synthetic interactive prototype only.  
**Prototype:** `design/previews/percy-v11-working-home-children.html`  
**Interactive preview:** https://chatgpt.com/space/page_228c34aae76481918d23253767383dae  
**Prior concepts:** A/B #70 and generated illustrated images remain style references, not production assets.

## Problem to solve
The owner liked the bright illustrated adventure style but rejected two essentially identical Home and Children screens. An image generator's output is not a functional UI specification. V1.1 should not add equivalent status dashboards under separate tabs.

## Recommendation: KEEP both tabs only with a strict responsibility split
**Home: DO TODAY**
- Parent selects a child, awards Quick Points immediately, completes/undoes Today's Goals.
- Shows available Percy Points **as a balance**, not a ring.
- Provides entry to parent reward approvals and fuller award/reward actions.
- Compact welcoming hero and real Fox 1A; no full historical weekly dashboard, no savings-editing or target-management blocks.

**Children: PLAN / UNDERSTAND**
- Child identity and weekly target management.
- Distinctive illustrated progress journey with three **informational** metrics: today's goals completed/scheduled; week points earned/weekly target; one explicitly named bigger goal saved/required.
- Bigger-goal destination, savings progress and achievement context.
- Parent management: edit weekly target, edit/schedule goals, configure rewards, manage savings.
- No Quick Points action tiles or today's completion controls; this is not a second Home dashboard.
- Child View, if retained, is an informational screen **within the parent-operated app**. No child account/login or independent child-device access.

**Alternative if owner still perceives duplication:** remove Children nav and place per-child management under a clearly named Family/Manage destination or profile drill-down. This requires its own owner navigation approval; do not silently drop a V1 approved tab.

## Design direction
- Home uses a bright warm cream and yellow illustrated morning scene, expressive Quick Point tiles, an action-led goals checklist and compact 'Ready to use' balance.
- Children uses a lilac/pastel green illustrated journey, progress ring signposts, reward destination and distinct management control grid.
- Both retain consistent chrome and approved five-tab navigation to preserve orientation.
- The real fixed Fox 1A SVG is embedded unchanged; no generated duplicate fox/dog/hedgehog.
- Four actual self-hosted approved font subsets (Nunito 700/800, Poppins 400/600) embedded. Five relevant, approved Phosphor symbols embedded. No remote images/font dependencies.
- NO new functions or financial currencies invented. Reward-request and savings controls are explicit illustrative placeholders until connected to existing V1 business flows.

## Engineering semantics
- All real mutations remain server-authoritative using the existing V1 endpoints; the HTML preview uses **only synthetic client-side state**. Do not take preview state or screen wording as new product logic.
- Never compute saved points from available points; weekly points may exceed the target numerically while the visual ring clamps at 100%.
- Ring value missing/zero denominator: neutral empty state, no false percentage.
- Home/Children selected child must have a single shared source of truth; preserve current V1 session and family-scope controls.
- Keep approved Fox 1A source/face/tail, colour, typography, marketing assets and licensing gates. No production AI artwork.
- Preserve Home and Children parent workflows including points Undo, correction log, confirmations, savings reassignment/unmark/delete/redeem, idempotence and error handling.

## Proto verification
Automated Chromium/Playwright browser inspection of original code at widths **320,359,360,390,834,1280**, both Home and Children: **12 layouts**, all with no detected horizontal container overflow. Browser JS errors: none. Mocked interactions passed: child switching, Quick Point award increasing available balance, Today Goal completion count, weekly target editing, management dialog open/close. The authentic SVG, icons and fonts were injected into the final preview after the logic tests (no logic changes); final embedded source static checks confirm no external image/font links and no API fetches.

**Not yet verified:** production React implementation, full axe scan, complete accessibility parity, all data edge cases and full visual sign-off. Production V1 must remain untouched until owner approval.

## Owner decision
1. Does this meaningfully justify distinct Home and Children tabs?
2. Should the bright action-led Home and progress-led Children share the illustrated visual system, with different page structures?
3. If yes, authorize real React conversion and extend the design system to Activity, Rewards and Settings. If no, evaluate removing Children tab rather than creating another near-duplicate screen.

Only one of these IA models can be approved; do not introduce additional tabs on engineering's initiative.
