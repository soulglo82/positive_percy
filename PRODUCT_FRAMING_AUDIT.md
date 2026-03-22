# StratosIQ — Product Framing Audit Report

> **Date:** 2026-03-22
> **Branch:** `claude/add-product-framing-SKv4t`
> **Scope:** Code review, language audit, page scaffold outlines, cookie consent spec, backlog
> **Status:** Scaffolding only — final legal text must be reviewed by a qualified lawyer before publishing.

---

## Part 1: Code Review Findings

### 1.1 Existing Disclaimer Text

**Result: NONE FOUND in live/rendered code.**

Searched for: `STRATOS_LEGAL`, `"not financial advice"`, `"recommend"`, `"you should"`, `"educational"`, `"informational"`, `"disclaimer"`, `"advice"`, `"responsibility"`.

All matches were in internal markdown documentation files only (REVIEW.md, BACKLOG.md, MONETIZATION_SPEC.md, DEEP_DIVE_ASSESSMENT_PLAN.md). No disclaimer text is rendered in the application UI.

### 1.2 Existing Legal Page Routes

| Route | Status |
|-------|--------|
| `/terms` | **Does not exist** |
| `/privacy` | **Does not exist** |
| `/disclaimer` | **Does not exist** |
| `/cookie-policy` | **Does not exist** |

The only routes defined are: `/ParentDashboard`, `/ChildView`, `/Activity`, `/Rewards`, `/ParentProfile`, `/FamilyLogin`.

### 1.3 Cookie & Storage Usage

| Mechanism | Key | File | Purpose |
|-----------|-----|------|---------|
| localStorage | `positive_percy_family_code` | `src/lib/AuthContext.jsx:5` | Auth: family code persistence |
| localStorage | `positive_percy_token` | `src/lib/AuthContext.jsx:6` | Auth: JWT token persistence |
| localStorage | `percy_onboarding_done` | `src/components/OnboardingTips.jsx:34` | UX: onboarding completion flag |
| localStorage | (family code read) | `src/api/entities.js:6` | API: auth header injection |

**Cookies:** No `document.cookie` usage detected. No HTTP cookies set by the server.

**Consent mechanism:** NONE. No cookie banner, consent modal, or consent tracking exists anywhere in the codebase.

### 1.4 Third-Party Services Detected

| Service | Purpose | Data Sent | File |
|---------|---------|-----------|------|
| Supabase (external URL) | Logo hosting | None (fetch only) | Layout.jsx |
| PostgreSQL | Database | All user data | server/db.js |
| WebSocket | Real-time sync | Family events | server/index.js |

**No analytics, tracking pixels, or third-party cookies detected.**

---

## Part 4: Language Audit Report — Flagged Instances

### Critical Product Framing Requirement

StratosIQ must be framed exclusively as a **quantitative analysis model** that:
- Applies mathematical algorithms to publicly available market data
- Produces numerical scores
- Is NOT investment advice, financial advice, or recommendations
- Users are solely responsible for all trading decisions

### Flagged Instances

> **Note:** The current codebase is the Positive Percy children's rewards app. The StratosIQ product framing has not yet been applied. The flags below cover language patterns that must be avoided or corrected when StratosIQ content is added.

#### Flag 1: No Product Disclaimer Anywhere
- **Location:** Entire codebase
- **Issue:** Zero disclaimer text exists in any user-facing page
- **Required:** Every page must include footer-level disclaimer: *"StratosIQ is a quantitative analysis model. It is not financial advice. Users are solely responsible for all trading decisions."*

#### Flag 2: REVIEW.md — "Recommendation" Language
- **File:** `REVIEW.md` (lines 48, 56, 65, 70, 75, 124, 149)
- **Text:** Multiple instances of `**Recommendation:**` as section headers
- **Risk:** Low (internal doc only, not user-facing)
- **Action:** If any of these docs become public-facing, replace "Recommendation" with "Consideration" or "Option"

#### Flag 3: MONETIZATION_SPEC.md — "Recommend" Language
- **File:** `MONETIZATION_SPEC.md` (lines 6, 307)
- **Text:** `"Every recommendation below"`, `"Recommend: Stripe now"`
- **Risk:** Low (internal doc only)
- **Action:** Same as above — reframe if published

#### Flag 4: Product Terminology Not StratosIQ-Aligned
- **File:** `src/constants/terminology.js`
- **Issue:** All terminology is Percy-specific. When StratosIQ pages are added, a separate terminology constant file for StratosIQ product names (Strike, Patrol, Recon) must be created.
- **Action:** Create `src/constants/stratosiq-terminology.js` with model names and compliant descriptions

#### Flag 5: Missing Footer with Legal Links
- **File:** `src/Layout.jsx`
- **Issue:** No footer section exists at all. No links to Terms, Privacy, Disclaimer, or Cookie Policy.
- **Action:** Add footer component with links to all four legal pages

#### Flag 6: Auth Tokens in localStorage
- **File:** `src/lib/AuthContext.jsx` (lines 5-6)
- **Issue:** JWT tokens stored in localStorage are vulnerable to XSS. For a financial-adjacent product, this is a compliance risk.
- **Action:** Migrate to HttpOnly cookies for token storage (separate security task)

### Language Patterns to Avoid in All StratosIQ Content

| Prohibited Pattern | Compliant Replacement |
|--------------------|-----------------------|
| "We recommend..." | "The model produces a score of..." |
| "You should buy/sell..." | "The numerical output for [ticker] is..." |
| "Best stocks to..." | "Highest-scoring tickers by model output..." |
| "Investment advice" | "Quantitative analysis" |
| "Financial advice" | "Numerical model output" |
| "Our picks" | "Model-generated scores" |
| "Predicted returns" | "Historical model scores" |
| "Guaranteed" / "Certain" | "Based on mathematical algorithms applied to public data" |
| "Educational purposes" | Avoid — implies a teaching relationship; use "informational" sparingly or "for reference only" |
| "You should consider..." | "Users may independently evaluate..." |
| "We suggest..." | "The model output indicates..." |
| "Personalized for you" | Never use — implies personalised advice |
| "Based on your portfolio" | Never use — implies knowledge of user holdings |
| "Outperform the market" | Never use — implies performance guarantee |

### Products Requiring Disclaimer Coverage

All three StratosIQ products must be explicitly named in the Model Disclaimer:

| Product | Description (compliant framing) |
|---------|-------------------------------|
| **Strike** | Quantitative scoring model applying algorithms to public market data |
| **Patrol** | Automated monitoring model producing numerical alerts based on public data |
| **Recon** | Research-oriented model generating quantitative scores from public data |

---

## Summary of Compliance Gaps

| Gap | Severity | Current State |
|-----|----------|---------------|
| No Terms of Service | **P0** | Page does not exist |
| No Privacy Policy | **P0** | Page does not exist |
| No Model Disclaimer | **P0** | No disclaimer anywhere |
| No Cookie Policy | **P1** | Page does not exist |
| No Cookie Consent Banner | **P1** | No consent mechanism |
| No Footer with Legal Links | **P1** | No footer exists |
| No GDPR Data Subject Rights Process | **P0** | No process documented |
| Auth tokens in localStorage | **P2** | Security concern for financial-adjacent product |
