# Positive Percy — typography handover

**Approved families:** Nunito for headings, Poppins for body/UI. This supersedes the production Batch D Figtree/Fredoka type stack.

| Surface | Family | Weight | Default suggestion |
|--|--|--|--|
| Marketing H1 / page hero | Nunito | 800 | 40–52 CSS px responsive |
| App page title | Nunito | 800 | 28–32 CSS px |
| Section title | Nunito | 700 | 20–24 CSS px |
| Card heading / CTA | Nunito | 700 | 16–18 CSS px |
| Body text | Poppins | 400 | 15–16 CSS px |
| UI label / input | Poppins | 500 | 14–16 CSS px |
| Button / emphasis | Poppins | 600 | 14–16 CSS px |
| Supporting metadata | Poppins | 400 | 12–14 CSS px; maintain contrast |

Google Fonts family pages:
- https://fonts.google.com/specimen/Nunito
- https://fonts.google.com/specimen/Poppins

Both families are under the SIL Open Font License. Self-host **proper licensed binaries** in the actual codebase, retain OFL notices, test Latin/extended language coverage, and include graceful system fallbacks. Font files are **not included in this handover archive**.

Example CSS:
```css
@font-face { font-family:'Nunito'; src:url('/fonts/nunito-700.woff2') format('woff2'); font-weight:700; font-display:swap; }
@font-face { font-family:'Nunito'; src:url('/fonts/nunito-800.woff2') format('woff2'); font-weight:800; font-display:swap; }
@font-face { font-family:'Poppins'; src:url('/fonts/poppins-400.woff2') format('woff2'); font-weight:400; font-display:swap; }
@font-face { font-family:'Poppins'; src:url('/fonts/poppins-500.woff2') format('woff2'); font-weight:500; font-display:swap; }
@font-face { font-family:'Poppins'; src:url('/fonts/poppins-600.woff2') format('woff2'); font-weight:600; font-display:swap; }
```
This is a code sample: the referenced files must actually be acquired in deployment.
