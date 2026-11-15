# Positive Percy Stage 1 — Git-tracked complete asset archive

**Status:** Engineering handover only. Do not merge or deploy without the release gates in \`docs/engineering/PERCY_V2_IMPLEMENTATION_PLAN.md\`.

This directory stores **the exact 150-file Stage 1 brand pack** delivered in the Positive Percy project (including the approved Fox 1A traced logo pack, SVG masters, transparent PNG exports, mobile/web icons, visual guide, PDF, CSS/JSON tokens, 71-icon selection manifest, and exact Freepik #3570506 PNG).

The byte-for-byte original \`Positive_Percy_Stage1_Brand_Pack.zip\` is represented losslessly as ordered ASCII base64 parts \`Positive_Percy_Stage1_Brand_Pack.zip.b64.part-000\` through \`part-035\`. This chunking is transport-only; the files are **not 36 separate designs**.

- Original archive bytes: **3,197,548**
- Expected SHA-256: \`e7e93dde728048cb03ba78a1f761cc221af184bfda3bdd4234f7fd3df61f3638\`
- Expected ZIP file count: **150**
- Asset-source SVGs are also in \`fox1a-svg-sources.tar.xz\` (32 files); this is a convenience source archive.

To reconstruct and install a normal folder tree after cloning this branch:

\`\`\`bash
python3 scripts/brand/unpack-stage1-brand-pack.py
\`\`\`

The script verifies all 36 chunks, the archive SHA-256 and CRC of every file, then extracts to \`design/brand/library/Positive_Percy_Stage1_Brand_System/\`. The original ZIP is reconstructed under \`design/brand/library/\` as well.

**Crucial:** Installing assets in a worktree does not mean authorising them for production usage. The supplied Freepik image is selected but its asset-specific commercial licence and attribution evidence still must be verified; selected Streamline source visuals require applicable attribution/permission checks. No font binaries are distributed. The Fox logo's SVGs are image-traced from the approved 1A board, not the original illustrator's editable nodes. A dedicated brand *points* star is still an independently open artwork dependency.

The original approved Phosphor and Streamline source SVGs remain at \`design/assets/\` on this branch; do not replace those with generated approximations.