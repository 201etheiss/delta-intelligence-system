# DataOS UI/UX Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform DI from a sidebar-nav admin app into a Module Grid OS shell with persistent Nova AI, content-aware density modes, and an intelligent home screen.

**Architecture:** New `DataOSShell` component replaces the existing sidebar+header in `(dashboard)/layout.tsx`. Existing 62 pages render unchanged inside the shell's Workspace slot. Density modes via React Context; session state and tab persistence via localStorage. No backend changes.

**Tech Stack:** Next.js 14 / React / TypeScript / Tailwind CSS / Lucide icons / `@dnd-kit` (Phase E only)

**Spec:** `docs/superpowers/specs/2026-04-01-di-dataos-ui-ux-upgrade-design.md`

---

## File Structure

### New Files (Create)

```
src/components/shell/
├── DataOSShell.tsx          # Main shell layout (Nova Bar + Rail + Tabs + Workspace)
├── NovaBar.tsx              # Top bar: avatar, input, pills, density toggle, bell, user
├── StatusRail.tsx           # Left icon rail + health dots
├── ModuleTabs.tsx           # Browser-tab bar for open modules
├── Workspace.tsx            # Content wrapper (density class injection)
├── ChatPanel.tsx            # Slide-out chat panel (Chat/Bots/History modes)
├── NovaCommandPalette.tsx   # Enhanced command palette (replaces existing)
├── AlertPopover.tsx         # Nova Bar alert pill popover
├── BotPopover.tsx           # Nova Bar bot pill popover
├── AutomationPopover.tsx    # Nova Bar automation pill popover

src/components/density/
├── DensityProvider.tsx      # Context + useDensity() hook
├── DensityKPI.tsx           # KPI card (exec) / inline cell (oper)
├── DensityTable.tsx         # Summary table (exec) / full table (oper)
├── DensityChart.tsx         # Large chart (exec) / sparkline (oper)
├── DensityInsight.tsx       # Nova insight card (exec) / dot (oper)
├── DensitySection.tsx       # Section card (exec) / table header row (oper)

src/components/home/
├── HomeGrid.tsx             # Module grid layout with pinned/all sections
├── IntelligenceSummary.tsx  # Three-card banner (resume, changes, attention)
├── ActivityTimeline.tsx     # Recent events strip
├── ModuleTile.tsx           # Individual module tile
├── ModuleCustomizer.tsx     # Pin/reorder/hide modal

src/lib/shell/
├── module-registry.ts       # Module group definitions + icon mapping
├── tab-manager.ts           # Tab state CRUD (localStorage)
├── session-state.ts         # Session state read/write (localStorage)

src/lib/ui/
└── tokens.ts                # CSS custom properties (design tokens)
```

### Modified Files

```
src/app/(dashboard)/layout.tsx          # Gut sidebar/header, wrap in DataOSShell
src/components/common/SubNavTabs.tsx     # Add optional `group` prop
src/app/(dashboard)/page.tsx            # Replace dashboard with HomeGrid
src/app/(dashboard)/financial-statements/page.tsx  # Add density dual rendering
src/app/(dashboard)/ap/invoices/page.tsx            # Add density dual rendering
src/app/(dashboard)/fleet/page.tsx                  # Add density dual rendering
src/app/(dashboard)/cockpit/page.tsx                # Add density dual rendering
src/app/globals.css                     # Add design token CSS custom properties
```

---

## Task 1: Design Tokens

**Files:**
- Create: `src/lib/ui/tokens.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create token file**

Create `src/lib/ui/tokens.ts` that exports a function to inject CSS custom properties onto `:root`. Tokens for colors, typography, spacing, and component dimensions. Include both executive and operator spacing variants.

```typescript
// Key tokens from spec §6:
// --delta-orange: #FE5000
// --bg-primary: #0a0a0a
// --bg-surface: #18181b
// --font-heading: Georgia, serif
// --font-mono: 'SF Mono', 'Fira Code', monospace
// Executive spacing multiplier: 1.5x
// Operator spacing multiplier: 0.75x
```

- [ ] **Step 2: Add CSS custom properties to globals.css**

Add `:root` block with all color/typography tokens. Add `.density-executive` and `.density-operator` classes with spacing overrides.

- [ ] **Step 3: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/ui/tokens.ts src/app/globals.css
git commit -m "feat: add @delta/ui design token system (CSS custom properties)"
```

---

## Task 2: Module Registry

**Files:**
- Create: `src/lib/shell/module-registry.ts`

- [ ] **Step 1: Create module registry**

Define the 7 module groups with: id, label, icon name (Lucide), default page path, and all child page paths. This is the single source of truth for navigation — replaces the hardcoded `NAV_GROUPS` array in layout.tsx.

```typescript
// Module groups from spec §7.1:
// finance: 15 pages (/, /financial-statements, /journal-entries, ...)
// operations: 5 pages (/fleet-map, /fleet, ...)
// intelligence: 10 pages (/executive, /market, /sales, /digest, ...)
// organization: 4 pages (/people, /hr, ...)
// compliance: 4 pages (/vault, /audit, ...)
// admin: 8 pages (/admin/users, /admin/permissions, ...)
// platform: 10 pages (/platform, /dashboards, /shared, /history, ...)
```

Include a `findModuleForPath(pathname: string)` function that returns the module group for any given route.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shell/module-registry.ts
git commit -m "feat: add module registry (7 groups, 56 routes)"
```

---

## Task 3: Tab Manager

**Files:**
- Create: `src/lib/shell/tab-manager.ts`

- [ ] **Step 1: Create tab manager**

State management for open module tabs. Stored in localStorage under `di_open_tabs`. Interface:

```typescript
interface TabState {
  id: string;           // module group id
  label: string;        // display name
  icon: string;         // Lucide icon name
  activePath: string;   // current page within the module
  openedAt: number;     // timestamp for ordering
}

// Functions:
// getTabs(): TabState[]
// openTab(moduleId: string, path?: string): TabState[]
// closeTab(moduleId: string): TabState[]
// setActiveTab(moduleId: string): TabState[]
// updateTabPath(moduleId: string, path: string): TabState[]
// reorderTabs(fromIndex: number, toIndex: number): TabState[]
// MAX_TABS = 8
```

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shell/tab-manager.ts
git commit -m "feat: add tab state manager (localStorage, max 8 tabs)"
```

---

## Task 4: Session State Manager

**Files:**
- Create: `src/lib/shell/session-state.ts`

- [ ] **Step 1: Create session state manager**

Tracks where the user left off. Stored in localStorage under `di_session_state`.

```typescript
interface SessionState {
  lastModule: string;
  lastPage: string;
  lastPageContext: string;
  scrollPosition: number;
  activeFilters: Record<string, string>;
  timestamp: string;
  openTabs: TabState[];      // from tab-manager.ts — persists open tabs across refresh
  densityMode: "executive" | "operator";
  pinnedModules: string[];
  moduleOrder: string[];
}

// Functions:
// getSessionState(): SessionState | null
// saveSessionState(state: Partial<SessionState>): void
// getGatewaySnapshot(): GatewaySnapshot | null
// saveGatewaySnapshot(snapshot: GatewaySnapshot): void
// getModuleUsage(): Record<string, { openCount: number; lastOpened: string }>
// recordModuleOpen(moduleId: string): void
```

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shell/session-state.ts
git commit -m "feat: add session state manager (resume, snapshot, usage tracking)"
```

---

## Task 5: DensityProvider

**Files:**
- Create: `src/components/density/DensityProvider.tsx`

- [ ] **Step 1: Create DensityProvider context**

React Context that provides `useDensity()` hook returning `"executive" | "operator"`. Reads default from user role (spec §4.1 role mapping table), user override from localStorage `di_density_mode`. Injects `.density-executive` or `.density-operator` class on the Workspace wrapper.

```typescript
// Role → density defaults (from spec):
// admin → executive, accounting → operator, sales → executive
// operations → operator, hr → executive, readonly → executive
//
// IMPORTANT: Read role from useSession() (next-auth), NOT from getUserRole()
// in src/lib/config/roles.ts (that's server-side only, uses fs.readFileSync).
// The session token already contains the user's role: session?.user?.role
```

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/density/DensityProvider.tsx
git commit -m "feat: add DensityProvider context (role-based defaults, localStorage override)"
```

---

## Task 6: StatusRail Component

**Files:**
- Create: `src/components/shell/StatusRail.tsx`

- [ ] **Step 1: Create StatusRail**

Vertical icon bar (48px wide). Module group icons from module-registry.ts. Divider. Chat toggle icon. Search icon. Bottom section: health dots polling `GET /api/admin/health` every 60 seconds. Active module highlighted with orange left border. Chat icon glows when panel is open.

Props: `activeModule: string | null`, `chatOpen: boolean`, `onModuleClick: (id: string) => void`, `onChatToggle: () => void`, `onSearchClick: () => void`.

Uses Lucide icons — one per module group plus utilities:
- Home: `LayoutDashboard`
- Finance: `DollarSign`
- Operations: `Truck`
- Intelligence: `BarChart3`
- Organization: `Users`
- Compliance: `Shield`
- Admin: `Settings`
- Platform: `Layers`
- (divider)
- Chat: `MessageSquare`
- Search: `Search`

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/StatusRail.tsx
git commit -m "feat: add StatusRail component (module icons, health dots, chat toggle)"
```

---

## Task 7: NovaBar Component

**Files:**
- Create: `src/components/shell/NovaBar.tsx`
- Create: `src/components/shell/AlertPopover.tsx`
- Create: `src/components/shell/BotPopover.tsx`
- Create: `src/components/shell/AutomationPopover.tsx`

- [ ] **Step 1: Create NovaBar**

Top bar component. Contains: Nova avatar ("N" in orange gradient circle), Nova input field (shows current module context), three alert/bot/automation pills, density toggle (EX/OP), notification bell (extract existing `NotificationBell` logic from layout.tsx lines 280-397), user avatar (initials).

Props: `currentModule: string | null`, `currentPage: string`, `densityMode: string`, `onDensityToggle: () => void`, `onNovaClick: () => void`.

Background: `linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)` with `border-bottom: 1px solid #FE5000`.

**NotificationBell extraction:** First read `src/app/(dashboard)/layout.tsx` lines 280-397 to understand the existing implementation. Extract the `NotificationBell` function component into NovaBar. It uses `useState`, `useCallback`, `useEffect` from React and `fetch('/api/notifications')`. Carry over the mark-read handler, unread count state, and dropdown rendering. Do not leave a duplicate in layout.tsx — it will be removed in Task 10.

- [ ] **Step 2: Create pill popovers**

Three small popover components (AlertPopover, BotPopover, AutomationPopover). Each shows a list of items with links. AlertPopover reads from alerts engine. BotPopover reads from automations data. AutomationPopover reads from automation executor logs. Keep simple — just a dropdown list with item name, status badge, and link.

- [ ] **Step 3: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/NovaBar.tsx src/components/shell/AlertPopover.tsx src/components/shell/BotPopover.tsx src/components/shell/AutomationPopover.tsx
git commit -m "feat: add NovaBar with alert/bot/automation popovers"
```

---

## Task 8: ModuleTabs Component

**Files:**
- Create: `src/components/shell/ModuleTabs.tsx`

- [ ] **Step 1: Create ModuleTabs**

Horizontal tab bar below NovaBar. Renders open tabs from tab-manager.ts state. Active tab has orange bottom border. Each tab: icon + label + close button. "+" button at end (disabled at 8 tabs). Click tab → sets active. Close button → removes tab.

Props: `tabs: TabState[]`, `activeTabId: string | null`, `onTabClick: (id: string) => void`, `onTabClose: (id: string) => void`, `onNewTab: () => void`.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/ModuleTabs.tsx
git commit -m "feat: add ModuleTabs component (open/close/switch, max 8)"
```

---

## Task 9: Workspace Component

**Files:**
- Create: `src/components/shell/Workspace.tsx`

- [ ] **Step 1: Create Workspace**

Simple wrapper that fills remaining space. Injects density class from DensityProvider. Children (page content) render inside. When chat panel is open, applies `flex` layout to split space.

Props: `chatOpen: boolean`, `children: React.ReactNode`.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/Workspace.tsx
git commit -m "feat: add Workspace wrapper (density class, chat panel split)"
```

---

## Task 10: DataOSShell + Layout Migration

**Files:**
- Create: `src/components/shell/DataOSShell.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/common/SubNavTabs.tsx`

This is the critical integration task. The shell assembles all components and replaces the existing layout.

- [ ] **Step 1: Read layout.tsx thoroughly**

Read `src/app/(dashboard)/layout.tsx` (942 lines). Document what to keep vs remove:

**Remove:** Sidebar `<aside>` (~lines 713-890), header bar, `NAV_GROUPS` array, `EXTRA_ITEMS` array, `sidebarCollapsed` state, `openGroups` state, favorites nav rendering, `NotificationBell` inline component (moved to NovaBar in Task 7), Cmd+K → `/chat` handler, Cmd+N → new chat handler, `allItemsMap` favorites lookup.

**Keep and move to DataOSShell:** `toggleDarkMode` handler, `Cmd+/` shortcut (dark mode toggle), `showShortcuts` modal and `?` key handler.

**Keep in layout.tsx:** `AuthProvider` wrapper, dark mode `<script>` in `<head>`, white label config fetch, `{children}` slot.

**Retire:** `showShortcuts` modal (replaced by Nova command palette's help section). `EXTRA_ITEMS` merged into module-registry in Task 2.

- [ ] **Step 2: Create DataOSShell**

Composes: DensityProvider → NovaBar → (StatusRail + ModuleTabs + Workspace). ChatPanel is NOT wired yet (Phase B, Task 11). Manages state: active module, open tabs, density mode. Handles keyboard shortcuts: Cmd+P → palette only. **Cmd+K is left unbound** (reassigned in Task 11 to chat toggle). Carries over `toggleDarkMode` and `Cmd+/` from layout.tsx. Uses module-registry to determine active module from pathname. Records session state on navigation.

- [ ] **Step 2: Add `group` prop to SubNavTabs**

Modify `src/components/common/SubNavTabs.tsx` to accept an optional `group?: string` prop. When provided, filter `TAB_GROUPS` to only show that group instead of auto-detecting from pathname. Preserve existing behavior when prop is omitted.

- [ ] **Step 3: Gut layout.tsx**

Remove from `(dashboard)/layout.tsx`:
- Sidebar (`<aside>` element, lines ~713-890)
- Header bar (mobile menu, breadcrumbs header)
- NotificationBell inline implementation (moved to NovaBar)
- Keyboard shortcut handler for Cmd+K → /chat (replaced by shell)
- `NAV_GROUPS` and `EXTRA_ITEMS` arrays (replaced by module-registry)
- Collapsed state management (`sidebarCollapsed`, `openGroups`)
- Favorites nav rendering

Keep:
- `AuthProvider` wrapper
- Dark mode theme script
- White label config fetch
- `{children}` slot

Wrap `{children}` in `<DataOSShell>{children}</DataOSShell>`.

- [ ] **Step 4: Verify all pages render**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`
Then: `cd ~/delta360/intelligence && npx next dev -p 3004`
Navigate to: `/`, `/financial-statements`, `/ap/invoices`, `/fleet`, `/admin/users`, `/chat`
Verify: All pages render inside the shell. Rail navigation works. Tabs open/close. No sidebar visible.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/DataOSShell.tsx src/app/\(dashboard\)/layout.tsx src/components/common/SubNavTabs.tsx
git commit -m "feat: replace sidebar layout with DataOS shell (Nova Bar, Rail, Tabs, Workspace)"
```

---

## Task 11: ChatPanel Component

**Files:**
- Create: `src/components/shell/ChatPanel.tsx`

- [ ] **Step 1: Create ChatPanel**

380px wide slide-out panel. Three modes via tab pills: Chat, Bots, History.

**Chat mode:** Reuses existing chat logic from `src/components/chat/` — import the streaming message handler and rendering. Add module context chips that auto-populate from current page. Nova's system prompt gets module context injection.

**Bots mode:** List of automations from `src/lib/automations.ts` (getAutomations) and `src/lib/default-automations.ts`. Each shows name, cron schedule, last run status. "Run Now" button triggers automation executor.

**History mode:** Recent conversations from localStorage (same source as existing `/history` page).

Props: `isOpen: boolean`, `currentModule: string`, `currentPage: string`, `onClose: () => void`.

- [ ] **Step 2: Wire into DataOSShell**

Connect ChatPanel to the shell's `chatOpen` state. Toggle via Rail icon and Cmd+K. Pass current module/page for context awareness.

- [ ] **Step 3: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/ChatPanel.tsx
git commit -m "feat: add persistent ChatPanel (chat/bots/history, context-aware)"
```

---

## Task 12: NovaCommandPalette

**Files:**
- Create: `src/components/shell/NovaCommandPalette.tsx`

- [ ] **Step 1: Create enhanced command palette**

Full-screen overlay triggered by Cmd+P or Nova avatar click. Search field at top. Sections: Recent Queries, Modules (searchable), Quick Actions, Bots. Uses module-registry for module search. Replaces existing `CommandPalette` component import in DataOSShell.

- [ ] **Step 2: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/NovaCommandPalette.tsx
git commit -m "feat: add Nova command palette (module search, recent queries, quick actions)"
```

---

## Task 13: Density Components

**Files:**
- Create: `src/components/density/DensityKPI.tsx`
- Create: `src/components/density/DensityTable.tsx`
- Create: `src/components/density/DensityChart.tsx`
- Create: `src/components/density/DensityInsight.tsx`

- [ ] **Step 1: Create DensityKPI**

Renders large card with value + trend delta in executive mode. Renders compact inline cell (monospace value, colored delta) in operator mode. Props: `label`, `value`, `delta`, `deltaDirection`.

- [ ] **Step 2: Create DensityTable**

Executive: renders summary rows with optional sparkline column. Operator: renders full table with all columns, sticky headers, monospace numbers, section headers. Props: `columns`, `data`, `summaryColumns` (exec-only subset), `sectionGroupBy`.

- [ ] **Step 3: Create DensityChart**

Executive: renders full-size chart with annotations. Operator: renders compact sparkline. Props: `type` (bar/line/area), `data`, `height`.

- [ ] **Step 4: Create DensityInsight**

Executive: renders orange-tinted card with Nova icon and insight text. Operator: renders small orange dot indicator (expandable on hover). Props: `text`, `actionLabel`, `onAction`.

- [ ] **Step 5: Create DensitySection**

Create `src/components/density/DensitySection.tsx`. Executive: renders card with heading and padded content area. Operator: renders table section header row (bold, background-colored, full-width). Props: `title`, `children`. This is used for ledger section headers in Financial Statements operator mode.

- [ ] **Step 6: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add src/components/density/
git commit -m "feat: add density-aware components (KPI, Table, Chart, Insight, Section)"
```

---

## Task 14: Move Dashboard to Finance Default + Add Density

**Files:**
- Create: `src/app/(dashboard)/finance/page.tsx` (new route for existing dashboard content)
- Modify: `src/lib/shell/module-registry.ts` (update Finance default page to `/finance`)

**Important:** The current `page.tsx` at `/` will be replaced by HomeGrid in Task 17. The existing dashboard content (financial KPIs, recent chats, connected tools) needs a new home as the Finance module's default landing page.

- [ ] **Step 1: Read existing dashboard page**

Read `src/app/(dashboard)/page.tsx` to understand its data fetching and rendering.

- [ ] **Step 2: Copy dashboard content to `/finance` route**

Create `src/app/(dashboard)/finance/page.tsx` with the existing dashboard content. Update Finance module's `defaultPagePath` in module-registry.ts from `/` to `/finance`.

- [ ] **Step 3: Add dual density rendering to the Finance page**

Wrap the content in density-aware layout:
- **Executive:** DensityKPI cards for key metrics (revenue, margin, AR aging, fleet status), DensityChart for trends, DensityInsight for Nova observations.
- **Operator:** Dense KPI strip, full data tables, inline controls.

Use `useDensity()` hook to branch rendering. Keep all existing data fetching unchanged.

- [ ] **Step 4: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/finance/ src/lib/shell/module-registry.ts
git commit -m "feat: move dashboard to /finance route with density-aware rendering"
```

---

## Task 15: Tier 1 Page — Financial Statements

**Files:**
- Modify: `src/app/(dashboard)/financial-statements/page.tsx`

- [ ] **Step 1: Read existing page**

Understand current rendering (6 tabs: BS/IS/TB/CFS/Flash/Variance + YoY).

- [ ] **Step 2: Add dual density rendering**

- **Executive:** 4 DensityKPI cards (Total Assets, Total Liabilities, Net Equity, Current Ratio), asset composition DensityChart, DensityInsight for anomalies.
- **Operator:** Full ledger DensityTable with account codes, balance/prior/variance columns, section headers, inline YoY/MoM/Export controls.

- [ ] **Step 3: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/financial-statements/page.tsx
git commit -m "feat: add density-aware Financial Statements (exec KPIs, oper ledger)"
```

---

## Task 16: Tier 1 Pages — AP Console, Fleet Ops, Cockpit

**Files:**
- Modify: `src/app/(dashboard)/ap/invoices/page.tsx`
- Modify: `src/app/(dashboard)/fleet/page.tsx`
- Modify: `src/app/(dashboard)/cockpit/page.tsx`

- [ ] **Step 1: Read all three pages**

- [ ] **Step 2: Add density rendering to AP Console**

Executive: aging chart + top vendor cards + DensityInsight. Operator: full invoice queue table with aging buckets.

- [ ] **Step 3: Add density rendering to Fleet Ops**

Executive: map + 4 KPI cards + delivery status. Operator: dispatch table with vehicle/driver/route/status columns.

- [ ] **Step 4: Add density rendering to Cockpit**

Executive: alert cards + status rings + KPIs. Operator: detail panels with all metrics and drill-downs.

- [ ] **Step 5: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/ap/ src/app/\(dashboard\)/fleet/page.tsx src/app/\(dashboard\)/cockpit/page.tsx
git commit -m "feat: add density-aware rendering to AP Console, Fleet Ops, Cockpit"
```

---

## Task 17: Home Grid Components

**Files:**
- Create: `src/components/home/HomeGrid.tsx`
- Create: `src/components/home/IntelligenceSummary.tsx`
- Create: `src/components/home/ActivityTimeline.tsx`
- Create: `src/components/home/ModuleTile.tsx`
- Create: `src/components/home/ModuleCustomizer.tsx`

- [ ] **Step 1: Create ModuleTile**

Single module tile. Props: `module` (from registry), `isPinned`, `alertCount`, `stats`, `onPin`, `onClick`. Shows icon, name, description, status badge, stats line, notification count.

- [ ] **Step 2: Create IntelligenceSummary**

Three-card banner. Reads session state for "Resume" card. Reads gateway snapshot diff for "What Changed" card (compares `di_gateway_snapshot` with fresh counts from `/api/admin/health` and Ascend query endpoints). Reads alerts engine for "Needs Attention" card. Each card is a clickable link.

- [ ] **Step 3: Create ActivityTimeline**

Horizontal strip of recent events. Sources from automation logs and alerts. Each event: colored dot + description + relative timestamp.

- [ ] **Step 4: Create HomeGrid**

Assembles: IntelligenceSummary + Grid/List toggle + Pinned section + All Modules section. Reads pinned/order from session state. Sorts "All Modules" by usage frequency (`di_module_usage`).

- [ ] **Step 5: Create ModuleCustomizer**

Modal for drag-to-reorder, pin/unpin, show/hide modules. Simple list with toggle switches. Saves to session state. (Drag-to-reorder deferred to Phase E — for now, up/down arrow buttons.)

- [ ] **Step 6: Wire HomeGrid into dashboard page**

Replace the current dashboard (`src/app/(dashboard)/page.tsx`) with HomeGrid as the default view. The existing dashboard content becomes the Finance module's default page (accessible via the Finance tile or Rail icon).

**Important:** The current `/` dashboard content was already moved to `/finance` in Task 14. This task replaces `/` with HomeGrid.

**Persistence note:** HomeGrid's personalization (pins, order, hidden modules) uses localStorage via `session-state.ts` — NOT `src/lib/user-preferences.ts` (which is server-side filesystem). All client-side reads go through `getSessionState()` and `getModuleUsage()`.

- [ ] **Step 7: Verify build**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/components/home/ src/app/\(dashboard\)/page.tsx
git commit -m "feat: add intelligent Home Grid (intelligence summary, module tiles, personalization)"
```

---

## Task 18: Design Polish & Brand Correction

**Files:**
- Modify: `src/app/globals.css`
- Modify: Multiple files (find-and-replace)

- [ ] **Step 1: Color correction**

Find all instances of `#FF5C00` and `#E54800` across the codebase and replace with `#FE5000` and `#CC4000` (hover variant). Use grep to find all files.

Run: `cd ~/delta360/intelligence && grep -r "FF5C00\|E54800" src/ --include="*.tsx" --include="*.ts" --include="*.css" -l`

- [ ] **Step 2: Apply Georgia headings**

Add `font-family: var(--font-heading)` to all page title elements. These should use the Georgia serif font per Delta360 institutional branding.

- [ ] **Step 3: Verify no regressions**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: correct brand color to #FE5000, apply Georgia headings"
```

---

## Task 19: Final Integration Verification

- [ ] **Step 1: Full type check**

Run: `cd ~/delta360/intelligence && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Visual verification**

Start dev server: `cd ~/delta360/intelligence && npx next dev -p 3004`

Verify each shell component:
1. Nova Bar renders with input, pills, density toggle, bell, avatar
2. Status Rail shows 7 module icons + health dots
3. Module Tabs open/close/switch correctly
4. Chat panel slides out from Rail icon
5. Home Grid shows intelligence summary + module tiles
6. Density toggle switches between Executive/Operator on Tier 1 pages
7. All 62 pages accessible via Rail → SubNavTabs navigation
8. Cmd+P opens command palette
9. Cmd+K toggles chat panel
10. Session state persists across refresh

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "feat: DataOS UI/UX upgrade complete (shell, density, home grid, chat panel)"
```

---

## Execution Order & Dependencies

```
Task 1 (Tokens) ─────────────────────────────────┐
Task 2 (Module Registry) ────────────────────────┤
Task 3 (Tab Manager) ───────────────────────────┤
Task 4 (Session State) ─────────────────────────┤
                                                  ├─► Task 10 (DataOSShell + Layout Migration)
Task 5 (DensityProvider) ───────────────────────┤         │
Task 6 (StatusRail) ────────────────────────────┤         │
Task 7 (NovaBar) ──────────────────────────────┤         │
Task 8 (ModuleTabs) ───────────────────────────┤         │
Task 9 (Workspace) ────────────────────────────┘         │
                                                           │
Task 11 (ChatPanel) ◄─────────────────────────────────────┤
Task 12 (NovaCommandPalette) ◄────────────────────────────┤
                                                           │
Task 13 (Density Components) ◄────────────────── Task 5   │
Task 14 (Dashboard Density) ◄──────────── Task 13         │
Task 15 (Financial Statements Density) ◄── Task 13        │
Task 16 (AP/Fleet/Cockpit Density) ◄────── Task 13        │
                                                           │
Task 17 (Home Grid) ◄─────────────── Task 4 + Task 10     │
Task 18 (Polish) ◄────────────────── all above             │
Task 19 (Verification) ◄──────────── all above             │
```

**Parallelizable groups:**
- Tasks 1-9 can build in parallel with one constraint: Tasks 6 (StatusRail) and 7 (NovaBar) import types from Task 2 (Module Registry), so their `tsc --noEmit` verification must run after Task 2 commits. Implementation code can proceed in parallel.
- Task 10 depends on Tasks 1-9 (integration point)
- Tasks 11-12 depend on Task 10
- Tasks 13-16 depend on Task 5 (DensityProvider) + Task 10
- Task 17 depends on Tasks 4 + 10
- Tasks 18-19 are sequential finalization
