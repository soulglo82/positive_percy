# V1-E evidence: Settings

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-e-settings`) |
| Status | For visual sign-off |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-19 | First pack |

## Sources

- **`reference/`:** renders of the approved HTML (blob `9de1df2`), screen `settings`, at 390, 834 and 1280 px, cut at the phone frame.
- **`react/`:** the built app with fixture data:
  - `settings-*`: the full page.
  - `settings-quickpoints-*`: the Quick Points dialog.
  - `settings-familyname-*`: the Family name dialog.

## Checklist

| Area | Matches | Intended deviation |
| --- | --- | --- |
| Groups and rows | "Family settings", "Make Percy work for your family.", the four groups with every approved row title and subtitle, Edit / View / Download | **Point defaults has no Edit** (D6). **"Planned" and "Review" are status labels**, not buttons (owner: not shown as working features). Each action's accessible name includes its row ("Edit Family name") |
| Dialogs | Each Edit/View opens a dialog titled with its row | Dialogs replace the approved full-page edit screens (owner item E4). **Quick Points opens straight to the quick-button controls** (owner review) |
| Family name | Saves the family's own name (the one the Family Report shows) | — |
| Kept and removed | Parenting tips and "Credits and licences" kept below the groups | The technical JSON export tile is removed; the export endpoint stays |
