# StratosIQ — Cookie Consent Banner Specification

> **Date:** 2026-03-22
> **Status:** Specification only — not yet implemented.

---

## Behavior Requirements

### First Visit
1. Banner appears **before** any non-essential cookies/storage are set
2. Only strictly necessary cookies are active by default
3. User must take explicit action (accept or reject) before non-essential cookies are set
4. No pre-checked boxes for non-essential categories

### Banner UI

```
┌─────────────────────────────────────────────────────────────────────┐
│  🍪 Cookie Preferences                                              │
│                                                                     │
│  We use cookies and similar technologies to provide our service.    │
│  Strictly necessary cookies are always active. You can choose       │
│  whether to allow optional cookies below.                           │
│                                                                     │
│  Learn more in our [Cookie Policy](/cookie-policy).                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ✅ Strictly Necessary          (always on, cannot toggle)  │    │
│  │ ☐  Functional Cookies          (toggle)                    │    │
│  │ ☐  Analytics Cookies           (toggle)                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  [ Reject All ]          [ Accept Selected ]    [ Accept All ]      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Button Behavior

| Button | Action |
|--------|--------|
| **Reject All** | Sets consent to essential-only. Stores consent record. Closes banner. |
| **Accept Selected** | Stores consent for toggled categories only. Closes banner. |
| **Accept All** | Enables all categories. Stores consent record. Closes banner. |

### Key Requirements
- **Reject option always visible** — same visual weight as Accept buttons (not hidden, not smaller)
- **No "dark patterns"** — reject must not be harder to find than accept
- Banner must not block page interaction (positioned as bottom bar or modal overlay with scroll-through)
- Accessible: keyboard navigable, ARIA labels, screen reader compatible
- Mobile responsive

---

## Consent Storage (localStorage)

### Keys

```javascript
const CONSENT_STORAGE_KEY = 'stratosiq_consent';
const CONSENT_VERSION_KEY = 'stratosiq_consent_version';
const CURRENT_CONSENT_VERSION = '1.0'; // Increment on policy changes
```

### Consent Object Shape

```javascript
{
  version: '1.0',
  timestamp: '2026-03-22T12:00:00.000Z',
  categories: {
    necessary: true,       // Always true, cannot be changed
    functional: false,     // User choice
    analytics: false       // User choice
  }
}
```

### Storage Logic

```javascript
// On consent action:
localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentObject));
localStorage.setItem(CONSENT_VERSION_KEY, CURRENT_CONSENT_VERSION);

// On page load — check if re-prompt needed:
const storedVersion = localStorage.getItem(CONSENT_VERSION_KEY);
if (!storedVersion || storedVersion !== CURRENT_CONSENT_VERSION) {
  showConsentBanner();
}
```

---

## Re-Prompt Logic

The banner must re-appear if:

1. **No consent stored** — first visit
2. **Consent version mismatch** — `CURRENT_CONSENT_VERSION` in code differs from stored version
3. **Consent data corrupted** — JSON parse fails or missing required fields

### Version Change Process
1. Developer updates `CURRENT_CONSENT_VERSION` in the code
2. On next page load, stored version no longer matches
3. Banner re-appears with updated options
4. Previous consent is cleared and user must re-consent

---

## Integration Points

### Where to Mount
- Component: `<CookieConsentBanner />`
- Mount in: `src/App.jsx` (outside of auth-gated routes — must appear for all visitors)
- Position: Fixed bottom bar (`fixed bottom-0 left-0 right-0 z-50`)

### Conditional Loading of Non-Essential Scripts

```javascript
// Example: only load analytics if user consented
function loadAnalytics() {
  const consent = getConsent();
  if (consent?.categories?.analytics) {
    // Initialize analytics
  }
}

function getConsent() {
  try {
    return JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}
```

### Cookie Policy Page Link
- Banner links to `/cookie-policy`
- Cookie Policy page includes a "Manage preferences" button that re-opens the consent banner

---

## Design Specs (Tailwind Classes)

```
Container:  fixed bottom-0 inset-x-0 z-50 p-4 bg-white/95 backdrop-blur
            border-t border-gray-200 shadow-lg
Card:       max-w-2xl mx-auto rounded-xl p-6
Heading:    text-lg font-semibold text-gray-900
Body text:  text-sm text-gray-600
Link:       text-purple-600 hover:text-purple-800 underline
Toggle:     shadcn/ui Switch component
Reject btn: variant="outline" (equal visual weight)
Accept btn: variant="default" (purple primary)
```

---

## Compliance Notes

- Complies with GDPR consent requirements (freely given, specific, informed, unambiguous)
- Complies with ePrivacy Directive (cookie consent before non-essential cookies)
- No backend required — all consent managed client-side via localStorage
- Consent record includes timestamp for audit trail
- Essential cookies (auth, security) do not require consent under ePrivacy Directive Art. 5(3)
