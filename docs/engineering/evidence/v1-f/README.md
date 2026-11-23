# V1-F evidence: reference vs React

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-18 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-f-forms`) |
| Status | For visual sign-off |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-18 | First pack |

## Sources

- **`reference/`:** renders of the approved HTML (blob `9de1df2`) phone content for `award`, `goalsmanage`, `goalform`, `welcome` and `onboarding`, at 390, 834 and 1280 px. They are cut at the phone frame, so the lower part of each form (the note, the footer buttons) is not shown. The approved text for those parts is in the design's own source.
- **`react/`:** the built app (a **normal build**, as shipped) with fixture data like the sample: Lara, Omar, Joud; three goals; behaviours at 1 point. Dialogs are captured at viewport size; Welcome is a full page for a family with no children.
- **`react-review-build/`:** Welcome only, from a **local review build** (`PERCY_PREVIEW_GATED=1`), which includes the release-gated treasure map. A normal or Railway build cannot include it (V1-F-DESIGN §3). These images show the approved artwork, which is already in the repository's design library.

## Checklist

| Screen | Layout and order | Copy | Controls | Deviation |
| --- | --- | --- | --- | --- |
| Award | Title, 1 child strip, 2 behaviour grid, note, summary, Cancel / Award | Approved strings (render-tested) | Child cards and behaviour tiles with `aria-pressed`; "Award N point(s)" | Dialog, not a page: the Close button stands in for "Back" (intended, §1) |
| Manage goals | Title, child strip, "Current goals" card, rows with Edit, safety note | Approved | Edit per goal; Add goal | Archive moved into the edit form (intended, G3) |
| Goal form | 1 Goal details, 2 When should it happen?, day chips, Cancel / Create goal | Approved | Behaviour select shows names only, as in the design | Date inputs kept: "Starts on" or "Started", and the one-off date (intended, E05 safeguard, G3) |
| Welcome | Map, heading, body, one button | Approved | "Add your first child" | **Shipped build has no map until the licence gate is cleared** (intended, §3). No "← Back to Home", because this is Home |
| Onboarding | Title, subtitle, three cards, Explore Percy | Approved | Focus starts on "Explore Percy" | Dialog, not a page (intended, §1) |

Nav "Child" still reads "Child". It becomes "Children" in V1-B.
