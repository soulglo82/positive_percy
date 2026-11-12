# Batch C PR3 — Family Report PDF

## Parent-facing deliverable

The existing **Download family data (JSON)** is for technical portability, not an everyday family report. This approved correction adds a **Download Family Report (PDF)** primary button in Family settings. The JSON export stays available below it, explicitly labelled **Download technical data (JSON)**.

## Report template

A4 portrait, warm Percy purple / orange / cream, page numbers, generated date and no family access code.

1. Family overview — current combined balances, earned this week, rewards claimed, each child summary.
2. Individual child summary — current balance, weekly points and target, top positive behaviour categories, badges, recent claimed rewards and lifetime earned points.
3. Per-child points and reward activity — **past 30 days**, dated and automatically paginated.
4. Family rewards — configured rewards and point costs.
5. Behaviour settings — configured categories and values.

This is a **snapshot report**, not an exhaustive historical archive. The report states its 30-day activity window; use the technical JSON export for the complete retained history. Weekly totals use Monday 00:00 in the family's timezone and exclude undone awards. Historical adjustments and reversals remain shown in the activity appendix.

## Implementation and safety

- Reuses the same authenticated, family-scoped `GET /api/family/export?photos=exclude` endpoint as PR2.
- Renders HTML pages in the **parent's browser**, using html2canvas already installed in the app, then assembles the JPEG-backed pages into a downloadable A4 PDF. No new external service, npm dependency, DB migration or database writes.
- Escapes all parent-supplied strings to prevent injected HTML.
- Preserves international names via browser font rendering instead of relying on PDF's limited standard Latin fonts.
- Avoids large base64 image embedding. Activity is scoped to the last 30 days; a maximum of 80 pages is enforced with an explicit error rather than silently dropping rows.
- The PDF is a **visual, image-backed report**, not a selectable-text or PDF/UA-tagged document. A tagged/text-searchable accessible version is future work.
- PDF pages include the family's data and should be stored privately. Family code/JWT are not rendered.
- Supports parents on phone, tablet and desktop; a first-run Chromium test verifies a valid downloaded PDF header, A4 pages and filename.
- Future PDF changes should preserve data boundaries and correct points arithmetic before styling.

## Remaining Batch C

Privacy and Terms of Use, seven-day recoverable account deletion, backup retention/restore verification and UK Children's Code/DPIA review remain to be completed before marking backlog item #5 closed.

**Release policy:** Branch/PR -> lint/build/test/a11y/Playwright -> review -> explicit approval -> Railway deploy -> live verification.
