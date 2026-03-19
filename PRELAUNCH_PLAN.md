# Positive Percy — Pre-Launch Requirements Plan

Version 1.1 — Updated 2026-03-19

---

## IMMEDIATE — Security Hotfixes (before any other work)

Five exploitable issues found during codebase review. Ship before auth work begins.

1. **IDOR on generic DELETE route** (`routes.js:1352`) — no `family_code` check. Any authenticated user can delete any row in any family.
2. **IDOR on generic UPDATE route** (`routes.js:1318–1319`) — same issue. No `family_code` scope check.
3. **`date_of_birth` column on children table** — COPPA risk. Column must be dropped. No UI references exist.
4. **`JWT_SECRET` insecure default** — hardcoded fallback `'positive-percy-secret-change-in-prod'` at `routes.js:10`. Server must refuse to start if not set.
5. **File upload endpoint** — no type or size validation. Accepts any content type, no size limit beyond Express 10MB global.

---

## Phase 1 — Authentication & Accounts

P0 — BLOCKS EVERYTHING

### 1.1 What to Build
- Google OAuth 2.0 login
- Magic link / email OTP login
- Account record: name, email, auth method, created_at
- Session management: JWT with refresh tokens, 30-day expiry, logout all devices
- Safe migration of all existing users — zero data loss

### 1.2 Safe Migration Strategy — CRITICAL

Existing families must not lose their data.

> **Note (v1.1):** Existing users have no real emails — every `users` row has an auto-generated email (`family-CODE@positivepercy.app`). Migration must match by **family code**, not email. When a new account logs in and enters their existing family code, link the new account to that family.

- Add nullable `account_id` FK to families table
- On first login: match to existing family via family code entered during onboarding → create account record → link via `account_families` join table
- Unmatched families remain accessible via legacy access code for 90 days
- Migration runs as background job — zero downtime required

### 1.3 Multi-Parent Model

Each parent has their own account. Multiple accounts link to one shared family via the existing family code invite flow.

- Parent A signs up → creates account → creates family → inserted into `account_families` as `owner`
- Parent B signs up → creates account → enters family code → inserted into `account_families` as `member`
- Both parents share all family data

### 1.4 Auth Endpoints Required

| Endpoint | Method | Description |
|----------|--------|-------------|
| POST /auth/google | POST | Exchange Google token for session |
| POST /auth/magic-link | POST | Send magic link to email |
| GET /auth/verify/:token | GET | Verify magic link, create session |
| POST /auth/refresh | POST | Refresh JWT token |
| POST /auth/logout | POST | Invalidate session |
| POST /auth/logout-all | POST | Revoke all refresh tokens |
| DELETE /auth/account | DELETE | Full account + data deletion |
| GET /auth/export | GET | JSON export of all family data |

### 1.5 DOD — Auth
- Google OAuth and magic link both produce valid session
- Existing user data fully intact post-migration
- JWT expires in 30 days, refresh works silently
- Account deletion wipes atomically: account, account_families, family, children, point_events, redemptions, reward_stack, behavior_categories, quick_actions, family_goals, uploads
- Data export returns complete JSON within 5 seconds
- Magic link tokens expire in 15 minutes

### 1.6 Resend Setup [YOU]
- Add sending domain: noreply@positivepercy.com
- Verify DNS records (SPF, DKIM, DMARC)
- Create new API key scoped to Positive Percy
- Add RESEND_API_KEY to Railway environment variables

---

## Phase 2 — Onboarding Flow

P0 — New user retention

### 2.1 Flow

| Step | Screen | Content | Skip if... |
|------|--------|---------|------------|
| 1 | Welcome | Logo + "Let's set up your family" | Never |
| 2 | Your details | Name field, email pre-filled from auth | Email already captured |
| 3 | Family name | "What should we call your family?" | Never |
| 4 | Add first child | Name + optional photo | Never |
| 5 | Create first reward | Name + Percy Points cost — suggest defaults | Never |
| 6 | Categories | Accept 6 defaults or customise | Never |
| 7 | Done | Populated home screen | Never |

### 2.2 Key Rules
- If family_id + children already exist → skip onboarding entirely
- Progress bar across top
- Back navigation allowed — state preserved
- Progress persisted server-side (`families.onboarding_step`)

### 2.3 DOD — Onboarding
- New user completes flow in under 3 minutes
- Home screen populated after completion
- Existing users bypass entirely
- Progress persists if app closed mid-flow

---

## Phase 3 — Legal Documents

P0 — Required before payments + store submission. OWNER: YOU + legal review.

(See full prompts in build brief)

---

## Phase 4 — Compliance Gates

P0 — Required before store submission

- COPPA consent checkbox + child data gate
- GDPR right to erasure + export (covered by auth endpoints)
- PDPA compliance
- Cookie consent banner
- Privacy Policy + ToS links in footer and at signup

---

## Phase 5 — Security Review

P0 — Before store submission

- npm audit clean
- OWASP ZAP against staging
- Pen test checklist (IDOR, auth bypass, mass assignment, SQLi, XSS, file upload, rate limit)
- All secrets in Railway env vars
- HTTPS enforced
- Database backups enabled

---

## Phase 6 — Error Monitoring

P1 — Sentry integration (frontend + backend)

---

## Phase 7 — Rate Limiting + Abuse Protection

P1 — express-rate-limit + helmet + CORS

---

## Phase 8 — App Store / Google Play

P1 — Capacitor build + store submission

---

## Summary Checklist

### P0 — Must complete before any launch
- [ ] Security hotfixes (IDOR, date_of_birth, JWT_SECRET, upload validation)
- [ ] Auth — Google OAuth + magic link
- [ ] Safe migration of existing users
- [ ] Resend domain + magic link email
- [ ] Onboarding flow
- [ ] Privacy Policy (drafted + legally reviewed)
- [ ] Terms of Service (drafted + legally reviewed)
- [ ] COPPA consent checkbox + child data gate
- [ ] Account deletion endpoint
- [ ] Data export endpoint
- [ ] Security checklist + pen test
- [ ] Rate limiting on auth endpoints
- [ ] Helmet.js + CORS locked down

### P1 — Must complete before store submission
- [ ] Sentry error monitoring
- [ ] Cookie consent banner
- [ ] Railway region documented in Privacy Policy
- [ ] Railway database backups enabled
- [ ] npm audit clean
- [ ] Capacitor build — iOS + Android
- [ ] Apple Developer + Google Play accounts
- [ ] App icons + screenshots
- [ ] Privacy policy URL live and public
- [ ] COPPA declaration in store consoles

### P2 — Before taking payments
- [ ] Stripe account approved
- [ ] Entitlements schema
- [ ] Free tier limits implemented
- [ ] Upgrade flow
- [ ] Billing emails
