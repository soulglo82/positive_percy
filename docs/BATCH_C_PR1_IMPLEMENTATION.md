# Positive Percy — Batch C PR1 engineering notes

Status: build branch only, not production approved. Backlog order remains unchanged: item #5 follows item #4.

## Included in PR1

- New families: all eight seeded behaviour categories start at **1 point**, including the four default quick-action categories.
- New custom categories: default to 1 point; parents can edit values from 1 to 1000.
- Database migration `012_one_point_defaults.sql` changes **column defaults only**; it does not overwrite existing families' configured values, event history, rewards or balances. No automatic backfill.
- Reward onboarding: an empty family's Rewards screen offers an editable **Extra Screen Time** starter (suggested 30 points), plus a create-your-own alternative. It is not automatically awarded or created; it remains a normal reward, not a screen-time tracker.
- First-login welcome in Home displays a copyable family code and points explanation, fixing the unreachable post-signup share screen.
- Sign-out confirmation explains that the code is needed again.
- Parenting tips no longer recommend deductions.
- Signed sessions for removed families are rejected by both HTTP and WebSocket room joins, preventing old tokens from writing orphan rows.

## Tests and constraints

- Seed-value, customization and migration tests against PostgreSQL.
- Removed-family JWT regression on authenticated API and WebSocket.
- Reward starter-template check; CI build, lint, accessibility and mobile browser UI checks.
- No account deletion, privacy policy, terms or data-export endpoints in this tranche.
- No updates to existing family settings, and no automatic reward creation.
- Existing user sessions remain valid if their family still exists.

## Still pending within Batch C / item #5

1. **Privacy and Terms:** final reviewed policy text, including photo cache, legacy Base44 images, backup retention and DPIA before publishing.
2. **Download family data:** family-scoped and tested export; ensure explicit, meaningful data coverage and no credentials or cross-family records.
3. **Delete account:** immediate hidden state and seven-day undo, followed by permanent deletion; needs separate reviewed design, migration, session revocation on soft-delete, data/picture deletion coverage, restore drill and backup retention confirmation.
4. Confirm backup retention (claimed 35 days), Cloudflare R2 restore path and deletion-log retention before implementing irreversible deletion.

The design `claude/batch-c-launch-basics-design.md` v0.4 and canonical backlog v2.4 remain in the original Claude project, not in GitHub. The additional decisions recorded in this chat are: one-point defaults, parent-only, screen time as a reward, seven-day deletion undo, recurring + one-off Today's Goals for later backlog item #6.
