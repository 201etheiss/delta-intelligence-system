# Phase 5: Nova Intelligence + ERP Modules + Cross-App Integration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen Nova AI with module-aware context injection, build 5 ERP replacement modules as DataOS spokes, and wire bidirectional integration between DI ↔ Portal ↔ Equipment Tracker — all DB-agnostic (localStorage + gateway, no Supabase/Neo4j dependency).

**Architecture:** Nova contexts already exist in `src/lib/nova-contexts/` and the chat API already calls `buildNovaPromptSection(moduleId)`. This phase wires the ChatPanel to pass the active module, adds 3 missing Nova contexts (portal, equipment-tracker, erp), builds 5 ERP module pages backed by gateway SQL, and creates a cross-app integration layer that maps routes/data/events bidirectionally between all Delta360 apps.

**Tech Stack:** Next.js 14 / React 18 / TypeScript / Tailwind CSS / Lucide icons / Gateway SQL at :3847

**Constraint:** No database dependencies. All state uses localStorage or gateway API calls. Structure code so Supabase/Neo4j can be plugged in later by swapping the data layer.

---

## File Structure

### New Files (Create)

```
src/lib/nova-contexts/
├── portal.ts                    # Nova context: Portal domain (orders, pricing, leasing, tracking)
├── equipment-tracker.ts         # Nova context: Equipment domain (assets, tanks, lifecycle, dispatch)
└── erp.ts                       # Nova context: ERP domain (AP, AR, inventory, contracts, purchasing)

src/lib/integration/
├── app-registry.ts              # Registry of all Delta360 apps (URL, health, routes, capabilities)
├── route-map.ts                 # Bidirectional route mapping: DI module → external app page & back
├── cross-app-nav.ts             # Navigation helpers: deep-link generation, app switching
└── data-bridge.ts               # Gateway-backed data bridge: fetch cross-app data without direct DB

src/components/integration/
├── AppSwitcher.tsx              # Dropdown/tile to jump between DI, Portal, ET, Signal Map
├── CrossAppBreadcrumb.tsx       # Shows "DI > Finance > AP" or "Portal > Orders > #1234"
└── SpokeStatusBadge.tsx         # Inline badge showing spoke health (green/yellow/red dot)

src/app/(dashboard)/erp/
├── page.tsx                     # ERP hub — links to AP, AR, inventory, contracts, purchasing
├── ap/page.tsx                  # Accounts Payable module (gateway: vPurchaseJournal)
├── ar/page.tsx                  # Accounts Receivable module (gateway: AR aging + invoices)
├── inventory/page.tsx           # Inventory module (gateway: Ascend inventory tables)
├── contracts/page.tsx           # Contracts module (gateway: Salesforce contracts)
└── purchasing/page.tsx          # Purchasing module (gateway: Vroozi POs + Ascend POs)

src/app/api/integration/
├── apps/route.ts                # GET: list all registered apps + health status
├── navigate/route.ts            # POST: resolve cross-app deep link
└── bridge/[app]/route.ts        # GET: proxy data request to another app's API
```

### Modified Files

```
src/lib/nova-contexts/index.ts              # Add portal, equipment-tracker, erp contexts
src/components/shell/ChatPanel.tsx           # Already passes moduleContext — verify it reaches API
src/components/shell/NovaBar.tsx             # Add AppSwitcher to right side
src/components/shell/DataOSShell.tsx         # Wire AppSwitcher + CrossAppBreadcrumb
src/lib/shell/module-registry.ts            # Add ERP module group + integration routes
src/lib/events/event-types.ts               # Add ERP-specific events
src/lib/spoke-registry.ts                   # Update spoke URLs and health check paths
```

---

## Task 1: Portal Nova Context

**Files:**
- Create: `src/lib/nova-contexts/portal.ts`

- [ ] **Step 1: Create portal context**

```typescript
// Nova context for Portal domain
// Vocabulary: orders, cart, checkout, delivery tracking, pricing (rack + margin + excise + sales tax),
//   leasing, KYC, payment methods (ACH, card), purchase orders, recurring orders, auto-refill
// Key tables: DF_PBI_BillingChartQuery, ARInvoiceItem, vRackPrice, Customer, DeliverySchedule
// Query patterns: "What's the status of order D360-2026-1234?", "Show rack prices for ULSD",
//   "Which customers have overdue invoices?", "What's the delivery ETA for site 47?"
// Available actions: Create order, Track delivery, Request quote, View invoice, Pay invoice
// Gateway endpoints: /ascend/customers, /ascend/invoices, /ascend/ar/aging, /ascend/sites,
//   /ascend/tanks, /salesforce/query (Opportunity, Account)
```

Follow the `NovaContext` interface from `finance.ts`. Include `gatewayEndpoints` array.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 2: Equipment Tracker Nova Context

**Files:**
- Create: `src/lib/nova-contexts/equipment-tracker.ts`

IMPORTANT: The existing file has a NON-CONFORMING structure (uses `name`, `description`, `vocabulary` as object, `dataModel`, `capabilities`, `queryExamples`, `integrations`). This does NOT match the `NovaContext` interface. You MUST fully rewrite it to conform to the `NovaContext` interface from `finance.ts` (fields: `domain`, `vocabulary: readonly string[]`, `keyTables`, `queryPatterns`, `availableActions`, `gatewayEndpoints`). Preserve the rich content but restructure it.

- [ ] **Step 1: Rewrite equipment tracker context to match NovaContext interface**

```typescript
// Nova context for Equipment Tracker domain
// Vocabulary: asset tag (D360-TNK-001), tracking tier (Fleet/Mobile/Static), lifecycle stage
//   (prefab → shop repair → ready → in-transit → setup → in-service → idle → decommission),
//   containment type, tank types (horizontal, vertical, transcube), Samsara telemetry,
//   FleetPanda sync, geofence breach, dispatch assignment, fuel level monitoring
// Key tables: Equipment (7,613 assets), Device, Checkin, Alert, Transfer, Contract, FuelTransaction
// Query patterns: "Where is tank D360-TNK-042?", "Which assets are idle over 30 days?",
//   "Show maintenance schedule for fleet vehicles", "What's the fuel level on site 12 tanks?"
// Available actions: Check in equipment, Create transfer, Acknowledge alert, View asset history
// Gateway endpoints: /ascend/equipment, /ascend/tanks, /samsara/vehicles, /fleetpanda/assets
```

- [ ] **Step 3: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 3: ERP Nova Context

**Files:**
- Create: `src/lib/nova-contexts/erp.ts`

- [ ] **Step 1: Create ERP context**

```typescript
// Nova context for ERP replacement domain
// Vocabulary: AP aging, vendor spend, purchase journal, GL account categories (680 in vPurchaseJournal),
//   invoice matching (3-way: PO vs receipt vs invoice), payment run, Vroozi procurement,
//   catalog items (2,605), inventory valuation, contract lifecycle, purchase order workflow
// Key tables: vPurchaseJournal, APInvoice, Vendor, InventoryItem, PurchaseOrder, Contract
// Query patterns: "What's total AP aging over 90 days?", "Top 10 vendors by spend this quarter",
//   "Show open POs for site 14", "What contracts expire in the next 60 days?"
// Available actions: View AP aging, Query vendor spend, Check PO status, Review contracts
// Gateway endpoints: /ascend/query (vPurchaseJournal, APInvoice, etc.), /vroozi/suppliers,
//   /vroozi/catalogs, /salesforce/query (Contract, Opportunity)
```

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 4: Register New Contexts in Index

**Files:**
- Modify: `src/lib/nova-contexts/index.ts`

- [ ] **Step 1: Add imports and register in ALL_NOVA_CONTEXTS**

Add the 3 new contexts to the imports and `ALL_NOVA_CONTEXTS` object:
- `portal` key → `PORTAL_CONTEXT`
- `equipment-tracker` key → `EQUIPMENT_TRACKER_CONTEXT`
- `erp` key → `ERP_CONTEXT`

Also add re-exports.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 3: Verify context injection**

Read `src/app/api/chat/route.ts` line ~166 to confirm `buildNovaPromptSection(body.moduleContext)` is called. Then read `src/components/shell/ChatPanel.tsx` to confirm `currentModule` prop is passed to `ChatInterface` as `moduleContext`. If the prop name mapping is missing, fix it.

---

## Task 5: App Registry (Cross-App Integration Foundation)

**Files:**
- Create: `src/lib/integration/app-registry.ts`

- [ ] **Step 1: Create app registry**

```typescript
// Define all Delta360 apps with their:
// - id: unique slug
// - name: display name
// - url: base URL (localhost for dev, production URL later)
// - healthPath: path to health check endpoint
// - spokeId: matching spoke ID in spoke-registry.ts (or null for DI itself)
// - modules: array of { id, label, path } for available sections
// - capabilities: what data this app owns (orders, equipment, assessments, etc.)
//
// Apps to register:
// 1. delta-intelligence (self) — localhost:3004, 62 pages, hub
// 2. delta-portal — localhost:3000, 44 portal + 14 admin pages, customer-facing
// 3. equipment-tracker — equipment-tracker-tau.vercel.app (prod) / localhost:3001 (dev), 150+ API routes
// 4. signal-map — localhost:3000 (when running), OTED assessments
//
// Include getApp(id), getAllApps(), getAppHealth(id) functions
// Health check: fetch app.url + app.healthPath with 5s timeout, return 'healthy' | 'degraded' | 'down'
```

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 6: Bidirectional Route Map

**Files:**
- Create: `src/lib/integration/route-map.ts`

- [ ] **Step 1: Create route mapping system**

```typescript
// Bidirectional mapping between DI modules and external app pages.
// Structure: Array of RouteMapping objects:
//
// interface RouteMapping {
//   diModule: string;        // DI module group ID (from module-registry.ts)
//   diPath: string;          // DI page path
//   externalApp: string;     // app ID from app-registry
//   externalPath: string;    // path in external app
//   label: string;           // human-readable label
//   dataFlow: 'di-to-app' | 'app-to-di' | 'bidirectional';
// }
//
// Key mappings:
// DI /ap → Portal /admin/purchasing (AP invoices ↔ Portal purchase orders)
// DI /ar → Portal /admin/invoices (AR aging ↔ Portal customer invoices)
// DI /fleet → ET /dashboard (fleet overview ↔ equipment list)
// DI /equipment-hub → ET / (full equipment tracker)
// DI /signal-map-hub → Signal Map / (OTED assessments)
// DI /portal-hub → Portal /admin/dashboard (Portal admin)
// DI /sales → Portal /admin/crm (sales pipeline ↔ CRM accounts)
// DI /inventory → Portal /admin/products (inventory ↔ product catalog)
// DI /contracts → Portal /account/contracts (contract management)
// DI /journal-entries → ERP /erp (GL journal entries)
// DI /financial-statements → Portal /insights/analytics (financial data)
//
// Functions:
// getExternalRoutes(diPath: string): RouteMapping[]  — find linked external pages
// getDIRoute(appId: string, appPath: string): RouteMapping | null — find DI page for an external page
// getAllMappingsForApp(appId: string): RouteMapping[] — all mappings for one app
```

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 7: Cross-App Navigation Helpers

**Files:**
- Create: `src/lib/integration/cross-app-nav.ts`

- [ ] **Step 1: Create navigation utilities**

```typescript
// Functions for navigating between apps:
//
// buildDeepLink(appId: string, path: string, params?: Record<string, string>): string
//   — Constructs full URL with optional query params
//   — Uses app-registry to get base URL
//
// buildDIReturnLink(currentDIPath: string): string
//   — Creates a return URL that external apps can use to jump back to DI
//
// getRelatedApps(diPath: string): Array<{ app: AppInfo; path: string; label: string }>
//   — Uses route-map to find all related external pages for the current DI page
//   — Used by AppSwitcher and CrossAppBreadcrumb components
//
// parseIncomingLink(url: string): { appId: string; path: string; params: Record<string, string> } | null
//   — Parses an incoming URL to determine which app and page it points to
```

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 8: Data Bridge (Gateway-Backed Cross-App Data)

**Files:**
- Create: `src/lib/integration/data-bridge.ts`

- [ ] **Step 1: Create data bridge**

```typescript
// Gateway-backed data bridge for fetching cross-app data without direct DB access.
// All data flows through the existing gateway at :3847.
//
// interface BridgeQuery {
//   source: 'ascend' | 'salesforce' | 'samsara' | 'fleetpanda' | 'vroozi';
//   endpoint: string;        // gateway path (e.g., '/ascend/customers')
//   params?: Record<string, string>;
//   sql?: string;            // for /ascend/query
// }
//
// interface BridgeResult<T> {
//   success: boolean;
//   source: string;
//   data: T[];
//   cached: boolean;
//   fetchedAt: string;
// }
//
// Functions:
//
// fetchBridgeData<T>(query: BridgeQuery): Promise<BridgeResult<T>>
//   — Calls gateway, normalizes response, adds local cache (localStorage, 5min TTL)
//
// fetchPortalData(endpoint: string): Promise<BridgeResult<unknown>>
//   — Convenience: fetches from Portal's /api/live/* routes
//
// fetchEquipmentData(endpoint: string): Promise<BridgeResult<unknown>>
//   — Convenience: fetches from ET's /api/* routes
//
// invalidateCache(source?: string): void
//   — Clears bridge cache (all or by source)
//
// GATEWAY_BASE_URL from process.env.GATEWAY_BASE_URL || 'http://127.0.0.1:3847'
// GATEWAY_API_KEY from process.env.GATEWAY_API_KEY
```

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 9: AppSwitcher Component

**Files:**
- Create: `src/components/integration/AppSwitcher.tsx`

- [ ] **Step 1: Create AppSwitcher**

A dropdown tile that shows all 4 Delta360 apps with health status indicators. Clicking an app opens it in a new tab (or same tab for DI internal navigation). Shows the current app highlighted.

Props: `currentApp?: string` (defaults to 'delta-intelligence')

Uses:
- `getAllApps()` from app-registry
- `getRelatedApps(currentPath)` from cross-app-nav to show "Related in [App]" section
- `SpokeStatusBadge` for health dots
- Lucide icons: `ExternalLink`, `LayoutGrid`

Layout: 2x2 grid of app tiles. Each tile: icon + name + health dot + description line. Hover shows "Open in new tab". If related routes exist for current page, show them below the grid.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 10: CrossAppBreadcrumb Component

**Files:**
- Create: `src/components/integration/CrossAppBreadcrumb.tsx`

- [ ] **Step 1: Create breadcrumb**

Shows context-aware breadcrumb trail. When on a page that has cross-app mappings, shows clickable links to the related app pages.

Example: On DI's `/ap` page → "Delta Intelligence > Finance > AP" with a small "→ Portal: Purchasing" link.

Props: `currentPath: string`, `currentModule: string | null`

Uses:
- `getExternalRoutes(currentPath)` from route-map
- `buildDeepLink()` from cross-app-nav
- Lucide: `ChevronRight`, `ExternalLink`

Style: Subtle zinc-500 text, orange for clickable links, tiny ExternalLink icon.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 11: SpokeStatusBadge Component

**Files:**
- Create: `src/components/integration/SpokeStatusBadge.tsx`

- [ ] **Step 1: Create badge**

Tiny inline health indicator. Green dot = healthy, yellow = degraded, red = down, gray = unknown.

Props: `status: 'healthy' | 'degraded' | 'down' | 'unknown'`, `size?: 'sm' | 'md'`

8px dot (sm) or 12px dot (md) with subtle pulse animation on 'degraded'.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 12: ERP Hub Page

**Files:**
- Create: `src/app/(dashboard)/erp/page.tsx`

- [ ] **Step 1: Create ERP hub**

Landing page for the ERP replacement module. Grid of 5 tiles linking to sub-modules:
1. Accounts Payable (`/erp/ap`) — Icon: `Receipt`, "Vendor invoices, payments, aging"
2. Accounts Receivable (`/erp/ar`) — Icon: `Banknote`, "Customer invoices, collections, aging"
3. Inventory (`/erp/inventory`) — Icon: `Package`, "Stock levels, valuation, product catalog"
4. Contracts (`/erp/contracts`) — Icon: `FileText`, "Vendor & customer contracts, renewals"
5. Purchasing (`/erp/purchasing`) — Icon: `ShoppingCart`, "Purchase orders, Vroozi, procurement"

Each tile shows a live KPI pulled from the gateway (e.g., AP total, AR aging, contract count). If gateway is unavailable, show "—" with "Gateway offline" tooltip.

Use `fetchBridgeData` from data-bridge.ts for all gateway calls. Include `'use client'` directive.

Style: Dark zinc cards, orange accent on hover, 3-column grid.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 13: ERP — Accounts Payable Module

**Files:**
- Create: `src/app/(dashboard)/erp/ap/page.tsx`

- [ ] **Step 1: Create AP module page**

Full AP module pulling live data from gateway:

**Data sources (gateway SQL):**
- AP Aging: `SELECT vendor_name, SUM(CASE WHEN ...) as Current, ... FROM vPurchaseJournal WHERE Year_For_Period = 2026 GROUP BY vendor_name ORDER BY total DESC LIMIT 50`
- Top vendors: `SELECT vendor_name, SUM(debit) as total_spend FROM vPurchaseJournal WHERE Year_For_Period = 2026 GROUP BY vendor_name ORDER BY total_spend DESC LIMIT 20`
- GL categories: `SELECT DISTINCT Account_Desc FROM vPurchaseJournal ORDER BY Account_Desc`

**UI sections:**
1. KPI bar: Total AP, 90+ days, Top vendor, Payment due this week (all from gateway)
2. AP Aging table: Vendor | Current | 1-30 | 31-60 | 61-90 | 90+ | Total
3. Top Vendors chart: Horizontal bar chart (use Recharts)
4. GL Category breakdown: Collapsible list of 680 categories with amounts

Use `fetchBridgeData` with SQL queries via `/ascend/query`. Fallback to mock data if gateway offline.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 14: ERP — Accounts Receivable Module

**Files:**
- Create: `src/app/(dashboard)/erp/ar/page.tsx`

- [ ] **Step 1: Create AR module page**

**Data sources (gateway):**
- AR Aging: `GET /ascend/ar/aging` or `GET /ascend/ar/aging`
- Customer invoices: `GET /ascend/invoices?year=2026`
- Top customers by revenue: `GET /ascend/revenue/by-customer`

**UI sections:**
1. KPI bar: Total AR, 90+ days overdue, DSO (days sales outstanding), Collection rate
2. AR Aging table: Customer | Current | 1-30 | 31-60 | 61-90 | 90+ | Total
3. Recent invoices: Date | Customer | Amount | Status | Days outstanding
4. Cross-app link: "→ View in Portal" linking to Portal's invoice management

Use existing gateway endpoints (not raw SQL where endpoints exist).

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 15: ERP — Inventory Module

**Files:**
- Create: `src/app/(dashboard)/erp/inventory/page.tsx`

- [ ] **Step 1: Create inventory module page**

**Data sources (gateway SQL):**
- Product catalog: `SELECT MasterProdID, MasterProdDescr, ProductType FROM DF_PBI_DS_SalesAndProfitAnalysis GROUP BY MasterProdID, MasterProdDescr, ProductType`
- Rack prices: `GET /ascend/query` with `SELECT * FROM vRackPrice WHERE RackPrice > 0 ORDER BY Vendor_Name, SupplyPoint, ProductDescr`
- Sales volume: `SELECT MasterProdDescr, SUM(Qty) as total_qty, SUM(Qty * UnitPrice) as total_revenue FROM DF_PBI_BillingChartQuery WHERE Year_For_Period = 2026 GROUP BY MasterProdDescr ORDER BY total_revenue DESC LIMIT 30`

**UI sections:**
1. KPI bar: Product count, Top product by volume, Rack price range, Revenue YTD
2. Product catalog table: Product | Type | Volume (gal) | Revenue | Avg price
3. Rack price tracker: Supply point × product matrix with latest prices
4. Cross-app link: "→ Portal Products" linking to Portal's product catalog

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 16: ERP — Contracts Module

**Files:**
- Create: `src/app/(dashboard)/erp/contracts/page.tsx`

- [ ] **Step 1: Create contracts module page**

**Data sources (gateway):**
- Salesforce contracts: `GET /salesforce/query` with SOQL: `SELECT Id, ContractNumber, Account.Name, Status, StartDate, EndDate, ContractTerm FROM Contract ORDER BY EndDate ASC LIMIT 50`
- Salesforce opportunities: `GET /salesforce/query` with SOQL: `SELECT Id, Name, Amount, StageName, CloseDate, Account.Name FROM Opportunity WHERE IsClosed = false ORDER BY CloseDate ASC LIMIT 30`

**UI sections:**
1. KPI bar: Active contracts, Expiring in 30 days, Total contract value, Pipeline value
2. Contracts table: # | Account | Status | Start | End | Term | Value
3. Expiring soon: Filtered view of contracts ending within 60 days (orange highlight)
4. Pipeline: Open opportunities sorted by close date
5. Cross-app link: "→ Portal Contracts" linking to Portal's contract management

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 17: ERP — Purchasing Module

**Files:**
- Create: `src/app/(dashboard)/erp/purchasing/page.tsx`

- [ ] **Step 1: Create purchasing module page**

**Data sources (gateway):**
- Vroozi suppliers: `GET /vroozi/suppliers`
- Vroozi catalogs: `GET /vroozi/catalogs`
- AP by GL category: `GET /ascend/query` with `SELECT Account_Desc, SUM(debit) as total FROM vPurchaseJournal WHERE Year_For_Period = 2026 GROUP BY Account_Desc ORDER BY total DESC LIMIT 30`

**UI sections:**
1. KPI bar: Active suppliers (25 Vroozi), Catalog items (2,605), Spend MTD, Open POs
2. Suppliers table: Name | Category | Spend YTD | Last PO | Status
3. Top spend categories: Bar chart of GL categories
4. Vroozi catalog browser: Searchable list of 2,605 items

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 18: Register ERP Module in Module Registry

**Files:**
- Modify: `src/lib/shell/module-registry.ts`

- [ ] **Step 1: Add ERP module group**

Add a new module group to `MODULE_GROUPS`:
```typescript
{
  id: 'erp',
  label: 'ERP',
  icon: 'Database',
  defaultPath: '/erp',
  pages: ['/erp', '/erp/ap', '/erp/ar', '/erp/inventory', '/erp/contracts', '/erp/purchasing'],
}
```

Also add integration routes to the `platform` group or create a new `integration` group:
```typescript
{
  id: 'integration',
  label: 'Integration',
  icon: 'Link',
  defaultPagePath: '/erp',  // Shares hub with ERP since integration is managed via AppSwitcher
  pages: [],
}
```

Note: Do NOT create a separate `/integration` page — the AppSwitcher dropdown handles cross-app navigation. The `defaultPagePath` points to `/erp` as the closest relevant hub.

- [ ] **Step 2: Add ERP events to event-types.ts**

Add to `EVENT_TYPES`:
```typescript
// ERP module events
ERP_AP_VIEWED: 'erp.ap.viewed',
ERP_AR_VIEWED: 'erp.ar.viewed',
ERP_INVENTORY_VIEWED: 'erp.inventory.viewed',
ERP_CONTRACT_VIEWED: 'erp.contract.viewed',
ERP_PURCHASE_ORDER_CREATED: 'erp.purchase_order.created',
ERP_VENDOR_PAYMENT_SCHEDULED: 'erp.vendor_payment.scheduled',
```

- [ ] **Step 3: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 19: Integration API Routes

**Files:**
- Create: `src/app/api/integration/apps/route.ts`
- Create: `src/app/api/integration/navigate/route.ts`
- Create: `src/app/api/integration/bridge/[app]/route.ts`

- [ ] **Step 1: Create apps listing endpoint**

`GET /api/integration/apps` — Returns all registered apps with health status.
Calls `getAllApps()` + `getAppHealth(id)` for each. Caches health results for 30 seconds.

- [ ] **Step 2: Create navigation resolver**

`POST /api/integration/navigate` — Body: `{ from: { app, path }, to: { app } }`. Returns the best matching route in the target app using route-map.ts.

- [ ] **Step 3: Create data bridge proxy**

`GET /api/integration/bridge/[app]?endpoint=/api/live/customers` — Proxies a request to another app's API. MUST: (1) Gate behind `getServerSession(authOptions)` — reject 401 if not authenticated. (2) Validate the app exists in registry. (3) Validate `endpoint` param against an allowlist derived from the spoke's registered capabilities (do NOT allow arbitrary paths — this prevents path traversal and SSRF). (4) Add gateway auth headers.

- [ ] **Step 4: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 20: Wire AppSwitcher into DataOS Shell

**Files:**
- Modify: `src/components/shell/NovaBar.tsx`
- Modify: `src/components/shell/DataOSShell.tsx`

- [ ] **Step 1: Add AppSwitcher to NovaBar**

Read `NovaBar.tsx` fully first. Add the AppSwitcher component to the right section of NovaBar, before the user avatar dropdown. It should be a small grid icon (`LayoutGrid`) that opens the AppSwitcher dropdown on click. Pass `currentPage` (already available as a prop on NovaBar) as the `currentPath` prop to AppSwitcher — no interface change needed on NovaBar.

- [ ] **Step 2: Add CrossAppBreadcrumb to DataOSShell**

Read `DataOSShell.tsx` fully first. Add the CrossAppBreadcrumb component below ModuleTabs and above the Workspace content area. Pass `currentPath` and `currentModule` as props.

- [ ] **Step 3: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 21: Update Spoke Registry

**Files:**
- Modify: `src/lib/spoke-registry.ts`

- [ ] **Step 1: Update spoke URLs and health paths**

Read the file first. Ensure all 4 spokes have correct:
- `url`: localhost URLs for dev (Portal :3000, ET :3001 or prod URL, Signal Map :3002)
- `healthPath`: `/api/health` for all
- `capabilities` array matches what the apps actually provide

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

---

## Task 22: Final Integration Verification

- [ ] **Step 1: Full build check**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 2: Verify Nova context count**

The total Nova context count should now be 10:
finance, operations, intelligence, compliance, organization, signal-map, gl, portal, equipment-tracker, erp

- [ ] **Step 3: Verify module registry**

The module registry should now have 9 groups: finance, operations, intelligence, organization, compliance, admin, platform, erp, integration (plus 3 spoke modules).

- [ ] **Step 4: Verify ERP pages render**

Check that all 6 ERP pages exist and export default components:
`/erp`, `/erp/ap`, `/erp/ar`, `/erp/inventory`, `/erp/contracts`, `/erp/purchasing`

---

## Execution Notes

**Agent parallelization strategy:**
- Wave 1 (Tasks 1-4): Nova contexts + index registration — all independent, run in parallel
- Wave 2 (Tasks 5-8): Integration foundation — app registry, route map, nav helpers, data bridge — all independent
- Wave 3 (Tasks 9-11): UI components — AppSwitcher, Breadcrumb, Badge — all independent
- Wave 4 (Tasks 12-17): ERP module pages — all independent, run 6 agents in parallel
- Wave 5 (Tasks 18-21): Wiring — registry updates, API routes, shell integration — some dependencies
- Wave 6 (Task 22): Verification — sequential

**DB-agnostic pattern:** All data fetching uses `fetchBridgeData()` which calls the gateway API. When Supabase is ready, swap the data layer in `data-bridge.ts` to query Supabase directly for cached/local data, falling back to gateway for live Ascend/SF/Samsara data.
