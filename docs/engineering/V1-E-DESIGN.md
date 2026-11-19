# V1-E design note: Settings

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-e-settings`, stacked on V1-C `claude/percy-v1-c-activity`) |
| Status | Draft, for fresh-context peer review |
| Binding inputs | Approved HTML blob `9de1df2`, screen `settings`. Plan v1.1 §2 (Settings row), §5 ("Family name — Edit": new `PUT /api/family/name`; "Point defaults": D6 read-only), §8.7 (retained capabilities). Owner decision D6: read-only global defaults |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-11-19 | First draft |

## 1. Scope

- `pages/ParentProfile.jsx` is restructured into the four approved groups of rows. Each row shows a title, a subtitle and one action.
- **One new server route,** `PUT /api/family/name`. No migration.
- **Existing defect fixed (found while designing).** The shipped "Family name" form saves `users.full_name` through `PUT /api/auth/me` (ParentProfile.jsx `handleSubmit`). But Percy shows the family's name from `families.family_name`; the Family Report reads `data.family.family_name` (familyReport.js). So an edit has never reached the report. The new route writes `families.family_name`.

## 2. Screen (approved strings verbatim)

- **Header:** "Family settings" and "Make Percy work for your family."
- **Behaviours & Quick Points:**
  - "Positive behaviour categories", "Names, point values and approved icons", **Edit**. Opens a dialog holding the shipped `BehaviorCategoryManager` (names, points, icons, reorder, per-child assignment, quick toggle).
  - "Quick Points", "Choose your quick award buttons for Home", **Edit**. Opens the same manager. Its quick-button toggle is where Quick Points are chosen (owner item E1).
  - "Point defaults", "New behaviours and Quick Points start at 1 point". **No action** (D6: read-only; the server default is 1, `categoryPoints`).
- **Children & goals:**
  - "Children", "Profiles, avatars and weekly targets", **Edit**. Opens a dialog with the shipped child list (avatar, name, Edit → `EditChildModal` with photo upload and delete, "Add child").
  - "Today’s Goals", "Recurring routines and one-off achievements", **Edit**. Opens `ManageGoalsDialog` for the first child; its family strip switches children.
  - "Family timezone", "Determines today’s date and weekly schedule", **Edit**. Opens a dialog holding the shipped `FamilyTimezone`.
- **Family & access:**
  - "Family name", "How your family appears in Percy", **Edit**. Opens a dialog with the shipped input (label "Family name", placeholder "e.g., The Smiths") and Save. It calls the new route.
  - "Invite parent", "Available with existing family invitation flow", **View**. Opens a dialog with the shipped family code, Copy, "Both parents can add points and manage rewards." and "Share invite link".
  - "Shared carers", "Permission-enforced access is still a launch gate", **"Planned"** as a status label, not a control.
- **Reports & privacy:**
  - "Family Report (PDF)", "Printable achievements and recent history", **Download**. The shipped report download; its busy text is "Creating your report…".
  - "Privacy & account controls", "Release only after legal and restore gates", **"Review"** as a status label, not a control. No privacy controls exist yet; account deletion lives on an unmerged branch (owner item E2).
- **Removed from this screen:** the technical JSON export tile (plan §2). `GET /api/family/export` stays live, and the report uses it; a test keeps it.
- **Kept below the groups, not in the approved screen (owner item E3):**
  - "Need help rewarding behaviour? View parenting tips" (shipped).
  - "Credits and licences": the CC BY 4.0 attribution, which the licence requires.
- **Dialog titles:** the row's own title ("Positive behaviour categories", "Quick Points", "Children", "Family timezone", "Family name", "Invite parent"). They are approved strings reused, so no new copy. Today's Goals keeps its own shipped title.

## 3. Server: `PUT /api/family/name`

- **Request:** body `{ family_name }`, authenticated; the family comes from the token, never from the body.
- **Validation:**
  - Trimmed and sanitised as at creation (`sanitizeString`, at most 100 characters).
  - Empty → 400 "Family name is required" (the shipped creation message).
  - A non-string → 400.
- **Writes:** `UPDATE families SET family_name = $1 WHERE family_code = $2 RETURNING family_code, family_name`.
  - It also sets `users.full_name` for the family, so the shipped `user.full_name` stays consistent.
  - Returns `{ family_name }`.
  - Broadcasts nothing; the screen refreshes `auth/me`.
- **Cross-family:** only the caller's family row can change (test with two families).

## 4. Contracts and code paths

| Contract | Paths |
| --- | --- |
| Family name | New route → `families.family_name`. Readers: the Family Report (export) and `auth/me`'s `family`. Settings shows `user.family.family_name` (fallback `user.full_name`) |
| Categories and Quick Points | Unchanged `BehaviorCategoryManager` (`/api/behavior-categories*`, quick-slot limit) |
| Children | Unchanged `AddChildModal` and `EditChildModal` (`Child.create`, `update`, `delete`) |
| Goals | `ManageGoalsDialog` (V1-F/V1-B) |
| Timezone | Unchanged `FamilyTimezone` (`PUT /api/family/timezone`) |
| Report | Unchanged `downloadFamilyReport` (`/api/family/export?photos=exclude`) |

## 5. Edge cases (input → expected)

| # | Input | Expected |
| --- | --- | --- |
| E1 | Family name of only spaces | 400 "Family name is required"; the dialog stays open with the toast |
| E2 | A 150-character name | Stored as the first 100 |
| E3 | Another family's token | Changes only that family's row |
| E4 | No children | The Today’s Goals row opens nothing; the Children dialog shows "No children added yet." and "Add child" (shipped) |
| E5 | No family code yet (loading) | Invite parent's View is disabled |
| E6 | Long names at 320 px | Rows wrap; no sideways scroll |
| E7 | Report download fails | The shipped toast "Could not create Family Report." |

## 6. Test plan

- **Server:**
  - Name update, trimming and the 100-character limit.
  - The empty and non-string cases.
  - Cross-family isolation.
  - `auth/me` and the export reflect the new name.
  - The export endpoint stays live.
- **Render:**
  - The four groups with their approved titles, subtitles and actions.
  - Point defaults has no button.
  - "Planned" and "Review" are not buttons.
  - Each Edit or View opens its dialog.
  - Family name saves through the new route.
  - No JSON export button.
- **E2E:** the Settings test is updated (its existing selects and dialogs are now reached through the rows). Axe and 44 px checks at 4 sizes.
- **Evidence:** reference vs React at 390/834/1280.
- **One class not covered:** two parents renaming the family at the same moment (last write wins, as for every other family setting).

## 7. Owner items

| # | Item |
| --- | --- |
| E1 | Quick Points Edit opens the behaviour manager (where the quick toggle lives) rather than a separate Quick Points editor |
| E2 | "Planned" (Shared carers) and "Review" (Privacy & account controls) are status labels, not buttons, until those features exist |
| E3 | Parenting tips and "Credits and licences" stay below the groups (the licence requires the credits) |
