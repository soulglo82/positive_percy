# V1-B evidence: Children page and Child View

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-b-children`) |
| Status | For visual sign-off |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-19 | First pack |

## Sources

- **`reference/`:** renders of the approved HTML (blob `9de1df2`), screens `children` and `childview`, at 390, 834 and 1280 px. They are cut at the phone frame.
- **`react/`:** the built app with fixture data like the sample:
  - Lara has 20 of 25 weekly points and 92 available, and has asked for Movie night.
  - Two of her goals are done today.
  - Four rewards are visible to children.
  - The bottom bar in the phone shots is the fixed navigation, captured mid-page by the full-page screenshot.

## Checklist

| Screen | Matches | Intended deviation |
| --- | --- | --- |
| Children | Heading and subtitle; family strip; "{Name}'s page" with avatar, "{week} of {target} weekly points · {available} available", "View as child"; "{Name}'s weekly target" with Edit, "Earned this week", "Available now", the bar, "{n} to reach this week's target"; "Weekly treats to choose from" with "All rewards" and tiles (icon, title, points, visibility tag, Edit); "{Name}'s goals" with "New goal", rows "Category · schedule · +N point(s)" with Edit, "Manage all goals"; "Achievements": "Goals completed", "Recognise effort over time", "{n} today", "Next milestone", "{n} weekly points to go" | **No "Saving for something bigger"** (D1 gate). **No "Weekly target and bigger goal" subtitle** (owner item B1). **No tile subtitles** (plan §8.4). The design-only note is not shipped (§8.6). The selected child has a purple border, as on Home (the approved orange is below 3:1) |
| Child View | "← Back to Home", "My Percy adventure", its subtitle, family strip, "You're doing great, {Name}!", "{available} Ready to use", "Rewards I can choose" with "{cost} points · Ready when a parent agrees" (requested) and "{cost} points · Ask a parent" (affordable), the footer sentence | **Request button labelled "Ask a parent"** (owner item B3: the approved design has the caption but no control). **No Edit or visibility tags** (D8). **No "Saved towards" tile and no "My next big adventure"** (D1 gate). Unaffordable rewards keep the shipped "Need {n} more" |
