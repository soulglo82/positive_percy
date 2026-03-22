# StratosIQ — Legal & Compliance Backlog

> **Date:** 2026-03-22
> **Format:** GitHub Issues
> **Labels:** `legal`, `gdpr`, `compliance`
> **Priority:** P0 (must-have before launch) / P1 (required within 30 days) / P2 (improvement)
> **Complexity:** S (small, <1 day) / M (medium, 1-3 days) / L (large, 3+ days)

---

## P0 — Must-Have Before Launch

### Issue #1: Create Terms of Service Page

**Labels:** `legal`, `compliance`
**Priority:** P0 | **Complexity:** M

**Description:**
Create `/terms` route as a static HTML page matching the existing site design. Content must frame StratosIQ exclusively as a quantitative analysis model, not financial advice.

**Acceptance Criteria / Definition of Done:**
- [ ] Route `/terms` is accessible without authentication
- [ ] Page follows scaffold outline in `PAGE_SCAFFOLDS_OUTLINE.md` Section A
- [ ] All 13 sections present with placeholder content
- [ ] All bracket placeholders (`[DANISH_BUSINESS_NAME]`, `[CVR_NUMBER]`, etc.) clearly marked
- [ ] Matches existing Tailwind/shadcn design system
- [ ] Table of contents with anchor links
- [ ] Print-friendly styles
- [ ] Mobile responsive
- [ ] "Last updated" date visible
- [ ] Footer links to all four legal pages
- [ ] **Reviewed by qualified lawyer before publishing**

---

### Issue #2: Create Privacy Policy Page

**Labels:** `legal`, `gdpr`, `compliance`
**Priority:** P0 | **Complexity:** M

**Description:**
Create `/privacy` route as a static HTML page. Must be GDPR-compliant with Danish controller details, legal basis per processing activity, retention periods, and data subject rights.

**Acceptance Criteria / Definition of Done:**
- [ ] Route `/privacy` is accessible without authentication
- [ ] Page follows scaffold outline in `PAGE_SCAFFOLDS_OUTLINE.md` Section B
- [ ] All 12 sections present with placeholder content
- [ ] Data controller identified: `[DANISH_BUSINESS_NAME]`, CVR: `[CVR_NUMBER]`
- [ ] Legal basis table covers all processing activities (GDPR Art. 6)
- [ ] Retention periods specified per data category
- [ ] All GDPR data subject rights listed (Art. 15-21)
- [ ] Supervisory authority: Datatilsynet with correct URL (dt.dk)
- [ ] Third-party processor table with data locations
- [ ] "No sale of personal data" statement included
- [ ] International transfer safeguards mentioned (SCCs)
- [ ] Matches existing design system
- [ ] Mobile responsive
- [ ] **Reviewed by qualified lawyer before publishing**

---

### Issue #3: Create Model Disclaimer Page

**Labels:** `legal`, `compliance`
**Priority:** P0 | **Complexity:** S

**Description:**
Create `/disclaimer` route. This is the most critical legal page — it must clearly establish that StratosIQ is a quantitative model producing numerical scores, not financial advice.

**Acceptance Criteria / Definition of Done:**
- [ ] Route `/disclaimer` is accessible without authentication
- [ ] Page follows scaffold outline in `PAGE_SCAFFOLDS_OUTLINE.md` Section C
- [ ] All 6 sections present
- [ ] "What StratosIQ Is" section: quantitative analysis model, mathematical algorithms, publicly available data, numerical scores
- [ ] "What StratosIQ Is NOT" section: not investment advice, not financial advice, not recommendations, not personalised
- [ ] All three products explicitly named and described: Strike, Patrol, Recon
- [ ] "Past model scores do not predict future results" statement
- [ ] "Users are solely responsible for all trading and investment decisions"
- [ ] Regulatory status clarified (not registered investment advisor, not regulated under MiFID II)
- [ ] Matches existing design system
- [ ] Mobile responsive
- [ ] **Reviewed by qualified lawyer before publishing**

---

### Issue #4: Add Site-Wide Disclaimer Footer

**Labels:** `legal`, `compliance`
**Priority:** P0 | **Complexity:** S

**Description:**
Add a footer component to `Layout.jsx` that appears on every page. Must include links to all legal pages and a one-line disclaimer.

**Acceptance Criteria / Definition of Done:**
- [ ] Footer component created and added to `Layout.jsx`
- [ ] Links to: `/terms`, `/privacy`, `/disclaimer`, `/cookie-policy`
- [ ] One-line disclaimer text: *"StratosIQ is a quantitative analysis model. It is not financial advice. Users are solely responsible for all trading decisions."*
- [ ] Copyright line: *"© {YEAR} [DANISH_BUSINESS_NAME]. CVR: [CVR_NUMBER]."*
- [ ] Matches existing design system (subtle, not dominant)
- [ ] Visible on all pages including authenticated and public routes
- [ ] Mobile responsive

---

### Issue #5: Language Audit — Remove/Replace Problematic Language

**Labels:** `legal`, `compliance`
**Priority:** P0 | **Complexity:** S

**Description:**
Review all user-facing content for language that could be construed as investment advice, recommendations, or personalised guidance. Replace per the audit in `PRODUCT_FRAMING_AUDIT.md`.

**Acceptance Criteria / Definition of Done:**
- [ ] All user-facing text audited against prohibited patterns list
- [ ] No instances of: "we recommend", "you should", "best stocks", "investment advice", "financial advice", "our picks", "predicted returns", "guaranteed", "personalised for you"
- [ ] All product descriptions use compliant framing (quantitative model, numerical scores, publicly available data)
- [ ] Strike, Patrol, Recon descriptions are consistent across all pages
- [ ] `src/constants/stratosiq-terminology.js` created with compliant product descriptions
- [ ] All internal docs that may become public reviewed

---

## P1 — Required Within 30 Days of Launch

### Issue #6: Implement Cookie Consent Banner

**Labels:** `legal`, `gdpr`, `compliance`
**Priority:** P1 | **Complexity:** M

**Description:**
Implement a cookie consent banner per the specification in `COOKIE_CONSENT_SPEC.md`. Must appear on first visit before non-essential cookies are set.

**Acceptance Criteria / Definition of Done:**
- [ ] `<CookieConsentBanner />` component created
- [ ] Mounted in `App.jsx` outside auth-gated routes
- [ ] Appears on first visit (no consent stored)
- [ ] Essential cookies only by default (no pre-checked non-essential boxes)
- [ ] Three buttons: Reject All, Accept Selected, Accept All
- [ ] Reject button has equal visual weight to Accept buttons (no dark patterns)
- [ ] Cookie categories: Strictly Necessary (always on), Functional (toggle), Analytics (toggle)
- [ ] Consent stored in localStorage with timestamp
- [ ] Version string in code (`CURRENT_CONSENT_VERSION`)
- [ ] Re-prompts if stored consent version differs from code version
- [ ] Links to `/cookie-policy`
- [ ] Keyboard accessible and screen reader compatible
- [ ] Mobile responsive
- [ ] Non-essential scripts conditionally loaded based on consent

---

### Issue #7: Create Cookie Policy Page

**Labels:** `legal`, `gdpr`, `compliance`
**Priority:** P1 | **Complexity:** S

**Description:**
Create `/cookie-policy` route as a static HTML page listing all cookies and storage used, with categories and user controls.

**Acceptance Criteria / Definition of Done:**
- [ ] Route `/cookie-policy` is accessible without authentication
- [ ] Page follows scaffold outline in `PAGE_SCAFFOLDS_OUTLINE.md` Section D
- [ ] All 8 sections present
- [ ] Cookie table listing every cookie/localStorage key with: name, type, category, purpose, duration
- [ ] Categories clearly defined: Strictly Necessary, Functional, Analytics
- [ ] "Manage preferences" button that re-opens consent banner
- [ ] Browser cookie management instructions
- [ ] Matches existing design system
- [ ] Mobile responsive
- [ ] **Reviewed by qualified lawyer before publishing**

---

### Issue #8: Migrate Auth Tokens from localStorage to HttpOnly Cookies

**Labels:** `compliance`, `security`
**Priority:** P1 | **Complexity:** L

**Description:**
JWT tokens are currently stored in localStorage (`positive_percy_token`), which is vulnerable to XSS attacks. For a financial-adjacent product, this should use HttpOnly cookies set by the server.

**Acceptance Criteria / Definition of Done:**
- [ ] Server sets JWT as HttpOnly, Secure, SameSite=Strict cookie
- [ ] Client no longer stores token in localStorage
- [ ] `AuthContext.jsx` updated to use cookie-based auth flow
- [ ] API requests use credentials: 'include' for cookie transmission
- [ ] CSRF protection implemented (double-submit cookie or token)
- [ ] Logout clears the HttpOnly cookie via server endpoint
- [ ] Cookie listed in Cookie Policy as Strictly Necessary
- [ ] All existing auth flows tested and working

---

### Issue #9: GDPR Data Subject Rights Process

**Labels:** `gdpr`, `compliance`
**Priority:** P1 | **Complexity:** M

**Description:**
Implement a process for handling GDPR data subject requests (access, rectification, erasure, portability, restriction, objection).

**Acceptance Criteria / Definition of Done:**
- [ ] Contact email for data requests documented in Privacy Policy
- [ ] Internal process document for handling each request type
- [ ] Data export endpoint (JSON format) for portability requests
- [ ] Account deletion endpoint for erasure requests
- [ ] Response SLA: within 30 days (GDPR requirement)
- [ ] Identity verification process for requests
- [ ] Request logging for compliance audit trail

---

## P2 — Improvements

### Issue #10: Add "Not Financial Advice" Interstitial on Model Output Pages

**Labels:** `legal`, `compliance`
**Priority:** P2 | **Complexity:** S

**Description:**
When a user first views model output (Strike, Patrol, or Recon scores), display a one-time interstitial reminder that scores are quantitative model output, not financial advice.

**Acceptance Criteria / Definition of Done:**
- [ ] Interstitial dialog shown once per session on first model output view
- [ ] Text: "StratosIQ produces numerical scores using mathematical algorithms applied to publicly available data. These scores are not investment advice, financial advice, or recommendations. You are solely responsible for all trading decisions."
- [ ] "I understand" button to dismiss
- [ ] Dismissal stored in sessionStorage (re-appears each session)
- [ ] Does not block emergency/critical UI elements

---

### Issue #11: Add Disclaimer Watermark to Exported/Shared Model Output

**Labels:** `legal`, `compliance`
**Priority:** P2 | **Complexity:** S

**Description:**
If model output can be exported, screenshotted via share feature, or downloaded, include a disclaimer watermark or footer text on the output.

**Acceptance Criteria / Definition of Done:**
- [ ] Any exported model output includes: "StratosIQ quantitative model output. Not financial advice."
- [ ] Any shareable images include disclaimer text
- [ ] PDF/CSV exports include disclaimer header

---

### Issue #12: Implement Data Retention Automation

**Labels:** `gdpr`, `compliance`
**Priority:** P2 | **Complexity:** M

**Description:**
Automate data retention policies as specified in the Privacy Policy. Data older than retention periods should be anonymized or deleted.

**Acceptance Criteria / Definition of Done:**
- [ ] Cron job or scheduled task for retention enforcement
- [ ] Usage data anonymized after 90 days, deleted after 26 months
- [ ] Technical logs deleted after 90 days
- [ ] Inactive accounts flagged after [X] months with email notification
- [ ] Deletion logged for audit trail
- [ ] Retention periods match Privacy Policy exactly

---

### Issue #13: EU Right of Withdrawal Implementation

**Labels:** `legal`, `compliance`
**Priority:** P2 | **Complexity:** S

**Description:**
Implement the 14-day EU right of withdrawal flow. If a user has not accessed model output within 14 days of purchase, they can request a full refund. Include waiver acknowledgment if they access content early.

**Acceptance Criteria / Definition of Done:**
- [ ] Withdrawal request mechanism (email or in-app)
- [ ] Track first access to model output after subscription purchase
- [ ] If accessed within 14 days: display waiver acknowledgment
- [ ] If not accessed: allow full refund within 14 days
- [ ] Withdrawal form template available at `/terms` or linked from it
- [ ] Process documented in Terms of Service

---

### Issue #14: Third-Party Processor Register (GDPR Art. 30)

**Labels:** `gdpr`, `compliance`
**Priority:** P2 | **Complexity:** S

**Description:**
Maintain a register of all third-party data processors with DPAs (Data Processing Agreements) in place.

**Acceptance Criteria / Definition of Done:**
- [ ] Processor register document created (internal)
- [ ] DPA signed/confirmed with: Stripe, Cloudflare, hosting provider, email provider
- [ ] Each processor entry includes: name, purpose, data shared, data location, DPA status
- [ ] Register referenced in Privacy Policy
- [ ] Review schedule: annually or when adding new processors

---

## Summary Table

| # | Title | Priority | Complexity | Labels |
|---|-------|----------|------------|--------|
| 1 | Terms of Service page | P0 | M | legal, compliance |
| 2 | Privacy Policy page | P0 | M | legal, gdpr, compliance |
| 3 | Model Disclaimer page | P0 | S | legal, compliance |
| 4 | Site-wide disclaimer footer | P0 | S | legal, compliance |
| 5 | Language audit remediation | P0 | S | legal, compliance |
| 6 | Cookie consent banner | P1 | M | legal, gdpr, compliance |
| 7 | Cookie Policy page | P1 | S | legal, gdpr, compliance |
| 8 | Auth token migration (HttpOnly) | P1 | L | compliance, security |
| 9 | GDPR data subject rights process | P1 | M | gdpr, compliance |
| 10 | Model output interstitial | P2 | S | legal, compliance |
| 11 | Export disclaimer watermark | P2 | S | legal, compliance |
| 12 | Data retention automation | P2 | M | gdpr, compliance |
| 13 | EU right of withdrawal flow | P2 | S | legal, compliance |
| 14 | Third-party processor register | P2 | S | gdpr, compliance |
