# Positive Percy — engineering integration checklist

- Clone `soulglo82/positive_percy`, checkout `design/percy-stage1-interactive-preview` (design-only branch).
- Use `03_Icons/approved-assets.manifest.json`, `selected-context-icons.csv`, and `parent-picker-approved-71.csv` as the exact approved ID list.
- Original **Phosphor Duotone** SVG files are already staged under `design/assets/phosphor/duotone/` on that branch; do not replace them with semantically similar Lucide icons.
- Original curated **Streamline** files are staged under `design/assets/streamline/` on that branch; ensure required CC BY attribution and asset-family license scope.
- Apply `02_Tokens/percy-tokens.css`/JSON/JS across app, marketing site, docs, and exported reports; avoid parallel token implementations.
- Replace **legacy Batch D** colours/fonts only in a coordinated v2 change; don't treat the currently deployed app as matching Stage 1.
- Get Nunito 700/800 and Poppins 400/500/600 from licensed font source, self-host with OFL notices. No font binaries shipped in this package.
- The approved Fox 1A logo **source-traced SVG and PNG export set is now included** under `05_Logos/Fox_1A_Complete_Logo_Kit/` and is available for preview and implementation review; the original designer-authored illustrator curves have not been supplied. Dedicated points-currency master is still an open release hold.
- For reward icons, launch with 71 approved distinct Phosphor assets (84 placements). Names/synonyms search; dedupe search by asset_id, preserve per-category membership.
- Picker container queries: <520px 3 columns; 520–759px 5; >=760px 6.
- Category accents: mapped per-category. Do not use low-contrast orange/yellow as small text or essential symbols on cream; run contrast tests.
- Completed goal: retain goal/category icon and separate check-circle + visible Done text; recurring: repeat SVG + actual schedule; header: small decorative sparkle; hit target 44px, icon 24px. No missed-day penalties or automatic double awards.
- Existing rewards/images/emoji/history/points/IDs must survive non-destructive migration; uploads off at launch, optional icon edits permitted.
- Render fully functional React preview at 390, 834 and 1280 CSS px with Nunito/Poppins and real final masters. Test 1/2/3/6 children, long names, zero/many rewards, empty/completed goals.
- Test keyboard/screen reader, contrast, breakpoint fit, React data flows, app/website/docs visual parity, authentication, idempotency, timezone, carer roles, migrations, exports, and Playwright/axe.
- Do not merge/deploy PR #49 or release v2 until explicit owner visual approval and independent code/privacy/security review.
