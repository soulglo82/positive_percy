# V1-D evidence: Rewards, reward form and picker, parent confirmation

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-d-rewards`) |
| Status | For visual sign-off |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-19 | First pack |

## Sources

- **`reference/`:** renders of the approved HTML (blob `9de1df2`), screens `rewards` and `rewardform`, at 390, 834 and 1280 px. They are cut at the phone frame.
- **`react/`:** the built app (normal build) with fixture data like the sample. Four rewards have picker icons; "Pizza (older reward)" is a legacy reward with only an emoji and no icon; "Bike ride" is hidden. Lara has two pending requests.
  - `rewards-*`: the catalogue, full page.
  - `rewardform-*`: the form after choosing "Game Controller".
  - `rewardform-picker-*`: the picker scrolled into view.
  - `requests-*`: the Home "Rewards" dialog with Lara's requests.

## Checklist

| Screen | Matches | Intended deviation |
| --- | --- | --- |
| Catalogue | Heading and subtitle, "Your reward catalogue", "New reward", the visibility sentence, All/Visible/Hidden filters, tiles (icon, title, points, visibility tag, Edit), "View child reward choices" | **No tile subtitles** ("Weekly treat" and the like have no stored field; plan §8.4). **No "Bigger rewards" section** (D7: explicit designation, part of the D1 savings design). A legacy reward keeps its emoji (D2/D3). The Streamline catalogue note is not shipped (§8.6) |
| Reward form | Title and subtitle, 1 "The reward" (Reward name, Points needed), the selected-icon row (Hide/Change), 2 "Choose an icon", search with placeholder, 12 category chips, count line, icon tiles, "No matching icons. Try a different word.", Cancel / Save reward | **Category chips wrap** instead of scrolling sideways (the app keeps no horizontal scroll, WCAG 1.4.10). **The picker subtitle is not shipped** (owner item C2). **Kept fields:** description, "Visible to children", "Assign to Children", Delete Reward |
| Picker grid | 3 columns under 520 px of picker width, 5 to 759 px, 6 from 760 px (measured in the browser tests); owner-approved category accents (orange / purple / sunshine) as a top bar; icon always purple on white | (none) |
| Requests | Not in the approved HTML (D5: the parent confirms) | **All copy is owner item C5** ("{Name} asked for", "Not this time", "Approve N rewards", the toast) |
