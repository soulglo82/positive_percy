# Positive Percy -- Product Overview

> Last updated: February 2026
> Live URL: https://positivepercy.up.railway.app
> Repository: github.com/soulglo82/positive_percy

---

## 1. Product Summary

**Positive Percy** is a gamified parenting web application that helps families track children's positive behavior through a points-based reward system. Parents award points for good behaviors, children view their progress and request rewards, and parents approve or deny those requests.

**Tagline:** "Building bright futures, one point at a time"

**Target audience:** Parents of children aged 3-13 who want a structured, positive-reinforcement approach to behavior management.

**Core value proposition:** Replaces informal "star chart" systems with a digital, multi-parent, multi-child tool that tracks progress, provides analytics, and teaches children delayed gratification through a reward store.

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.2.0 | UI framework |
| Vite | 6.1.0 | Build tool and dev server |
| React Router DOM | 6.26.0 | Client-side routing |
| TailwindCSS | 3.4.17 | Utility-first CSS framework |
| Shadcn/ui (Radix UI) | Multiple | Pre-built accessible component library (50+ components) |
| Framer Motion | 11.16.4 | Animations and transitions |
| TanStack React Query | 5.84.1 | Server state management, caching, and polling |
| React Hook Form + Zod | 7.54.2 / 3.24.2 | Form validation |
| date-fns | 3.6.0 | Date formatting and calculation |
| Lucide React | 0.475.0 | Icon library |
| Sonner | 2.0.1 | Toast notifications |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | (runtime) | Server runtime |
| Express.js | 4.22.1 | HTTP server and API routing |
| PostgreSQL | (external) | Relational database |
| pg | 8.18.0 | Node.js PostgreSQL client |

### Installed but Unused
| Package | Version | Intended Purpose |
|---|---|---|
| canvas-confetti | 1.9.4 | Celebration effects (never imported) |
| html2canvas | 1.4.1 | Screenshot/shareable image generation (never imported) |
| recharts | 2.15.4 | Data visualization charts (never imported) |
| jspdf | 2.5.2 | PDF generation (never imported) |
| three | 0.171.0 | 3D rendering (never imported) |
| react-leaflet | 4.2.1 | Map rendering (never imported) |
| react-quill | 2.0.0 | Rich text editor (never imported) |
| react-markdown | 9.0.1 | Markdown rendering (never imported) |
| @hello-pangea/dnd | 17.0.0 | Drag and drop (never imported) |
| moment | 2.30.1 | Date handling (duplicate of date-fns, never imported) |

### Deployment
| Component | Detail |
|---|---|
| Platform | Railway.app |
| Build tool | Nixpacks (Railway default) |
| Build command | `npm install && npm run build` |
| Start command | `npm start` (runs `node server/index.js`) |
| Database | Railway-provisioned PostgreSQL (via `DATABASE_URL` env var) |
| SSL | Enforced in production (`rejectUnauthorized: false`) |
| Restart policy | On failure, max 10 retries |
| Domain | `positivepercy.up.railway.app` |

---

## 3. Architecture

```
                         ┌─────────────────────┐
                         │   Railway.app Host   │
                         │                      │
  Browser ──── HTTPS ────▶  Express (port 3000) │
                         │   ├── /api/*  ───────▶  PostgreSQL
                         │   └── /*  ───────────▶  Static dist/ (React SPA)
                         │                      │
                         └─────────────────────┘
```

**Request flow:**
1. All requests hit the Express server on port 3000
2. Requests to `/api/*` are handled by `server/routes.js` and query PostgreSQL
3. All other requests serve the Vite-built static files from `dist/`
4. SPA fallback: any unmatched route returns `dist/index.html` for client-side routing

**Development flow:**
1. `npm run dev` starts Vite dev server (default port 5173)
2. Vite proxies `/api` requests to `http://localhost:3000`
3. Express must be running separately for API access during development

---

## 4. Database Schema

### Tables

**families**
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| family_code | TEXT | UNIQUE, NOT NULL (6-character alphanumeric) |
| family_name | TEXT | NOT NULL |
| created_date | TIMESTAMPTZ | DEFAULT NOW() |

**children**
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| name | TEXT | NOT NULL |
| avatar_url | TEXT | Nullable (path to uploaded image) |
| total_points | INTEGER | DEFAULT 0 |
| weekly_points | INTEGER | DEFAULT 0 |
| weekly_target | INTEGER | DEFAULT 50 |
| last_reset_date | TEXT | Nullable (ISO date string) |
| parent_email | TEXT | Nullable (legacy, no longer used) |
| family_code | TEXT | Links to families.family_code |
| created_date | TIMESTAMPTZ | DEFAULT NOW() |

**point_events**
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| child_id | UUID | NOT NULL (FK to children.id) |
| points | INTEGER | NOT NULL (positive = award, negative = deduction) |
| category | TEXT | NOT NULL (e.g., "Homework", "Kindness") |
| note | TEXT | Nullable (optional description) |
| child_name | TEXT | Denormalized from children.name |
| family_code | TEXT | Links to families.family_code |
| created_date | TIMESTAMPTZ | DEFAULT NOW() |

**rewards**
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| title | TEXT | NOT NULL |
| description | TEXT | Nullable |
| cost_points | INTEGER | NOT NULL |
| image_url | TEXT | Nullable |
| emoji | TEXT | Nullable (single emoji character) |
| visible_to_child | BOOLEAN | DEFAULT true |
| assigned_child_ids | TEXT[] | DEFAULT '{}' (PostgreSQL array) |
| family_code | TEXT | Links to families.family_code |
| created_date | TIMESTAMPTZ | DEFAULT NOW() |

**redemptions**
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| child_id | UUID | NOT NULL |
| child_name | TEXT | NOT NULL (denormalized) |
| reward_id | UUID | NOT NULL |
| reward_title | TEXT | NOT NULL (denormalized) |
| reward_cost | INTEGER | NOT NULL |
| status | TEXT | DEFAULT 'Pending' ('Pending', 'Approved', 'Denied') |
| family_code | TEXT | Links to families.family_code |
| created_date | TIMESTAMPTZ | DEFAULT NOW() |

**uploads**
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| data | TEXT | NOT NULL (base64 data URL) |
| content_type | TEXT | NOT NULL |
| created_date | TIMESTAMPTZ | DEFAULT NOW() |

**users**
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, auto-generated |
| email | TEXT | UNIQUE, NOT NULL (auto-generated: `family-CODE@positivepercy.app`) |
| full_name | TEXT | Nullable |
| family_code | TEXT | Links to families.family_code |
| mum_name | TEXT | Nullable |
| mum_phone | TEXT | Nullable |
| dad_name | TEXT | Nullable |
| dad_phone | TEXT | Nullable |
| created_date | TIMESTAMPTZ | DEFAULT NOW() |

### Schema notes
- No foreign key constraints are enforced at the database level
- `family_code` is the primary data-isolation mechanism but is not enforced via FK
- `child_name` is denormalized into `point_events` and `redemptions` for display convenience
- `uploads` stores base64 image data directly in the database (no external file storage)
- Migration scripts run on startup via `initDb()` to add columns to existing tables

---

## 5. API Endpoints

### Authentication
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/family/create` | Create a new family, returns family_code |
| POST | `/api/family/join` | Validate and join an existing family by code |
| GET | `/api/family/:code` | Get family info by code |
| GET | `/api/auth/me?family_code=` | Get or auto-create user for a family |
| PUT | `/api/auth/me?family_code=` | Update user profile fields |

### File Management
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/upload` | Upload base64 image, returns file_url |
| GET | `/api/uploads/:id` | Serve uploaded image as binary with caching |

### Generic Entity CRUD
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/:entity?sort=&limit=&family_code=` | List entities with optional sort, limit, family filter |
| POST | `/api/:entity/filter` | Filter entities by field values |
| POST | `/api/:entity` | Create entity |
| PUT | `/api/:entity/:id` | Update entity by ID |
| DELETE | `/api/:entity/:id` | Delete entity by ID |

Supported entity values: `children`, `point_events`, `rewards`, `redemptions`

---

## 6. Application Pages & User Flows

### Page inventory
| Route | Page Component | Purpose |
|---|---|---|
| `/` | ParentDashboard | Main parent view -- child cards, pending redemptions, add/edit/award |
| `/Summary` | Summary | Weekly analytics -- stats cards, top categories, per-child progress |
| `/Rewards` | Rewards | Parent reward store management -- create, edit, toggle visibility |
| `/ChildView` | ChildView | Child-facing view -- avatar, points, progress bar, request rewards |
| `/History` | History | Point event log with filters by child and category |
| `/ParentProfile` | ParentProfile | Family name editing, family code display and sharing |
| (pre-auth) | FamilyLogin | Create family or join with code |

### User flow: Family onboarding
```
1. Parent opens app → sees FamilyLogin
2. Taps "Create a Family" → enters family name → gets 6-char code
3. Code displayed with copy button → auto-redirected to ParentDashboard
4. Second parent opens app → taps "Join with Code" → enters code → sees same dashboard
```

### User flow: Daily point tracking
```
1. Parent opens ParentDashboard → sees child cards
2. Taps green "Add" on a child → AddPointsModal opens
3. Selects preset amount (5/10/15/20/25) or enters custom → selects category → optional note
4. Taps "Award Points" → toast confirms → child card updates immediately
```

### User flow: Reward redemption
```
1. Child opens ChildView on weekend → sees their points and available rewards
2. Taps "Request" on a reward they can afford → toast "Request sent to your parent!"
3. Parent's dashboard shows amber "Pending Reward Requests" card (polls every 5s)
4. Parent taps "Approve" → points deducted from child → toast confirms
   OR taps "Deny" → request marked denied → no points change
```

### User flow: Weekly cycle
```
Monday: Weekly points auto-reset to 0 (runs in ParentDashboard queryFn)
Mon-Fri: Parents award/deduct points throughout the week
Weekend: Children can browse reward store and submit requests
Sunday night: Parents review Summary page for the week's analytics
```

---

## 7. File Structure

```
positive_percy/
├── server/
│   ├── index.js              # Express server setup, static file serving
│   ├── routes.js             # All API endpoints (auth, CRUD, uploads)
│   └── db.js                 # PostgreSQL pool, schema init, migrations
├── src/
│   ├── pages/
│   │   ├── FamilyLogin.jsx   # Create/join family (pre-auth)
│   │   ├── ParentDashboard.jsx # Main parent view
│   │   ├── Summary.jsx       # Weekly analytics
│   │   ├── Rewards.jsx       # Reward management
│   │   ├── ChildView.jsx     # Child-facing reward browser
│   │   ├── History.jsx       # Point event log
│   │   └── ParentProfile.jsx # Family profile & code sharing
│   ├── components/
│   │   ├── child/
│   │   │   ├── ChildCard.jsx        # Individual child display card
│   │   │   ├── AddChildModal.jsx    # Create child dialog
│   │   │   ├── EditChildModal.jsx   # Edit child dialog
│   │   │   └── AddPointsModal.jsx   # Award/deduct points dialog
│   │   ├── rewards/
│   │   │   ├── RewardCard.jsx       # Reward display (parent + child views)
│   │   │   ├── AddRewardModal.jsx   # Create reward dialog
│   │   │   └── EditRewardModal.jsx  # Edit reward dialog
│   │   ├── redemptions/
│   │   │   └── RedemptionCard.jsx   # Pending request with approve/deny
│   │   ├── history/
│   │   │   └── PointEventItem.jsx   # Individual event in history list
│   │   ├── ui/                      # 50+ Shadcn/ui components
│   │   └── UserNotRegisteredError.jsx
│   ├── api/
│   │   ├── entities.js       # Entity class (list, filter, create, update, delete)
│   │   └── integrations.js   # Image resize and upload utility
│   ├── lib/
│   │   ├── AuthContext.jsx   # Family auth context (create, join, logout)
│   │   ├── query-client.js   # React Query client configuration
│   │   ├── utils.js          # Utility functions (cn, isIframe)
│   │   ├── utils.ts          # createPageUrl helper
│   │   └── PageNotFound.jsx  # 404 page
│   ├── hooks/
│   │   └── use-mobile.jsx    # Mobile breakpoint detection hook
│   ├── App.jsx               # Root component with routing and auth guard
│   ├── Layout.jsx            # Navigation bar with page links
│   ├── main.jsx              # React DOM entry point
│   ├── index.css             # Global styles and Tailwind directives
│   └── pages.config.js       # Page routing configuration map
├── entities/
│   ├── Child.json            # JSON schema definition
│   ├── Point_Event.json      # JSON schema definition
│   ├── Reward.json           # JSON schema definition
│   └── Redemption.json       # JSON schema definition
├── public/
│   └── manifest.json         # PWA manifest (name, icons, theme)
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
├── jsconfig.json
├── components.json           # Shadcn/ui configuration
├── railway.json              # Railway deployment config
├── index.html                # HTML shell with PWA meta tags
└── .gitignore
```

---

## 8. Current Feature Set

### Implemented and Working
| Feature | Status | Notes |
|---|---|---|
| Family creation with unique code | Working | 6-char alphanumeric, retry on collision |
| Family join with code | Working | Case-insensitive, error on invalid code |
| Multi-parent access | Working | Both parents use same family code |
| Add children with avatars | Working | Image resize + upload, name, weekly target |
| Edit child profiles | Working | Name, avatar, targets, manual point adjustment |
| Award points with categories | Working | 8 categories, preset amounts, optional notes |
| Deduct points | Working | Same modal as award, negative values |
| Weekly auto-reset (Monday) | Working | Runs client-side in queryFn (has issues -- see BACKLOG) |
| Reward store creation | Working | Title, emoji, cost, description, child assignment |
| Reward visibility toggle | Working | Hide/show rewards from child view |
| Child-facing view | Working | Avatar, points, progress bar, reward browsing |
| Weekend-only reward requests | Working | `isWeekend()` gate on request buttons |
| Reward redemption workflow | Working | Request -> Pending -> Approve/Deny |
| Weekly summary analytics | Working | Stats cards, top categories, per-child breakdown |
| Point history with filters | Working | Filter by child and category |
| Family code sharing | Working | Native share API + clipboard fallback |
| Family profile editing | Working | Update family display name |
| Responsive design | Working | Mobile-first TailwindCSS |
| PWA manifest | Partial | manifest.json exists, service worker missing, icons may be missing |
| Animated UI | Working | Framer Motion transitions on cards, progress bars, modals |

### Not Implemented
| Feature | Status |
|---|---|
| Push notifications | Not built |
| Confetti celebrations | Library installed, not wired |
| Shareable achievement images | Library installed, not wired |
| Milestone badges | Not built |
| Parent streak tracking | Not built |
| Age-appropriate differentiation | Not built |
| Onboarding guidance | Not built |
| Family collaborative goals | Not built |
| Delete child | Not built |
| Delete reward | Not built |
| Data export | Not built |
| Dark mode | Configured in Tailwind, not active |

---

## 9. Authentication Model

The current authentication model is **family-code-based with localStorage persistence**:

1. Parent creates a family → server generates a unique 6-char code → code stored in `localStorage` as `positive_percy_family_code`
2. On subsequent visits, the app reads the code from localStorage and calls `GET /api/auth/me?family_code=CODE`
3. Server returns (or auto-creates) a user record for that family
4. All entity API calls include `family_code` as a query parameter for data isolation
5. Logout clears the localStorage key

**Security considerations:**
- No passwords, sessions, or tokens -- the family code IS the credential
- Anyone who knows the code can access the family's data
- No rate limiting on code guessing
- No HTTPS enforcement at the application level (relies on Railway's reverse proxy)

---

## 10. Deployment Details

### Railway Configuration (`railway.json`)
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Environment Variables Required
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (provided by Railway) |
| `PORT` | Server port (defaults to 3000, Railway assigns dynamically) |
| `NODE_ENV` | Set to `production` for SSL database connections |

### Build Pipeline
```
1. Railway detects push to main branch
2. Nixpacks runs: npm install && npm run build
3. Vite compiles React app → dist/ directory
4. Railway starts: node server/index.js
5. Express serves API routes and static dist/ files
6. initDb() creates/migrates database tables on startup
```

### Scaling Characteristics
- **Single instance**: No horizontal scaling configured
- **Stateless server**: No in-memory state (all data in PostgreSQL)
- **Database bottleneck**: Images stored as base64 TEXT in database (no CDN/S3)
- **No caching layer**: Every request hits the database
- **No connection pooling configuration**: Uses default pg Pool settings

---

## 11. Known Technical Debt

| Area | Issue | Severity |
|---|---|---|
| Security | SQL injection via unvalidated column names in generic CRUD | Critical |
| Security | No real authentication -- family code alone is the credential | Critical |
| Data integrity | Client-side point arithmetic creates race conditions | High |
| Data integrity | Weekly reset is a side effect inside a read query | High |
| Data integrity | Points can go negative (missing floor guards) | High |
| Performance | Summary page loads 200 raw events and filters client-side | Medium |
| Performance | History capped at 100 events with no pagination | Medium |
| Performance | Images stored as base64 in database (no CDN) | Medium |
| Performance | 5-second polling for redemptions (no WebSocket) | Low |
| UX | No loading or error states on most queries | Medium |
| UX | Logo loaded from external Supabase URL | Medium |
| Dependencies | 10+ unused npm packages adding to bundle size | Low |
| Schema | No foreign key constraints between tables | Low |
| Schema | Denormalized child_name doesn't cascade on rename | Low |

---

## 12. Point System Mechanics

### Categories
```
Homework, Chores, Kindness, Good Manners,
Bedtime Routine, Screen Time, Misbehavior, Other
```

### Preset point amounts
```
5, 10, 15, 20, 25 (quick-select buttons)
Custom amounts also supported via number input
```

### Weekly cycle
- **Reset**: Every Monday, `weekly_points` set to 0 for all children
- **Tracking**: Points accumulate throughout the week against `weekly_target`
- **Progress**: Visual progress bar on both parent and child views
- **Reward window**: Children can only request rewards on Saturday/Sunday

### Reward redemption
- Child submits request → status = "Pending"
- Parent sees pending requests on dashboard (5s poll)
- Approve: deducts `reward_cost` from child's `total_points` and `weekly_points`
- Deny: no point change, request marked "Denied"
