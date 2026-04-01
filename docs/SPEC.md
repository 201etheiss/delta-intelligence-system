# Delta Intelligence — Full Platform Specification

## Overview

Delta Intelligence is an enterprise AI platform that gives every Delta360 employee natural-language access to all company data sources, document processing, automated workflows, and collaborative analytics — with zero technical skill required.

**Brand:** Delta Intelligence
**URL:** intelligence.delta360.energy (production) / localhost:3000 (dev)
**Stack:** Next.js 14 / React 19 / TypeScript / Tailwind / Vercel
**Auth:** Microsoft 365 SSO via MSAL.js
**AI:** Multi-model router (Claude Haiku/Sonnet, GPT-4o, Gemini Flash)
**Data:** Delta360 Unified Data Gateway (7 services, 101 endpoints)
**Branding:** Delta360 orange #FE5000, black #000000, clean institutional

---

## Data Sources (via Unified Gateway)

| Service | Endpoints | Data |
|---------|-----------|------|
| Ascend SQL | 39 | Production ERP — customers, AR, AP, GL, revenue, invoices, equipment, taxes, sites |
| Salesforce | 14 | CRM — accounts, contacts, opportunities, leads, cases, products |
| Power BI | 4 | 5 workspaces, datasets, reports, DAX queries |
| Samsara | 11 | 157 vehicles, 237 drivers, GPS, fuel, HOS, diagnostics |
| Fleet Panda | 4 | Dispatch, assets, trucks, tanks |
| Microsoft Graph | 12 | SharePoint, OneDrive, email search, file management |
| Vroozi | 17 | 21,446 POs, invoices, suppliers, approvals, catalogs |

Gateway base URL: configurable (Cloudflare tunnel or direct)
Auth: role-mapped API keys passed server-side (never exposed to client)

---

## Roles & Permissions

| Role | Gateway Key | Services | Capabilities |
|------|------------|----------|-------------|
| Admin | df360-admin-* | All 7 | Full access, admin portal, automation builder, user management |
| Accounting | df360-acctg-* | Ascend + Power BI | GL, AR, AP, invoices, financial reports |
| Sales | df360-sales-* | Salesforce + Power BI | CRM, pipeline, accounts, reports |
| Operations | df360-ops-* | Ascend + Samsara + Fleet Panda | Fleet tracking, equipment, ERP read |
| Read-Only | df360-readonly-* | All 7 | Read access across all sources |

Role assignment: email-to-role mapping in config, manageable via admin portal.

---

## Phase 1 — Foundation (POC)

### 1.1 Authentication
- Microsoft 365 SSO via MSAL.js (@azure/msal-browser)
- Tenant: 38425e73-18b7-4732-a2b9-052a686205b7 (Delta360)
- After login, lookup user email in role config → assign gateway API key
- Session stored in httpOnly cookie (JWT)
- Redirect to role-appropriate dashboard after login

### 1.2 Chat Interface
- Full-width chat with message history
- User types natural language query
- System prompt includes: user's role, available endpoints for that role, endpoint descriptions
- AI decides which endpoint(s) to call, executes server-side via gateway proxy
- Response formatted with markdown tables, inline charts (recharts), code blocks
- Conversation persisted in localStorage (Phase 2: database)
- New conversation / conversation history sidebar

### 1.3 Multi-Model Router
- Query classifier analyzes each message:
  - Simple lookup (list, show, get) → Haiku ($0.25/M)
  - Analysis (compare, trend, why, explain) → Sonnet ($3/M)
  - Complex multi-step reasoning → GPT-4o or Sonnet ($2.50-3/M)
  - Large data processing (>50K tokens context) → Gemini Flash ($0.075/M)
- Model selection logged with each query
- Cost tracked per query
- API keys: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_AI_API_KEY

### 1.4 Power User Model Selector
- Dropdown in chat header: Auto | Haiku | Sonnet | GPT-4o | Gemini Flash
- Only visible to Admin role
- "Auto" = router decides (default for all users)
- Selection persists per session

### 1.5 Document Upload
- Drag-and-drop zone in chat or dedicated upload area
- Supported: PDF, DOCX, XLSX, CSV, TXT, images (PNG/JPG)
- Files processed server-side:
  - PDF/DOCX → text extraction (pdf-parse, mammoth)
  - XLSX/CSV → parsed to JSON tables
  - Images → sent to vision model for OCR/analysis
- Extracted content added to conversation context
- User can ask questions about uploaded documents
- Files stored temporarily (session-scoped, auto-cleanup)
- Phase 6: persistent storage in SharePoint via Graph API

### 1.6 Role-Based Dashboards
- Landing page after login shows role-appropriate widgets
- Auto-refreshing data from gateway endpoints

**Accounting Dashboard:**
- AR aging summary (current / 30 / 60 / 90+ buckets)
- Monthly revenue trend chart (last 12 months)
- Top 10 customers by revenue
- Recent invoices table
- AP summary by vendor

**Sales Dashboard:**
- Pipeline by stage (funnel chart)
- Recent opportunities
- Lead count and conversion
- Account activity feed

**Operations Dashboard:**
- Fleet map (Samsara GPS → Mapbox/Leaflet)
- Vehicle status table (name, location, fuel, engine hours)
- Equipment inventory summary
- Tank assignments

**Admin Dashboard:**
- All of the above
- System health (gateway status, Samsara auth, service connectivity)
- Usage stats (queries today, cost, active users)

### 1.7 UI Design
- Delta360 branding: orange #FE5000, black #000000
- Dark sidebar navigation, white content area
- Zinc neutral scale for dark elements (#09090B, #18181B, #27272A)
- Clean sans-serif font (Inter)
- Monospace for data tables and numbers
- Responsive — works on tablet (mobile optimization in Phase 9)
- Components: shadcn/ui + custom

### 1.8 Project Structure
```
delta360/intelligence/
  src/
    app/
      page.tsx                    # Landing / login
      (auth)/
        login/page.tsx            # MS SSO login
        callback/page.tsx         # OAuth callback
      (dashboard)/
        layout.tsx                # Authenticated layout with sidebar
        page.tsx                  # Role dashboard
        chat/page.tsx             # Chat interface
        documents/page.tsx        # Document upload & management
      api/
        auth/[...nextauth]/       # Auth routes
        chat/route.ts             # AI chat endpoint
        gateway/[...path]/route.ts # Gateway proxy
        upload/route.ts           # Document upload processing
    lib/
      auth.ts                     # MSAL config, role mapping
      gateway.ts                  # Gateway client with role-based key selection
      router.ts                   # Multi-model query router
      models/                     # Model provider configs (Claude, GPT, Gemini)
      documents.ts                # Document parsing (PDF, DOCX, XLSX)
    components/
      chat/                       # Chat UI components
      dashboard/                  # Dashboard widgets
      ui/                         # shadcn/ui components
    config/
      roles.ts                    # Email-to-role mapping
      endpoints.ts                # Endpoint catalog with descriptions
```

---

## Phase 2 — Admin Portal

### 2.1 User Management
- List all users with role, last active, query count
- Add user by email → assign role
- Change roles, deactivate users
- Bulk invite via CSV

### 2.2 Permission Mapping
- Visual grid: roles × endpoints
- Toggle endpoints on/off per role
- Create custom roles (e.g., "Controller" = accounting + some admin)
- Permission changes take effect immediately

### 2.3 Usage Tracking
- Queries per day/week/month by user
- Token consumption by model
- Cost breakdown: per user, per model, per service
- Most-used endpoints
- Export usage reports

### 2.4 System Health
- Gateway connectivity status per service
- Samsara OAuth status
- Response time monitoring
- Error rate tracking
- One-click Samsara re-auth

---

## Phase 3 — Report Generator

### 3.1 AI Report Builder
- User describes report in natural language
- AI pulls data from multiple endpoints
- Iterative refinement: "add a column for YoY change" → AI updates
- Preview in-browser before export

### 3.2 Export Formats
- PDF (formatted with Delta360 branding)
- DOCX (editable Word document)
- XLSX (data tables with formulas)
- CSV (raw data)

### 3.3 Report Templates
- Save report configs for reuse
- Parameterized: "Monthly AR Report" → user picks month
- Template library per role

### 3.4 Scheduled Reports
- Cron-based scheduling (daily, weekly, monthly)
- Auto-generate and email to specified recipients
- Attach as PDF/XLSX to email via Microsoft Graph

---

## Phase 4 — Dashboard Builder

### 4.1 Widget Library
- KPI card (single metric with trend arrow)
- Table (sortable, filterable)
- Bar chart, line chart, area chart, pie chart
- Map (GPS data on Mapbox)
- List (recent items)

### 4.2 Drag-and-Drop Builder
- Grid layout system
- Resize, reorder widgets
- Each widget connected to a gateway endpoint
- Configure refresh interval per widget

### 4.3 Dashboard Management
- Save custom dashboards
- Share dashboards with other users/roles
- Set as default landing page
- Clone and modify existing dashboards

---

## Phase 5 — Automation Engine

### 5.1 Triggers
- Schedule: cron expressions (daily 8am, weekly Monday, monthly 1st)
- Data threshold: "when [metric] [operator] [value]"
- New data: "when new invoice created" (poll-based detection)
- Manual: one-click run

### 5.2 Actions
- Query gateway endpoint
- Generate report (Phase 3)
- Send email (via Microsoft Graph)
- Move/copy SharePoint files
- Post to Teams channel
- Create Salesforce record
- Custom webhook (POST to any URL)

### 5.3 Workflow Builder
- Visual flow: trigger → condition → action → action
- Branching: if/else based on data values
- Error handling: retry, fallback, alert on failure
- Execution log with full audit trail

### 5.4 Pre-Built Automations
- Weekly AR aging report → email to accounting
- Daily fleet status summary → email to ops manager
- Invoice sync: find invoices in email → organize in SharePoint (DTN pattern)
- New Salesforce opportunity → notify sales team
- Monthly P&L by profit center → email to leadership

---

## Phase 6 — Knowledge Base & Collaboration

### 6.1 Document Management
- Persistent document storage (SharePoint-backed via Graph API)
- Folder structure by department
- Version history
- Full-text search across uploaded documents
- AI indexes documents for contextual answers

### 6.2 Domain Glossary
- Company-specific terms and definitions
- AI references glossary when answering queries
- Admin-editable: add/update terms
- Examples: PC = profit center, CustType meanings, carrier codes, site abbreviations

### 6.3 Onboarding Context
- "How does our billing process work?" → answers from SOPs + live data
- Role-specific onboarding guides
- Interactive walkthroughs for new users

### 6.4 Collaboration
- Share query results via link (view-only, role-gated)
- Comment threads on shared results
- @mention users to surface insights
- Team conversation spaces by department

---

## Phase 7 — Alerts & Data Layer

### 7.1 Alerts & Notifications
- Threshold-based: AR > $500K, fuel < 10%, revenue drop > 15%
- Anomaly detection: AI flags unusual patterns
- Delivery: in-app notification, email, Teams message
- Alert rules configurable per user/role
- Snooze and acknowledge

### 7.2 Daily Digest
- Morning email per role with key metrics
- Configurable: which metrics, what time, what format
- AI-generated summary: "3 things to know today"

### 7.3 Data Caching
- Redis/Postgres cache for frequently-accessed data
- TTL per endpoint (fast-moving: 5min, slow: 1hr)
- Cache invalidation on manual refresh
- Reduces gateway load and improves response time

### 7.4 Data Upload
- CSV/Excel upload for ad-hoc analysis
- Cross-reference with gateway data ("compare budget spreadsheet to actual GL")
- Temporary storage with auto-cleanup

### 7.5 Cross-Source Joins
- AI-driven entity matching across sources
- "Match Ascend customers to Salesforce accounts"
- Fuzzy name matching with confidence scores

---

## Phase 8 — Audit & Compliance

### 8.1 Query Audit Log
- Every query logged: timestamp, user, role, query text, endpoints called, model used, tokens, cost
- Searchable and exportable
- Retention policy: configurable (default 90 days)

### 8.2 Data Access Controls
- Bulk download prevention (max rows per export)
- Sensitive field masking (SSN, bank accounts if present)
- IP allowlisting (optional)

### 8.3 Session Recording
- Full conversation playback for compliance review
- Admin can review any user's sessions
- Export for legal/audit purposes

---

## Phase 9 — Mobile & Platform API

### 9.1 Mobile Experience
- Responsive PWA (Progressive Web App)
- Push notifications for alerts
- Quick-glance KPI cards
- Voice input for field queries
- Install to home screen

### 9.2 Platform API
- REST API for external consumers
- API key management
- Rate limiting and usage metering
- Webhook support for push notifications
- OpenAPI documentation

---

## Phase 10 — AI Memory & Optimization

### 10.1 User Preferences
- Per-user defaults (preferred profit centers, date ranges, metrics)
- "Always show Midland data first" → persisted preference
- Conversation style preferences

### 10.2 Query Learning
- Track which queries map to which endpoints
- Build query → endpoint mapping cache
- Reduce AI calls for common patterns (direct endpoint mapping)

### 10.3 Feedback Loop
- Thumbs up/down on responses
- Feedback trains routing algorithm weights
- Monthly model performance report
- A/B testing: route same query to two models, compare quality

### 10.4 Prompt Optimization
- Per-role system prompts refined based on usage patterns
- Domain-specific few-shot examples added from successful queries
- Continuous prompt refinement cycle

---

## Technical Architecture

```
User Browser
    │
    ├── MS SSO (MSAL.js) ──→ Azure AD (Delta360 tenant)
    │
    ├── Next.js App (Vercel) ──→ API Routes
    │       │
    │       ├── /api/chat ──→ Model Router ──→ Claude / GPT / Gemini APIs
    │       │                      │
    │       │                      └── Tool calls ──→ Gateway Proxy
    │       │                                              │
    │       ├── /api/gateway/* ──→ Gateway Proxy ──────────┘
    │       │                           │
    │       │                    Unified Data Gateway (Windows server)
    │       │                    ├── Ascend SQL (ERP)
    │       │                    ├── Salesforce (CRM)
    │       │                    ├── Power BI
    │       │                    ├── Samsara (Fleet)
    │       │                    ├── Fleet Panda
    │       │                    ├── Microsoft Graph
    │       │                    └── Vroozi (Procurement)
    │       │
    │       ├── /api/upload ──→ Document Parser ──→ Session Context
    │       │
    │       └── /api/auth ──→ MSAL ──→ Role Config ──→ JWT Session
    │
    └── React UI
            ├── Chat Interface
            ├── Role Dashboards
            ├── Document Upload
            ├── Admin Portal (Phase 2+)
            └── Report/Dashboard Builder (Phase 3-4+)
```

---

## Environment Variables

```env
# Auth
AZURE_AD_CLIENT_ID=           # MS SSO app registration
AZURE_AD_CLIENT_SECRET=       # MS SSO secret
AZURE_AD_TENANT_ID=38425e73-18b7-4732-a2b9-052a686205b7
NEXTAUTH_SECRET=              # Session encryption
NEXTAUTH_URL=                 # App URL

# AI Models
ANTHROPIC_API_KEY=            # Claude Haiku + Sonnet
OPENAI_API_KEY=               # GPT-4o
GOOGLE_AI_API_KEY=            # Gemini Flash

# Gateway
GATEWAY_BASE_URL=https://arm-springfield-compliant-nine.trycloudflare.com
GATEWAY_ADMIN_KEY=df360-admin-c67f1da4ddb3bb32aa4fde80
GATEWAY_ACCTG_KEY=df360-acctg-60d21e5f8609acfa8a6d8954
GATEWAY_SALES_KEY=df360-sales-70a1784fb7b6d059614678ab
GATEWAY_OPS_KEY=df360-ops-cd2da513aa9b2244db43fd6f
GATEWAY_READONLY_KEY=df360-readonly-c93641c8bb9a32b3542f121f
```

---

## Success Criteria

Phase 1 POC is complete when:
1. User can sign in with @delta360.energy Microsoft account
2. Chat returns real data from the gateway based on natural language
3. Model router selects appropriate model per query
4. Admin can manually select model
5. User can upload a PDF/XLSX and ask questions about it
6. Role-appropriate dashboard loads with live data widgets
7. Deployed to Vercel and accessible via custom domain
