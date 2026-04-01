# Delta Intelligence — API Reference

All endpoints are Next.js API routes under `src/app/api/`. Authentication is via NextAuth session (httpOnly JWT cookie). In development mode, auth checks are bypassed.

---

## Chat

### POST /api/chat

Synchronous AI chat with tool use (gateway queries, workbook generation).

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Show me AR aging" }
  ],
  "model": "auto",
  "workspacePrompt": "Optional system prompt override from workspace",
  "preferredModel": "sonnet",
  "dataSources": ["ascend", "salesforce"],
  "documents": [
    { "name": "budget.xlsx", "content": "extracted text content" }
  ]
}
```

**Response:**
```json
{
  "content": "## AR Aging Summary\n\n| Bucket | Amount |\n...",
  "model": "claude-haiku-4-5-20251001",
  "tokensUsed": 3420,
  "inputTokens": 2100,
  "outputTokens": 1320
}
```

**Orchestrated response** (complex queries, score >= 30):
```json
{
  "content": "...",
  "model": "claude-sonnet-4-6",
  "tokensUsed": 5800,
  "inputTokens": 4200,
  "outputTokens": 1600,
  "plannerTokens": 800,
  "synthesizerTokens": 5000,
  "dataSteps": 3,
  "orchestrated": true
}
```

### POST /api/chat/stream

Streaming AI chat via Server-Sent Events (SSE).

**Request:** Same as `/api/chat`.

**SSE Event Types:**

| Event | Data | Description |
|-------|------|-------------|
| `routing` | `{ model, complexity, score, reasons }` | Model selection decision |
| `orchestrating` | `{ status, step?, total? }` | Orchestrator phase updates |
| `token` | `{ text }` | Incremental text token |
| `tool_use` | `{ name, input }` | Tool call initiated |
| `tool_result` | `{ name, result }` | Tool call completed |
| `done` | `{ model, inputTokens, outputTokens, tokensUsed }` | Stream complete |
| `error` | `{ message }` | Error occurred |

---

## Dashboard

### GET /api/dashboard

Returns KPI data for the landing page. Cached in-memory for 5 minutes.

**Response:**
```json
{
  "success": true,
  "data": {
    "kpis": {
      "customerCount": 1180,
      "pipelineTotal": 91000000,
      "vehicleCount": 160,
      "arTotal": 782000000
    },
    "recentInvoices": [
      { "id": "INV-001", "date": "2026-03-15", "amount": 45000, "customer": "Acme Corp" }
    ],
    "rackPrice": { "product": "Diesel #2", "price": 2.45, "date": "2026-03-28" },
    "fetchedAt": "2026-03-28T12:00:00Z"
  }
}
```

---

## Reports

### POST /api/reports/generate

AI-powered report generation with iterative refinement.

**Request:**
```json
{
  "prompt": "Monthly AR aging report for March 2026",
  "previousReport": "Optional previous report content for refinement",
  "refinement": "Add a column for YoY change",
  "reportType": "analysis",
  "documents": [{ "name": "context.pdf", "content": "..." }]
}
```

**Report Types:** `auto`, `analysis`, `operator_brief`, `decision_memo`, `status_report`, `diagnostic`, `sop`, `metric_spec`, `comparison`

**Response:**
```json
{
  "success": true,
  "report": {
    "content": "## ANALYSIS: AR Aging — March 2026\n...",
    "model": "claude-sonnet-4-6",
    "tokensUsed": 8500,
    "inputTokens": 6200,
    "outputTokens": 2300
  }
}
```

### POST /api/reports/export

Export reports to downloadable files.

**Request:**
```json
{
  "reports": [
    { "title": "AR Aging March 2026", "content": "## markdown content..." }
  ],
  "format": "xlsx",
  "bundle": false
}
```

**Formats:** `csv`, `xlsx`, `docx`, `pdf`, `pptx`, `md`, `txt`, `json`, `html`

**Response:** Binary file download with appropriate Content-Type and Content-Disposition headers. If `bundle: true` or multiple reports, returns a ZIP archive.

### GET /api/reports/templates

List saved report templates.

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "id": "tmpl-001",
      "name": "Monthly AR Report",
      "prompt": "Generate AR aging report for {month} {year}",
      "reportType": "analysis",
      "parameters": ["month", "year"],
      "createdBy": "etheiss@delta360.energy",
      "createdAt": "2026-03-01T00:00:00Z"
    }
  ]
}
```

### POST /api/reports/templates

Create a new report template.

**Request:**
```json
{
  "name": "Monthly AR Report",
  "prompt": "Generate AR aging report for {month} {year}",
  "reportType": "analysis",
  "parameters": ["month", "year"]
}
```

### DELETE /api/reports/templates

Delete a report template by ID.

**Request:** `?id=tmpl-001`

### GET /api/reports/schedules

List scheduled reports.

### POST /api/reports/schedules

Create a scheduled report.

**Request:**
```json
{
  "templateId": "tmpl-001",
  "cron": "0 8 1 * *",
  "recipients": ["user@delta360.energy"],
  "format": "xlsx",
  "parameters": { "month": "auto", "year": "auto" }
}
```

### DELETE /api/reports/schedules

Delete a schedule by ID.

---

## Workbooks

### POST /api/workbooks

Generate Excel workbook from pre-built template with live data.

**Request:**
```json
{
  "template": "bol-summary",
  "params": { "year": "2026", "period": "3" }
}
```

**Templates:** `bol-summary`, `revenue-analysis`, and others defined in the workbook generator.

**Response:**
```json
{
  "success": true,
  "fileId": "wb-abc123",
  "fileName": "BOL_Summary_2026-03-01_to_2026-04-01.xlsx",
  "downloadUrl": "/api/workbooks/download?id=wb-abc123",
  "sheets": [
    { "name": "By Supplier-SupplyPt", "rows": 45, "columns": ["SupplierCode", "..."] }
  ]
}
```

### GET /api/workbooks/download

Download a generated workbook file.

**Query:** `?id=wb-abc123`

**Response:** Binary .xlsx file download.

---

## Upload

### POST /api/upload

Upload documents for AI context. Supports multipart/form-data.

**Supported Types:** PDF, DOCX, PPTX, XLSX, XLS, CSV, TXT, MD, JSON, PNG, JPG, GIF, WEBP

**Max Size:** 10MB per file

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "name": "report.pdf",
      "type": "pdf",
      "size": 245000,
      "content": "Extracted text content from the PDF...",
      "pages": 5
    }
  ]
}
```

---

## Workspaces

### GET /api/workspaces

List all workspaces (pre-built + custom).

### POST /api/workspaces

Create a custom workspace.

**Request:**
```json
{
  "name": "Pricing Analyst",
  "description": "Rack prices, customer pricing, margin analysis",
  "color": "#FF5C00",
  "icon": "DollarSign",
  "dataSources": ["ascend"],
  "systemPrompt": "You are a pricing analyst...",
  "visibility": "team",
  "category": "finance",
  "tags": ["pricing", "margins"],
  "samplePrompts": ["What are today's rack prices?"]
}
```

### PATCH /api/workspaces

Update a workspace. Body: partial workspace with `id`.

### DELETE /api/workspaces

Delete a workspace. Query: `?id=ws-001`

---

## Dashboards

### GET /api/dashboards

List all custom dashboards.

### POST /api/dashboards

Create a new dashboard.

**Request:**
```json
{
  "name": "Operations Overview",
  "description": "Fleet and delivery metrics",
  "widgets": [...],
  "visibility": "team"
}
```

### PATCH /api/dashboards

Update dashboard layout/metadata. Body: partial dashboard with `id`.

### DELETE /api/dashboards

Delete a dashboard. Query: `?id=dash-001`

---

## Registry

### GET /api/registry/crawl

Returns current schema registry status.

### POST /api/registry/crawl

Triggers a full crawl of all data sources (admin only). Indexes Ascend ERP tables, products, locations, and builds the schema registry.

---

## Admin

### GET /api/admin/users

List all users with roles, status, last active.

### POST /api/admin/users

Add a user. Body: `{ email, role }`

### PATCH /api/admin/users

Update user role or status. Body: `{ email, role?, status? }`

### DELETE /api/admin/users

Remove a user. Query: `?email=user@delta360.energy`

### GET /api/admin/permissions

List all roles with their service permissions (built-in + custom).

### PATCH /api/admin/permissions

Override services for a role. Body: `{ role, services: [...] }`

### POST /api/admin/permissions

Create a custom role. Body: `{ role, name, services: [...] }`

### GET /api/admin/usage

Usage statistics: queries per day/week/month, token consumption by model, cost breakdown per user/model/service.

### GET /api/admin/usage/export

Export usage data as CSV or JSON. Query: `?format=csv`

### GET /api/admin/health

System health check. Pings all 8 gateway services with timeout, returns status, response time, and error details per service.

**Response:**
```json
{
  "success": true,
  "services": [
    { "name": "Ascend (ERP)", "status": "connected", "responseTime": 245, "lastChecked": "..." },
    { "name": "Samsara (Fleet)", "status": "degraded", "responseTime": 3200, "lastChecked": "..." }
  ],
  "errors": { "total": 5, "last24h": 2 }
}
```

---

## Navigation

### GET /api/navigation

Returns the full navigation structure as JSON. Useful for external tools and integrations to understand the platform's page structure.

---

## Auth

### GET/POST /api/auth/[...nextauth]

NextAuth.js catch-all route. Handles Microsoft 365 SSO login, callback, signout, and session endpoints.

---

## Gateway Proxy

### GET/POST /api/gateway/[...path]

Proxies requests to the Unified Data Gateway. Injects the appropriate role-based API key server-side. Never exposes gateway keys to the client.

**Example:** `GET /api/gateway/ascend/ar/aging` proxies to `GET {GATEWAY_BASE_URL}/ascend/ar/aging` with the user's role-appropriate API key.
