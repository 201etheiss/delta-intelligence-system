# Delta Intelligence — DataOS UI/UX Upgrade Design Spec

**Date:** 2026-04-01
**Author:** Evan Theiss
**Status:** Approved
**Depends on:** 2026-04-01-delta-intelligence-dataos-design.md (DataOS architecture spec)

---

## 1. Purpose

Transform Delta Intelligence from a traditional sidebar-nav admin app into a Module Grid OS — an operating-system-level shell where every business tool is a module, Nova is the persistent AI layer, and the platform adapts its information density to the user's role.

This is DataOS Phase 3 (UI/UX Upgrade), pulled forward so the frontend is ready for database attachment (Supabase, Neo4j, TimescaleDB, Redis) while the Delta Portal ships in parallel.

### 1.1 Success Criteria

1. All 62 existing DI pages render inside the new OS shell without page-level rewrites.
2. Nova Bar, Status Rail, Module Tabs, and Workspace are the only navigation primitives (sidebar removed).
3. Chat is a persistent slide-out panel accessible from any module, context-aware of the active page.
4. Density toggle (Executive/Operator) changes content rendering on Tier 1 pages (Dashboard, Financial Statements, AP Console, Fleet Ops, Cockpit).
5. Home Grid shows intelligence summary (session continuity, overnight changes, action items) and personalized module tiles.
6. `@delta/ui` token system provides consistent design tokens across all modules.

### 1.2 Non-Goals

- No page content rewrites beyond Tier 1 density views.
- No backend/API changes — this is a frontend shell upgrade.
- No event store or database migration (separate phase).
- No multi-tenancy or commercial features.

---

## 2. Shell Architecture

The OS shell is a persistent frame that wraps all module content. It consists of four components that never unmount during navigation.

### 2.1 Nova Bar (Top)

Persistent AI intelligence strip across the top of every screen.

| Element | Description |
|---------|-------------|
| **Nova Avatar** | Orange gradient circle ("N"), click opens Nova command palette |
| **Nova Input** | Quick-invoke text field, shows current module context ("currently viewing Financial Statements") |
| **Alert Pills** | Three status pills: Alerts (orange), Bots Active (purple), Automations (green). Click to expand detail panel. |
| **Density Toggle** | EX/OP toggle buttons. Active mode highlighted in orange. Persisted to localStorage, role determines default. |
| **Notification Bell** | Bell icon with unread count badge. Click opens notification inbox dropdown. |
| **User Avatar** | Initials circle, click opens user menu (settings, logout). |

**Behavior:**
- Nova Input is focused on Cmd+P (command palette shortcut — matches existing `layout.tsx` binding). Cmd+K is reassigned from its current `/chat` navigation to toggling the chat slide-out panel (since `/chat` as a page is replaced by the persistent panel). Cmd+Shift+C is an alias for the chat panel toggle.
- Context text updates automatically when module/page changes.
- Alert pills show live counts; clicking opens a popover with detail list.
- Nova Avatar click opens a full command palette with: recent queries, saved bots, quick actions, module search.

### 2.2 Status Rail (Left)

Thin vertical icon bar (48px wide), modeled on VS Code's activity bar.

| Section | Icons |
|---------|-------|
| **Module Groups** | Home, Finance, Operations, Intelligence, Compliance, Admin (6 icons) |
| **Utilities** | Chat toggle, Search (below a divider) |
| **Health Dots** | Bottom section: colored dots for each data source (Ascend, Salesforce, Samsara, Power BI, etc.) |

**Behavior:**
- Clicking a module group icon navigates to that module group. If the group has multiple pages, the module's default page opens in a new tab.
- Chat icon toggles the chat slide-out panel. Active state glows orange.
- Health dots are green (connected), yellow (degraded), red (down). Hover shows service name and latency. Data sourced from `GET /api/admin/health` endpoint (existing), polled every 60 seconds. Maps service names from the health response to colored dots.
- Rail collapses to icon-only (no labels). Tooltip on hover shows the label.

### 2.3 Module Tabs (Below Nova Bar)

Browser-tab pattern for open modules.

| Element | Description |
|---------|-------------|
| **Tab** | Icon + label + close button. Active tab has orange bottom border. |
| **"+" Button** | Opens new tab → returns to Home Grid for module selection. |

**Behavior:**
- Multiple modules can be open simultaneously as tabs.
- Closing all tabs returns to Home Grid.
- Tab state persisted to localStorage (reopen tabs on refresh).
- Within a module tab, pages switch via the existing SubNavTabs component (horizontal tabs inside the content area).
- Tab order is draggable (using `@dnd-kit/core` + `@dnd-kit/sortable` — lightweight, accessible, React-native). Scoped to Phase E polish.
- Maximum 8 tabs. At 8, the "+" button is disabled with tooltip "Close a tab to open another". Tab bar horizontally scrolls if tabs overflow the available width.

### 2.4 Workspace (Center)

The main content area where module pages render.

- Fills remaining space (full height minus Nova Bar and Module Tabs, full width minus Status Rail).
- When chat panel is open, workspace content shifts left (not overlapped — side-by-side).
- Respects density mode context.
- All existing DI pages render here unchanged (wrapped in the shell layout).

---

## 3. Persistent AI Layer

Chat, assistants, bots, and automations are OS-level features accessible from anywhere — not pages you navigate to.

### 3.1 Chat Panel

Slide-out panel (380px wide) on the right side of the workspace.

| Section | Description |
|---------|-------------|
| **Header** | Nova avatar, "Nova" title, current module context subtitle, mode pills (Chat / Bots / History) |
| **Messages** | Scrollable message area. User messages right-aligned (zinc), Nova messages left-aligned (orange tint). Action suggestions in green-tinted cards with execute buttons. |
| **Context Bar** | Below messages: module context chips (auto-populated from current page), attach button for documents. |
| **Input** | Text input field + orange send button. |

**Chat Mode:** Standard conversation with Nova. Context-aware — Nova's system prompt includes the current module's schema, vocabulary, and available actions (from the Module Context Protocol).

**Bots Mode:** List of saved automation bots. Each shows: name, schedule (cron), last run status, next run time. One-click run button. Create new bot button.

**History Mode:** Recent chat conversations with search. Click to resume a conversation.

**Behavior:**
- Toggle via Rail chat icon or Cmd+Shift+C.
- Conversation persists across module switches (same thread continues).
- Module context chips update when you switch modules/pages.
- Existing /chat page remains as a "full-screen chat" option (opens as its own module tab).
- Nova proactively surfaces suggested actions based on what the user is viewing (e.g., "Run AP Aging Audit" when viewing overdue invoices).

### 3.2 Nova Bar Integration

The three Nova Bar pills surface OS-level intelligence:

- **Alerts pill:** Click opens popover listing active alerts from the alerts engine (existing `alerts-engine.ts`). Each alert links to the relevant module/page.
- **Bots pill:** Click opens popover listing active bots with status (running/idle/failed). Links to full bot management in chat panel's Bots mode.
- **Automations pill:** Click opens popover listing recent automation runs. Links to /automations module for full management.

### 3.3 Nova Command Palette

Triggered by clicking the Nova Avatar or Cmd+K. Full-screen overlay with:

- Search field (searches modules, pages, recent queries, bots, data).
- Recent queries section.
- Quick actions section (configurable per user).
- Module launcher (type module name to jump there).

This replaces the existing CommandPalette component with an enhanced version. Triggered by Cmd+P (matching the existing keybinding).

---

## 4. Content-Aware Density Modes

Two rendering modes toggled from the Nova Bar. Each page implements both views using shared density-aware components.

### 4.1 DensityProvider Context

```
DensityProvider (React Context)
├── useDensity() → "executive" | "operator"
├── Default: role-based (see mapping below)
├── User override: localStorage key "di_density_mode"
└── Toggle: Nova Bar EX/OP buttons
```

**Role → density mapping** (against existing role values in `src/lib/config/roles.ts`):

| Role | Default Density | Rationale |
|------|----------------|-----------|
| `admin` | executive | Admin users are typically managers |
| `accounting` | operator | Accountants need full ledger detail |
| `sales` | executive | Sales users want summary KPIs |
| `operations` | operator | Ops needs dispatch-level detail |
| `hr` | executive | HR views summary dashboards |
| `readonly` | executive | Read-only users get the curated view |

### 4.2 Executive Mode

- Large KPI cards with trend deltas (up/down percentages)
- Summary charts (bar charts, progress bars, composition breakdowns)
- Nova Insight callouts (AI-generated observations about the data)
- Clean whitespace, larger typography (16px body, 28px KPI values)
- Detail rows hidden — only summaries and aggregates shown
- Action-oriented: "What needs attention" framing

### 4.3 Operator Mode

- Full data tables with monospace tabular numbers
- Account codes, balance/prior/variance columns
- Inline controls (YoY, MoM, Export, Drill-down buttons)
- Section headers for account groups
- KPI strip (compact horizontal bar with key numbers)
- Dense spacing, smaller type (12px body, 14px values)
- Monospace font for all numbers (`font-variant-numeric: tabular-nums`)
- Scrollable table containers with sticky headers

### 4.4 Shared Density Components

| Component | Executive Rendering | Operator Rendering |
|-----------|--------------------|--------------------|
| `DensityKPI` | Large card with trend delta | Inline cell in KPI strip |
| `DensityTable` | Summary rows with sparklines | Full table with all columns |
| `DensityChart` | Large chart with annotations | Compact sparkline |
| `DensityInsight` | Full Nova insight card | Collapsed indicator dot |
| `DensitySection` | Card with heading and content | Table section header row |

### 4.5 Tier 1 Pages (Dual Rendering)

These pages get full content-aware density implementations first:

1. **/** — Dashboard (KPI cards vs activity feed)
2. **/financial-statements** — Balance Sheet, Income Statement, Trial Balance (summary vs full ledger)
3. **/ap/invoices** — AP Console (aging chart vs full invoice queue)
4. **/fleet** — Operations Console (map + KPIs vs dispatch table)
5. **/cockpit** — Controller Cockpit (alert cards vs detail panels)

### 4.6 Tier 2 Pages (Phase 2)

All other pages receive CSS-level density (spacing and typography) via the DensityProvider's class injection, with content-aware rendering added incrementally.

---

## 5. Home Grid with Intelligence Summary

The landing screen when the user opens DI or clicks the Home icon.

### 5.1 Intelligence Summary Banner

Top section of the Home Grid. Three intelligence cards in a row:

| Card | Source | Content |
|------|--------|---------|
| **Resume Where You Left Off** | Session state object (module, page, scroll, filters, timestamp) stored in localStorage | Shows last active module/page with context description. One-click "Jump back" link. |
| **What Changed Overnight** | Gateway snapshot diff (see §8.3) and automation logs from `data/automations.json` | Aggregated counts: new invoices, completed deliveries, anomalies detected, automation runs. Clickable categories. |
| **Needs Your Attention** | Alerts engine, automation failures, Nova anomaly detection | Priority action items: overdue invoices, reconciliation exceptions, closing opportunities. Each links to relevant module. "View all N action items" link. |

Below the three cards: **Activity Timeline** — horizontal strip of recent platform events with colored dots (green=success, orange=anomaly, blue=data, purple=automation) and relative timestamps.

### 5.2 Module Grid

Below the intelligence summary. Two sections:

**Pinned (top):** User's favorited modules, ordered by preference. Star icon on each tile.

**All Modules (below):** Full module catalog. Each tile shows:
- Module icon (color-coded by domain)
- Module name
- Short description
- Status badge (LIVE / IN DEV / DEPLOYED)
- Stats line (page count, alert count, live data point)
- Notification badge (unread count from that module's alerts)

**Controls:**
- Grid/List view toggle
- Customize button (opens drag-to-reorder, pin/unpin, hide/show)
- Module groupings are data-driven (stored in a config, not hardcoded)

**Personalization:**
- Pin state, order, hidden modules stored in user preferences (existing `user-preferences.ts`).
- Admin sets role-based defaults (accountants see Finance pinned by default).
- Usage-based reordering: modules the user opens most frequently drift upward over time.
- Module groups are per-user overridable (fixed set for now, dynamic in Phase 5).

### 5.3 Add Module Tile

Dashed-border tile at the end of the grid. Links to module marketplace (placeholder for Phase 5 Commercialization). For now, shows available spoke modules (Portal, Equipment Tracker, Signal Map) that can be enabled.

---

## 6. `@delta/ui` Design Token System

Shared design tokens for consistent styling across DI and all spoke modules.

### 6.1 Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--delta-orange` | #FE5000 | Primary brand, active states, CTAs. **Note:** Existing codebase uses #FF5C00 throughout — Phase E must find-and-replace all instances of #FF5C00, #E54800 (hover variant) with #FE5000 and a computed hover variant. This is a deliberate brand color correction per Delta360 brand spec. |
| `--delta-black` | #000000 | Text on light backgrounds |
| `--bg-primary` | #0a0a0a | Page background |
| `--bg-secondary` | #0f0f11 | Workspace background |
| `--bg-surface` | #18181b | Cards, panels |
| `--bg-elevated` | #27272a | Elevated surfaces, borders |
| `--bg-input` | rgba(255,255,255,0.05) | Input fields |
| `--border-default` | #27272a | Default borders |
| `--border-active` | #FE5000 | Active/selected borders |
| `--text-primary` | #e4e4e7 | Primary text |
| `--text-secondary` | #a1a1aa | Secondary text |
| `--text-muted` | #71717a | Muted/placeholder text |
| `--text-disabled` | #52525b | Disabled text |
| `--status-green` | #22c55e | Success, connected, positive delta |
| `--status-yellow` | #eab308 | Warning, degraded |
| `--status-red` | #ef4444 | Error, disconnected, negative delta |
| `--status-blue` | #3b82f6 | Info, operations |
| `--status-purple` | #a855f7 | Intelligence, bots |

### 6.2 Typography Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | Inter, system-ui, sans-serif | Body text |
| `--font-heading` | Georgia, serif | Page titles, section headings (institutional) |
| `--font-mono` | 'SF Mono', 'Fira Code', monospace | Numbers in operator mode, code |
| `--text-xs` | 10px | Badges, labels |
| `--text-sm` | 12px | Secondary text, table cells |
| `--text-base` | 14px | Body text |
| `--text-lg` | 16px | Emphasized body |
| `--text-xl` | 20px | Section headings |
| `--text-2xl` | 28px | KPI values (executive) |
| `--text-3xl` | 32px | Page titles |

### 6.3 Spacing Tokens

Executive mode uses 1.5x spacing multiplier. Operator mode uses 0.75x.

| Token | Executive | Operator |
|-------|-----------|----------|
| `--space-xs` | 6px | 3px |
| `--space-sm` | 12px | 6px |
| `--space-md` | 24px | 12px |
| `--space-lg` | 32px | 20px |
| `--space-xl` | 48px | 28px |

### 6.4 Component Tokens

Shared primitives that density-aware components consume:

- `--card-radius`: 12px (exec) / 6px (oper)
- `--card-padding`: 20px (exec) / 12px (oper)
- `--table-row-height`: 48px (exec) / 28px (oper)
- `--kpi-value-size`: 28px (exec) / 14px (oper)

---

## 7. Navigation Mapping

How existing pages map into the new shell.

### 7.1 Module Groups

| Module | Rail Icon | Pages |
|--------|-----------|-------|
| **Finance** | &#128176; | /, /financial-statements, /journal-entries, /close-tracker, /cash-flow, /budgets, /reconciliations, /ap/invoices, /ar/collections, /tax, /commentary, /expenses, /otc, /late-posted, /packages, /brief |
| **Operations** | &#128666; | /fleet-map, /fleet, /assets/fixed, /inventory, /contracts |
| **Intelligence** | &#128200; | /executive, /market, /sales, /customer, /analytics, /analytics/visualizations, /reports, /reports/templates, /digest |
| **Organization** | &#128101; | /people, /hr, /workstreams, /integrations |
| **Compliance** | &#128737; | /vault, /audit, /controls, /exceptions |
| **Admin** | &#9881; | /admin/users, /admin/permissions, /admin/integrations, /admin/health, /admin/audit, /admin/usage, /settings, /api-docs |
| **Platform** | &#128203; | /platform, /dashboards, /dashboards/[id], /workspaces, /sources, /glossary, /documents, /shared, /shared/[id], /history, /onboarding |

### 7.2 OS-Level Features (Not Modules)

These exist in the shell, not as module tabs:

- **Chat** → slide-out panel (existing /chat page becomes full-screen option, toggle via Cmd+K)
- **Search** → opens search overlay (existing /search page)
- **Notifications** → Nova Bar bell dropdown (existing NotificationBell component extracted from layout.tsx and mounted inside NovaBar.tsx — single instance, no duplication)
- **Assistant** → integrated into Nova chat panel (existing /assistant page redirects to chat panel)
- **Automations** → Nova Bar pill + chat panel Bots tab (existing /automations as full module in Platform group)
- **Command Palette** → Nova Avatar click / Cmd+P

### 7.3 SubNavTabs Within Modules

Each module group uses SubNavTabs (existing component) for intra-module navigation. Example for Finance:

```
[Financials] [Journal Entries] [Close Tracker] [Cash Flow] [AP] [AR] [Tax] [More ▾]
```

**Migration note:** The existing SubNavTabs has hardcoded `TAB_GROUPS` with pathname-based auto-detection. This works as-is within the new shell because module pages retain their existing routes — the pathname matching still resolves correctly. However, Phase A should refactor SubNavTabs to accept an optional `group` prop so module tabs can explicitly scope which tab group renders, rather than relying solely on pathname matching. This prevents edge cases where two module tabs showing pages from the same URL prefix collide.

---

## 8. Session State Management

### 8.1 Session State Object

```typescript
interface SessionState {
  lastModule: string;        // e.g., "finance"
  lastPage: string;          // e.g., "/financial-statements"
  lastPageContext: string;    // e.g., "Balance Sheet tab, March 2026"
  scrollPosition: number;
  activeFilters: Record<string, string>;
  timestamp: string;         // ISO 8601
  openTabs: TabState[];      // Array of open module tabs
  densityMode: "executive" | "operator";
  pinnedModules: string[];   // Module IDs
  moduleOrder: string[];     // Custom module grid order
}
```

Stored in localStorage under `di_session_state`. Updated on every page navigation and significant interaction (filter change, tab switch, scroll stop).

### 8.2 Intelligence Summary Data

The Home Grid intelligence summary is assembled from:

1. **Session state** → "Resume Where You Left Off" card
2. **Gateway API polling** → "What Changed" card (compare current counts vs last-session snapshot)
3. **Alerts engine** → "Needs Attention" card (active alerts, automation failures)
4. **Automation logs** → Activity timeline (recent runs)

Future (post-Event Store): All of these are sourced from the event stream instead of API polling.

### 8.3 Gateway Snapshot Diff (What Changed Overnight)

On each session end (or browser close), the system snapshots key counts from the gateway:

```typescript
interface GatewaySnapshot {
  timestamp: string;
  counts: {
    apInvoices: number;        // GET /ascend/query (SELECT COUNT(*) FROM APInvoice WHERE ...)
    arInvoices: number;        // GET /ascend/query (SELECT COUNT(*) FROM ARInvoice WHERE ...)
    deliveries: number;        // GET /samsara/fleet/routes (completed count)
    automationRuns: number;    // data/automations.json run log length
    alerts: number;            // data/alerts.json active count
  };
}
```

Stored in localStorage under `di_gateway_snapshot`. On next session start, the Home Grid fetches fresh counts from the same endpoints and computes deltas (new - previous). The intelligence summary card shows these deltas as "7 new invoices", "3 deliveries completed", etc.

**Gateway endpoints polled:**
1. `POST /ascend/query` with `SELECT COUNT(*) FROM APInvoice WHERE DateCreated > '{lastSessionDate}'` → new AP invoices
2. `POST /ascend/query` with `SELECT COUNT(*) FROM ARInvoice WHERE DateCreated > '{lastSessionDate}'` → new AR invoices
3. `GET /samsara/fleet/vehicles/stats` → completed deliveries since last session
4. Local `data/automations.json` → automation run logs since last session
5. Local alerts engine → active alert count

**Activity Timeline** sources from the same data: automation completions, new invoices, feed anomalies (from `data/alerts.json`), and delivery confirmations. Each event is timestamped and categorized.

### 8.4 Module Usage Tracking

Module open events are recorded to localStorage under `di_module_usage`:

```typescript
interface ModuleUsage {
  [moduleId: string]: {
    openCount: number;
    lastOpened: string; // ISO 8601
  };
}
```

Written on every module tab open. Read by Home Grid to sort the "All Modules" section by frequency (highest openCount first). Pinned modules always appear in the Pinned section regardless of frequency.

---

## 9. Implementation Phasing

### Phase A: Shell Foundation

Build the OS shell layout. Mount existing pages inside it.

- New layout component: `DataOSShell` (replaces current dashboard layout)
- Nova Bar component (static — pills show placeholder counts)
- Status Rail component (icons, health dots)
- Module Tabs component (tab state management)
- Workspace wrapper (renders existing page content)
- Remove sidebar navigation
- Persist tab state to localStorage
- Wire Cmd+K to Nova command palette

**Exit criteria:** All 62 pages render correctly inside the shell. Rail navigation works. Tabs open/close/persist. No sidebar. Cmd+P opens command palette. Cmd+K is unbound (reassigned in Phase B to chat panel toggle). Chat Rail icon is visible but disabled (placeholder until Phase B).

### Phase B: Chat Panel & Nova Integration

Build the persistent chat panel and wire Nova into the shell.

- Chat slide-out panel component (Chat/Bots/History modes)
- Context-aware system prompt injection (current module's schema/vocabulary)
- Module context chips in chat input area
- Nova Bar pills wired to alerts engine, automation logs
- Nova command palette (enhanced from existing CommandPalette)

**Exit criteria:** Chat panel toggles from Rail. Nova knows which module you're viewing. Bots tab shows active automations. Command palette searches modules and data.

### Phase C: Density Modes

Implement content-aware density for Tier 1 pages.

- DensityProvider context + useDensity() hook
- Design token system (CSS custom properties)
- Shared density components (DensityKPI, DensityTable, DensityChart, DensityInsight)
- Tier 1 page dual rendering: Dashboard, Financial Statements, AP Console, Fleet Ops, Cockpit
- CSS-level density for all other pages (spacing/type scaling via provider class)

**Exit criteria:** EX/OP toggle on Nova Bar changes rendering on Tier 1 pages. All pages respect spacing/type density. Role-based defaults work.

### Phase D: Home Grid Intelligence

Build the intelligent home screen.

- Intelligence summary banner (three cards + activity timeline)
- Session state tracking and persistence
- Overnight change detection (gateway snapshot diff)
- Action item aggregation from alerts engine
- Module grid with pinned/all sections
- Grid personalization (pin, reorder, hide, Grid/List toggle)
- Usage-based module reordering (frequency tracking)

**Exit criteria:** Home Grid shows session continuity, overnight changes, and action items. Modules are pinnable and reorderable. User preferences persist.

### Phase E: Polish & Token System

Final design pass and `@delta/ui` extraction.

- Extract design tokens to `src/lib/ui/tokens.ts` (CSS custom properties)
- Apply Georgia headings across all page titles
- Ensure Delta orange (#FE5000) consistency (replace any scattered hex values)
- Micro-interactions: tab transitions, panel slides, hover states
- Responsive behavior (tablet breakpoint for collapsed rail)
- Accessibility: keyboard navigation for all shell components, ARIA labels

**Exit criteria:** Design tokens centralized. All shell components animate smoothly. Keyboard-navigable. Consistent branding.

---

## 10. Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Shell layout approach | Gut `(dashboard)/layout.tsx` — remove sidebar, header bar, NotificationBell, Breadcrumbs; keep AuthProvider, dark mode script, and `{children}` slot. New `DataOSShell` component provides Nova Bar (absorbs NotificationBell), Status Rail, Module Tabs, and Workspace. Existing pages render in the `{children}` slot inside Workspace. | Surgical removal of old nav elements; existing pages and API routes unchanged |
| State management for density | React Context (DensityProvider) | Lightweight, no external library, already used pattern in DI |
| Tab state persistence | localStorage | Consistent with existing DI patterns (chat history, preferences) |
| Session state tracking | localStorage with structured JSON | No backend changes needed; migrates to Event Store later |
| Chat panel positioning | Side-by-side (workspace shrinks) | No content overlap; user can reference module while chatting |
| Design tokens | CSS custom properties in a central file | Works with Tailwind, no build step, easily consumed by spokes |
| Density component library | src/components/density/ directory | Co-located, importable by any page |

---

## 11. File Structure

```
src/
├── components/
│   ├── shell/
│   │   ├── DataOSShell.tsx          # Main shell layout
│   │   ├── NovaBar.tsx              # Top bar
│   │   ├── StatusRail.tsx           # Left rail
│   │   ├── ModuleTabs.tsx           # Tab bar
│   │   ├── Workspace.tsx            # Content wrapper
│   │   ├── ChatPanel.tsx            # Slide-out chat
│   │   ├── NovaCommandPalette.tsx   # Enhanced command palette
│   │   ├── AlertPopover.tsx         # Nova Bar alert pill popover
│   │   ├── BotPopover.tsx           # Nova Bar bot pill popover
│   │   └── AutomationPopover.tsx    # Nova Bar automation pill popover
│   ├── density/
│   │   ├── DensityProvider.tsx      # Context provider + useDensity()
│   │   ├── DensityKPI.tsx           # KPI card / inline cell
│   │   ├── DensityTable.tsx         # Summary table / full table
│   │   ├── DensityChart.tsx         # Chart / sparkline
│   │   ├── DensityInsight.tsx       # Nova insight card / dot
│   │   └── DensitySection.tsx       # Section card / table header
│   ├── home/
│   │   ├── HomeGrid.tsx             # Module grid layout
│   │   ├── IntelligenceSummary.tsx  # Three-card banner
│   │   ├── ActivityTimeline.tsx     # Recent events strip
│   │   ├── ModuleTile.tsx           # Individual module tile
│   │   └── ModuleCustomizer.tsx     # Drag/reorder/pin modal
│   └── ... (existing components unchanged)
├── lib/
│   ├── ui/
│   │   └── tokens.ts               # Design tokens (CSS custom properties)
│   ├── shell/
│   │   ├── session-state.ts         # Session state read/write
│   │   ├── module-registry.ts       # Module group definitions
│   │   └── tab-manager.ts           # Tab state management
│   └── ... (existing lib unchanged)
└── app/
    ├── (dashboard)/
    │   ├── layout.tsx               # Modified: wraps content in DataOSShell
    │   └── ... (all existing routes unchanged)
    └── ...
```

---

## 12. Ethos-Informed Design Principles

Informed by the Ethos Digital Platform architecture (Project X / Triangle Development):

1. **Portal-as-identity.** The Home Grid is not a static launcher — it learns from usage. Modules reorder by frequency. The intelligence summary personalizes to the user's role, recent activity, and work patterns.

2. **Plugin discoverability.** The "Add Module" tile and module marketplace pattern ensures the architecture is extensible from day one. Third-party spokes (Phase 5) plug into the same grid.

3. **Cross-module intelligence is the product.** Nova's value is connecting dots across modules — linking AP invoices to Samsara deliveries to Salesforce opportunities. The intelligence summary highlights cross-module connections, not just per-module alerts.

4. **One identity, one shell.** Like Ethos's super-app vision, DI provides a single authenticated shell. All tools orbit the hub. Users never leave the OS to access a different tool.

5. **Staged rollout.** The phased approach (Shell → Chat → Density → Home Grid → Polish) mirrors Ethos's staged release strategy — each phase delivers standalone value.
