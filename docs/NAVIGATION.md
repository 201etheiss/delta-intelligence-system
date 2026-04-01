# Delta Intelligence — Navigation Map

All pages are under the `(dashboard)` layout, which provides the authenticated sidebar + header. Login is the only unauthenticated page.

---

## Main Group

### / (Dashboard / Command Center)

Role-based landing page with auto-refreshing KPI widgets. Shows different widgets per role:
- **Admin:** AR aging, revenue trend, top customers, pipeline, fleet map, system health, usage stats
- **Accounting:** AR aging, revenue trend, top customers, recent invoices, AP summary
- **Sales:** Pipeline, recent opportunities, lead count, account activity
- **Operations:** Fleet map, vehicle status, equipment summary, tank assignments
- **Read-Only:** AR aging, revenue trend, pipeline, fleet map

### /chat (AI Chat)

Full AI chat interface with:
- Natural language queries against all connected data sources
- Streaming responses via SSE
- Multi-model routing (Auto/Haiku/Sonnet/Opus/GPT-4o/Gemini)
- Admin model selector dropdown
- Tool use for gateway queries and workbook generation
- Document upload context (drag-and-drop)
- Conversation persistence (localStorage)
- Workspace context override
- Cmd+K global shortcut

### /workspaces (Workspace Marketplace)

Pre-built and custom AI workspaces. Each workspace configures:
- System prompt, data sources, preferred model
- Sample prompts, tags, category
- Visibility (private/team/public)
- 5 pre-built workspaces + custom creation

Click a workspace to enter chat with that workspace's context.

---

## Intelligence Group

### /reports (AI Report Builder)

AI-powered report generation with:
- Natural language report requests
- 9 report types (analysis, operator brief, decision memo, status report, diagnostic, SOP, metric spec, comparison, auto)
- Iterative refinement ("add YoY change column")
- Live preview in-browser
- Export to 9 formats (CSV, XLSX, DOCX, PDF, PPTX, MD, TXT, JSON, HTML)
- ZIP bundle for multiple reports

### /reports/templates (Template Library)

Saved report configurations:
- Parameterized templates ("Monthly AR Report" with month/year params)
- Template library filtered by role
- Scheduled execution (daily/weekly/monthly cron)
- Auto-generate and email to recipients

### /search (Cross-Chat Search)

Full-text search across all saved conversations. Accessed via:
- Direct navigation
- Header search bar
- Cmd+K shortcut (navigates to /chat, but Enter in header bar goes to /search)

### /history (Conversation History)

Browse and resume previous conversations. Shows:
- Conversation list with titles, timestamps, message counts
- Click to resume any conversation
- Delete conversations

---

## Data Group

### /documents (Document Upload)

Upload documents for AI analysis:
- Drag-and-drop upload zone
- Supported: PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, JSON, images (PNG/JPG/GIF/WEBP)
- 10MB max per file
- Server-side extraction (pdf-parse, mammoth, xlsx)
- Images sent to vision model for OCR
- Extracted content added to conversation context
- Session-scoped storage with auto-cleanup

### /sources (Data Source Status + Registry)

Data source connectivity dashboard:
- Status of all 8 gateway services (connected/degraded/error)
- Response time per service
- Endpoint count per service
- Schema registry status
- Trigger schema crawl (admin only)

---

## System Group (Admin Only)

### /admin/users (User Management)

Manage platform users:
- List all users with role, status, last active, query count
- Add user by email with role assignment
- Change roles, activate/deactivate users
- Merge hardcoded users (from roles.ts) with stored users

### /admin/permissions (Permission Mapping)

Role-to-service permission management:
- Visual grid: roles x services
- Toggle services on/off per role
- Create custom roles (e.g., "Controller" = accounting + some admin endpoints)
- Override built-in role permissions
- Changes take effect immediately

### /admin/usage (Usage Tracking)

Query and cost analytics:
- Queries per day/week/month by user
- Token consumption by model
- Cost breakdown per user, per model, per service
- Most-used endpoints
- Export usage reports (CSV/JSON)

### /admin/health (System Health)

Infrastructure monitoring:
- Gateway connectivity status per service
- Response time monitoring
- Error rate tracking
- Error log viewer
- Service-by-service ping test

---

## Unauthenticated

### /login (Microsoft 365 SSO)

Login page with Microsoft 365 SSO button. After authentication, redirects to role-appropriate dashboard.

---

## Phase 4: Dashboard Builder

### /dashboards (Dashboard List)

Browse and manage custom dashboards:
- List of saved dashboards with name, widget count, last modified
- "Create Dashboard" button
- Default dashboards marked with badge
- Visibility indicators (private/team/public)

### /dashboards/[id] (Dashboard Viewer/Editor)

View and edit a specific custom dashboard:
- Grid-based widget layout
- Edit mode toggle (pencil icon)
- Add/remove/reorder widgets
- Widget types: KPI, table, bar-chart, list, text
- Each widget connected to a gateway endpoint
- Configurable refresh interval
