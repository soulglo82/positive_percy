# V1-A evidence: Home

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-18 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-a-home`) |
| Status | For visual sign-off |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-18 | First pack |
| 1.1 | 2026-11-18 | Review fixes: React renders retaken after the reading-order layout change; Working towards now uses the server-priced stack |


- `approved-home-{390,834,1280}.png`: renders of the approved HTML (`18769f7`, blob `9de1df2`), with the inner app content captured in full.
- `react-home-{390,834,1280}.png`: the built React app on a throwaway local database. The fixture data is shaped like the design's samples: three children, three goals with two done, one stacked reward.

## Comparison checklist

| Area | Result |
| --- | --- |
| Order | **Superseded 22 November:** the owner moved Quick Points directly under the family strip, above Today's Goals (release assessment §3.5). As recorded at V1-A: Matches: streak, "Welcome back!", family strip, Today's Goals, Little wins, What you're working towards, Quick Points. Desktop uses the same two columns. The page source is in this reading order too, so keyboard and screen-reader order match the phone layout (checked in the browser tests) |
| Family strip | Matches: oldest first, avatar, name, "N / T this week", bar. **Intended deviation:** the selected child is marked with a purple border instead of orange, because orange is 2.87:1 and a selection indicator needs 3:1 (WCAG 1.4.11) |
| Today's Goals | Matches: done count, "{Name}'s checklist", short date, category icon, "Category · Today/Daily/days · +N point", Done pill, outlined Complete, Manage goals |
| Little wins | Matches: "N / T This week" and "N points Available now". Available now comes from the server (`available_points`) |
| Working towards | **Deviation pending owner decision D1:** no savings bar or "saved" figures, because no allocation ledger exists. Shows the child's chosen (stacked) rewards at current names and costs (server `reward_stack_priced`, the same stack `available_points` uses) with "Ready when a parent agrees" (approved Child View wording). No Streamline art on real rewards (D3) |
| Quick Points | Matches: tiles with category icon, name and "+N" badge; Award points and Rewards buttons. The data is the family's real quick behaviours |
| Streak | Real server value. Hidden at 0 (D4). The design-only note "Streak figure is sample content…" is not shipped (plan §8.6) |
| Bars | The design uses an orange-to-yellow gradient. Gradients are not allowed by the token rules, so the bars are a solid brand orange (`sunrise`) |
| Not yet V1 | The nav still reads "Child" until V1-B delivers the Children page. With no children, Home shows the existing empty state until V1-F's Welcome with the map |
