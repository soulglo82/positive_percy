# Positive Percy — Children's data protection impact assessment (draft)

**Status:** v0.1 design assessment, not legal sign-off.
**System assessed:** Parent-operated Positive Percy web app, Railway/Postgres and R2 backup; code examined 12 November 2026.
**Assumptions to verify:** legal operator, market jurisdictions, UK child access, vendors and transfer arrangements, bucket lifecycle, privacy contact, launch target.

## Processing inventory

| Data | Source/purpose | Current controls | Outstanding risk |
|---|---|---|---|
| Child name, optional age and photo | Parent entry; attribution / avatar | Family-scoped database, image type/size limits | Shared family code; publicly retrievable random-ID image URLs |
| Point awards, corrections and notes | Parent tracking | Immutable-ish award/undo event ledger, per-family queries | Free-text notes may contain sensitive child details; retention indefinite |
| Rewards, spending, goals | Parent tracking | Family-bound writes and derived balances | Child preferences may reveal personal or sensitive circumstances |
| Family name/timezone and parent phone/name | Parent signup/settings | JWT-protected APIs | No individual parent authentication or roles |
| Photos and older remote URLs | Parent upload or legacy migration | Owned uploads, random UUID links | CDN/browser caching up to one year; remote hosts unverified |
| Family code and tokens | Shared family credential | Random code, signed JWT, rate limits on join | Code is shared password; token 30-day expiry; no per-adult revocation |
| Technical JSON/PDF downloads | Parent portability | Authenticated, family scoped; browser PDF created locally | Files persist on the parent's device and may be shared |
| Backups | System recovery | Daily pg_dump, valid archive, R2 upload logged | Actual bucket lifecycle unverified; no documented restore drill |

## Purpose and proportionality

The app rewards positive household behaviours; it should avoid punitive or disciplinary profiling. No negative scoring and no DOB are deliberate minimisation decisions. Optional photo, age and free-text notes should be reviewed for necessity. The future Today's Goals feature must not pressure children into revealing unnecessary personal information.

## High-priority risks and controls

1. **Family-code bearer credential — high:** Anyone who learns the code can read/edit the family's data and, before admin accounts, act as a grown-up. Mitigate with shorter token lifetime/rotation and role-based accounts in backlog item #9; explain limitations and discourage public sharing. Consider independent second-factor confirmation for deletion before general launch.
2. **Public photo URL — high:** Image requests do not authenticate; UUID is unguessable but links can be copied, cached and scraped if disclosed. Review signed access/private image proxy and reduce browser cache lifetime before marketing launch.
3. **Deletion/backup erasure — high:** Soft-deletion must immediately block all writes and old sessions, including WebSockets, preserve recovery only within the window, and delete all family-associated rows and owned uploads after expiry. Verify R2 retention and restoration; document backups 'beyond use' and suppression on recovery. **Do not enable irreversible deletion before restore drill and legal review.**
4. **Data minimisation — medium:** No DOB; consider making age and photos optional, restrict notes, use simple example prompts, guard against revealing special-category information.
5. **International transfers — medium/high:** Railway app/DB currently Singapore, R2 and processor locations not yet verified. Formal inventory and transfer safeguards required.
6. **Rights and transparency — high:** Privacy/Terms are not yet approved; parent/child short notices and working contact are required before public launch.
7. **Reports/exports — medium:** PDF generated on device; JSON includes photo data where owned, but neither is password-encrypted; warn carers to save securely. Verify XSS/HTML escaping in report generator.
8. **Behaviour nudges — medium:** Reward design should avoid coercion and unfair comparisons. Keep parent-reviewed rewards; no punitive deductions, no automatic assessments or child profiling.

## Children's Code applicability and review

The ICO Children's code contains 15 standards, including a DPIA and high-privacy defaults, for services likely to be accessed by UK children, potentially including those based outside the UK. Even with a parent-operated app, assess actual child access and apply a child-appropriate privacy posture. The scope is a legal conclusion to be confirmed.

Risk assessment must be signed off by the controller, not by a software test runner. Document risks, mitigations, owners, due dates and evidence; retest the live UI on phone/tablet/desktop.

## Operational checklist for a release gate

- [ ] Identify the legal controller and a monitored privacy-contact address.
- [ ] Inventory all subprocessors, cross-border data flows and legal bases.
- [ ] Obtain legal review of Privacy Policy and Terms of Use.
- [ ] Validate 7-day soft delete + recovery and write-block behaviour in CI.
- [ ] Inspect R2 bucket lifecycle and object lock, determine maximum backup retention.
- [ ] Restore a recent backup into a fully isolated test Postgres, verify row counts/constraints with **no production writes**.
- [ ] Verify purge deletes every owned table and upload; if backup restored later, suppress resurrections through a deletion tombstone.
- [ ] Determine appropriate photo URL protections and retention changes.
- [ ] Document operator review and acceptance of residual risk.

## Sources

ICO Children's code https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/
ICO right to erasure https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
ICO design guidance https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/designing-products-that-protect-privacy/childrens-code-design-guidance/

**This assessment does not conclude compliance.**
