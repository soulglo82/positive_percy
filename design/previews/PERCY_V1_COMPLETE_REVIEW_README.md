# Positive Percy V1 — five-tab HTML visual review

**DESIGN FOR OWNER REVIEW — NOT APPROVED / NOT PRODUCTION.**

Download the self-contained [HTML review file](https://github.com/soulglo82/positive_percy/blob/1aa96f253af7cb4ae824157b1ef2aa21185e3b98/design/previews/PERCY_V1_COMPLETE_REVIEW.html) using **Download raw file** in GitHub, then open the downloaded `.html` in a modern browser. It includes all five main tabs (Home, Children, Activity, Rewards, Settings) plus Welcome, Child View, Manage Goals, Create/Edit Goal, Create/Edit Reward/preview picker, Award Points and Onboarding. Device selectors are 390px / 834px / 1280px.

## What is locked and carried forward
- **Focused Home** — preserve the layout from the preceding final focused Home prototype; do not substitute the older family dashboard.
- **Streak at the top** — a compact 3-day *example* family streak above the welcome heading, child strip and Today's Goals. A true streak must be computed from consecutive family-local days; do not relabel active-days as a streak.
- **Home vertical order** — streak, heading, three-child strip, Today's Goals, weekly summary, separate larger-goal progress, weekly treat, quick positive behaviours. No Recent Activity on Home.
- **Copy** — Little wins, big adventures! / This week / Available now / What you're working towards. No asterisks or unexplained allocation jargon. No nested savings box.
- **Nav** — Home (house-line), Children (users; renamed from Progress), Activity (chart-line-up), Rewards (gift), Settings (gear), with exact approved Phosphor Duotone shapes.
- Original Fox 1A source unchanged. Original selected Streamline reward artwork, no generated substitute mascot.
- **Exact Freepik treasure map #3570506 embedded as a PNG data URI** from the source-controlled approved file. The map is visibly available offline in Welcome. Commercial licence remains a **pre-launch release gate**.
- **Nunito/Poppins 5 original WOFF2 files embedded** from approved E02 fonts; review doesn't depend on Google Fonts.

## Review QA
A source-equivalent local version was navigated at 390px / 834px / 1280px and checked across 12 views, with no JavaScript exceptions or empty screens; selected-child switching and Activity/Rewards filters were exercised. The committed self-contained version differs only by inlining the exact PNG and original font data and updated explanatory text. Backend changes, real family data, persistent award/spend actions and live streak computation were not tested or implemented here.

## Still not ready to approve for production
1. All screens and customer-facing copy require explicit owner review/sign-off on this exact immutable commit.
2. The reward picker screenshot intentionally previews only a **subset** of 71 approved icons. E06 must show the full approved picker at 12 categories with proper breakpoints and search, before treating the flow as final.
3. Long-term goal allocation and weekly pool transfers require a server-enforced contract; illustrative numbers aren't live data.
4. Family streak algorithm, Freepik/Streamline licensing, dedicated points-star art, shared-carer permissions, legal/privacy, backup-restore proof and accessibility tests remain separate gates.
5. Page layouts have not been implemented or merged in the production React app.

Do not merge, deploy, begin implementing these final layouts or enable new permissions solely because this artifact exists. Use [issue #55](https://github.com/soulglo82/positive_percy/issues/55) as the owner's two-phase design/implementation gate.
