# V1-E design note: Settings

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Issued | 2026-11-19 |
| Owner | Percy V1 engineering (branch `claude/percy-v1-e-settings`, stacked on V1-C `claude/percy-v1-c-activity`) |
| Status | Reviewed (§8); build may start |
| Binding inputs | Approved HTML blob `9de1df2`, screen `settings`. Plan v1.1 §2 (Settings row), §5 ("Family name — Edit": new `PUT /api/family/name`; "Point defaults": D6 read-only), §8.7 (retained capabilities). Owner decision D6: read-only global defaults |

## Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.1 | 2026-11-19 | Peer review (§8): the family name is written to `families` only and refreshed through a new `refreshUser`; distinct accessible names for every row action; broken e2e specs listed; Today's Goals wiring; embedded category manager; route order; copy corrections |
| 1.0 | 2026-11-19 | First draft |

## 1. Scope

- `pages/ParentProfile.jsx` is restructured into the four approved groups of rows. Each row shows a title, a subtitle and one action.
- **One new server route,** `PUT /api/family/name`. No migration.
- **Existing defect fixed (found while designing).** The shipped "Family name" form saves `users.full_name` through `PUT /api/auth/me` (ParentProfile.jsx `handleSubmit`). But Percy shows the family's name from `families.family_name`; the Family Report reads `data.family.family_name` (familyReport.js). So an edit has never reached the report. The new route writes `families.family_name`.

## 2. Screen (approved strings verbatim)

- **Header:** "Family settings" and "Make Percy work for your family."
- **Behaviours & Quick Points:**
  - "Positive behaviour categories", "Names, point values and approved icons", **Edit**. Opens a dialog holding the shipped `BehaviorCategoryManager` (names, points, icons, reorder, per-child assignment, quick toggle). A new `embedded` prop drops its own "Behaviours" header and card inside the dialog. Its "Quick actions: n/m" line is shipped wording, kept (owner item E1).
  - "Quick Points", "Choose your quick award buttons for Home", **Edit**. Opens the same manager. Its quick-button toggle is where Quick Points are chosen (owner item E1).
  - "Point defaults", "New behaviours and Quick Points start at 1 point". **No action** (D6: read-only; the server default is 1, `categoryPoints`).
- **Children & goals:**
  - "Children", "Profiles, avatars and weekly targets", **Edit**. Opens a dialog with the shipped child list (avatar, name, Edit → `EditChildModal` with photo upload and delete, "Add child").
  - "Today’s Goals", "Recurring routines and one-off achievements", **Edit**. Opens `ManageGoalsDialog` for the first child (oldest), with the behaviour categories and today's date from `GET /api/todays-goals?manage=true` (as on Children). Its family strip switches children. **Disabled when there are no children.**
  - "Family timezone", "Determines today’s date and weekly schedule", **Edit**. Opens a dialog holding the shipped `FamilyTimezone`.
- **Family & access:**
  - "Family name", "How your family appears in Percy", **Edit**. Opens a dialog with the shipped input (label "Family name", placeholder "e.g., The Smiths") and Save. It calls the new route.
  - "Invite parent", "Available with existing family invitation flow", **View**. Opens a dialog with the shipped family code, Copy, "Both parents can add points and manage rewards." and "Share invite link".
  - "Shared carers", "Permission-enforced access is still a launch gate", **"Planned"** as a status label, not a control.
- **Reports & privacy:**
  - "Family Report (PDF)", "Printable achievements and recent history", **Download** (accessible name "Download Family Report (PDF)", the shipped label). The shipped report download; busy text "Creating your report…"; errors as shipped (the server's message, else "Could not prepare the report.").
  - "Privacy & account controls", "Release only after legal and restore gates", **"Review"** as a status label, not a control. No privacy controls exist yet; account deletion lives on an unmerged branch (owner item E2).
- **Removed from this screen:** the technical JSON export tile (plan §2). `GET /api/family/export` stays live, and the report uses it; a test keeps it.
- **Kept below the groups, not in the approved screen (owner item E3):**
  - "Need help rewarding behaviour? View parenting tips" (shipped).
  - "Credits and licences": the CC BY 4.0 attribution, which the licence requires.
- **Accessible names:** every action is named for its row: "Edit Positive behaviour categories", "Edit Quick Points", "Edit Children", "Edit Today’s Goals", "Edit Family timezone", "Edit Family name", "View Invite parent". The visible word stays at the start, so the label still contains it (WCAG 2.5.3). "Planned" and "Review" are styled as status text.
- **Focus:** the Children dialog stays open under `EditChildModal` and `AddChildModal`, so focus returns to the "Edit {child}" button; after a delete, focus moves to "Add child". Radix returns focus to the row's button when a row dialog closes.
- **Dialog titles:** the row's own title ("Positive behaviour categories", "Quick Points", "Children", "Family timezone", "Family name", "Invite parent"). They are approved strings reused, so no new copy. Today's Goals keeps its own shipped title.

## 3. Server: `PUT /api/family/name`

- **Request:** body `{ family_name }`, authenticated; the family comes from the token, never from the body.
- **Validation:**
  - A non-string → 400 "Family name is required" (checked explicitly: `sanitizeString` passes non-strings through).
  - Trimmed and cut to 100 characters, as the creation route does inline.
  - Empty after trimming → 400 "Family name is required" (the shipped creation message).
- **Writes:** `UPDATE families SET family_name = $1 WHERE family_code = $2 RETURNING family_code, family_name`.
  - `families` only. `users.full_name` is left as legacy (it is read only by the old Settings field and the JSON export's grown-ups list). Writing both would need a transaction and could still diverge through the open `PUT /api/auth/me`.
  - Returns `{ family_name }`; 404 "Family not found" when the row is missing (as the timezone route).
  - Registered before the generic `PUT /api/:entity/:id`, which would otherwise match the path.
  - The client calls a new `refreshUser()` in `AuthContext` (reusing `loadUser`), so `user.family.family_name` is current. `updateUser` replaces `user` with a row that has no `family`, so it is not used for this.
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
| E7 | Report download fails | The shipped toast: the server's message, else "Could not prepare the report." |

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
- **E2E (these change):**
  - `e2e/ui.spec.js` "settings": the timezone select, behaviours, Add child and Edit child are reached through the row dialogs; `closeDialog` is checked for a Select inside a dialog.
  - `e2e/batch-c-export.spec.js` drives the removed JSON button: it becomes a request-level check of `GET /api/family/export` (the endpoint stays; server/test/export.test.js also covers it).
  - `e2e/batch-c-family-report.spec.js`: the JSON-button assertions go; the report button is found by its accessible name.
  - Axe and 44 px checks at 4 sizes.
- **Server, added:** `PUT /api/auth/me` cannot set `family_name` (it is not a user column).
- **Evidence:** reference vs React at 390/834/1280.
- **One class not covered:** two parents renaming the family at the same moment (last write wins, as for every other family setting).

## 7. Owner items

| # | Item |
| --- | --- |
| E1 | Quick Points Edit opens the behaviour manager (where the quick toggle lives) rather than a separate Quick Points editor |
| E2 | "Planned" (Shared carers) and "Review" (Privacy & account controls) are status labels, not buttons, until those features exist |
| E3 | Parenting tips and "Credits and licences" stay below the groups (the licence requires the credits) |
| E4 | Dialogs replace the approved full-page "Edit {title}" screens (their design-only copy never ships, plan §8.6); Point defaults has no Edit (D6) |

## 8. Peer review (fresh context, v1.0)

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | Three e2e specs depend on removed or renamed controls | Blocking | Listed and planned (§6); the report button keeps its shipped accessible name |
| 2 | Nothing refreshes the family name on screen; `updateUser` drops `family` (verified, AuthContext.jsx and `PUT /api/auth/me`) | Blocking | `refreshUser()` added to `AuthContext` (§3) |
| 3 | Six "Edit" buttons share one name | Blocking | Row-specific accessible names (§2) |
| 4 | Deviations from the approved actions not all logged | Non-blocking | Owner item E4 |
| 5 | Today's Goals needs categories and today; no-children case | Non-blocking | Data from the manage query; disabled with no children (§2) |
| 6 | The defect is real; writing both columns can diverge | Non-blocking | `families` only (§3) |
| 7 | Route order, `sanitizeString` on non-strings, 404, auth/me test | Non-blocking | Adopted (§3, §6) |
| 8 | E7 copy wrong | Non-blocking | Corrected (§5) |
| 9 | Nested headers and focus return | Non-blocking | `embedded` prop; focus rules (§2) |
| 10 | "Quick actions" wording inside "Quick Points"; Planned/Review styling | Non-blocking | Shipped wording kept under E1; status text (§2) |

