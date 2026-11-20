# V1-C evidence: Activity

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-c-activity`) |
| Status | For visual sign-off |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.1 | 2026-11-19 | Retaken after the owner review: "Reward redeemed", goal titles as completed, days in the family's zone |
| 1.0 | 2026-11-19 | First pack |

## Sources

- **`reference/`:** renders of the approved HTML (blob `9de1df2`), screen `activity`, at 390, 834 and 1280 px, cut at the phone frame.
- **`react/`:** the built app with fixture data:
  - Lara completed two goals and redeemed Movie night.
  - Omar earned Kindness with the note "Helped a friend".
  - The children's starting points show as the shipped "started with" rows.

## Checklist

| Area | Matches | Intended deviation |
| --- | --- | --- |
| Header and "This week" | "Activity", its subtitle, "This week", "{n} Points earned", "{n} Goals completed" (server figures) | Numbers are centred in their boxes (the owner's earlier direction for these boxes). The design-only "Sample summary only…" line is not shipped |
| Activity log | Open by default; All / Earned / Goals / Spent; day groups "Today · …" and "Yesterday · …"; row icons (tick for a goal, heart for an award, gift for a spend); row lines as approved; "Load earlier activity" after a full page | **Older days** are "{Weekday d Month}", with the year when not this year (A1, accepted). **Spends read "Reward redeemed"** (A2). Days and times in the family's zone. **Child filter kept** (A3, accepted). **"Correct"** on this week's awards is kept (A2 history). Other kinds (starting points, corrections, undo) keep their shipped wording, with Undo's arrow or the info icon |
| Corrections and Undo | Heading and its first sentence | The design-only "This preview does not change a real ledger." is not shipped |
