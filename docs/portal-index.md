# Delta Portal — Project Index

**Source**: `/Users/evantheiss/Projects/delta-portal`
**Type**: Turborepo monorepo — Next.js 14 (App Router), TypeScript strict, Tailwind CSS
**Status**: Active development. All portal and admin pages exist with full UI. Live data via DI gateway (:3847) with mock fallback. Backend integrations (Stripe, Samsara, DocuSign, Supabase) scaffolded but not wired.

---

## 1. Route Inventory

### Portal Routes (`apps/web/src/app/(portal)/`) — 20 routes

| Route | File | Status | Notes |
|---|---|---|---|
| /dashboard | dashboard/page.tsx | Built | Stat cards derived from mock data; quick actions, recent orders, insights preview |
| /products | products/page.tsx | Built | Searchable/filterable catalog, category filter, 12-per-page pagination |
| /products/[sku] | products/[sku]/page.tsx | Built | Product detail with specs, SDS, add to cart |
| /cart | cart/page.tsx | Built | Cart items, summary, proceeds to checkout |
| /checkout | checkout/page.tsx | Built | Cart summary, tax breakdown, payment method selector (Stripe not wired) |
| /orders | orders/page.tsx | Built | Tab filters (all/active/completed/cancelled/recurring), order cards |
| /orders/[id] | orders/[id]/page.tsx | Built | Order detail, timeline, line items |
| /orders/create | orders/create/page.tsx | Built | New order form |
| /orders/recurring | orders/recurring/page.tsx | Built | Recurring/standing order management |
| /invoices | invoices/page.tsx | Built | Aging summary row, tab filters (all/unpaid/paid/overdue) |
| /invoices/[id] | invoices/[id]/page.tsx | Built | Invoice detail, line items, download |
| /invoices/[id]/pay | invoices/[id]/pay/page.tsx | Built | Payment flow page |
| /tracking | tracking/page.tsx | Built | Active + past deliveries, mock map; Samsara not wired |
| /tracking/[id] | tracking/[id]/page.tsx | Built | Delivery detail with map |
| /tracking/assets | tracking/assets/page.tsx | Built | Asset list |
| /tracking/assets/[id] | tracking/assets/[id]/page.tsx | Built | Asset detail with telemetry readout, service timeline |
| /tracking/tanks | tracking/tanks/page.tsx | Built | Tank level gauges |
| /insights | insights/page.tsx | Built | Price charts (Recharts), spend pie/bar charts, budget cards, recommendations, alerts |
| /insights/prices | insights/prices/page.tsx | Built | Commodity price dashboard |
| /insights/analytics | insights/analytics/page.tsx | Built | Usage analytics charts |
| /leasing | leasing/page.tsx | In Progress | Tank catalog cards, feature list; no lease-create flow yet |
| /leasing/configure/[sku] | leasing/configure/[sku]/page.tsx | In Progress | Lease configurator: term selector, accessory selector, calculator |
| /account | account/page.tsx | Built | Account profile |
| /account/kyc | account/kyc/page.tsx | Built | Multi-step KYC onboarding form |
| /account/contracts | account/contracts/page.tsx | Built | Contract list with status badges |
| /account/contracts/[id] | account/contracts/[id]/page.tsx | Built | Contract detail with signature timeline |
| /quotes | quotes/page.tsx | Built | Quote builder: customer search, line items, summary |
| /quotes/[id] | quotes/[id]/page.tsx | Built | Quote detail |
| /notifications | notifications/page.tsx | In Progress | Notification card list; no push subscription wired |
| /settings | settings/page.tsx | Built | Account settings |
| /help | help/page.tsx | Built | FAQ accordion, contact form |

### Admin Routes (`apps/web/src/app/(admin)/`) — 9 routes

| Route | File | Status | Notes |
|---|---|---|---|
| /admin | (admin)/page.tsx | Built | Redirect to /admin/dashboard |
| /admin/dashboard | dashboard/page.tsx | Built | Revenue, orders, customers, invoices KPIs; uses MOCK_ADMIN_* + DataSourceBadge |
| /admin/customers | customers/page.tsx | Built | Customer list |
| /admin/customers/[id] | customers/[id]/page.tsx | Built | Customer detail |
| /admin/orders | orders/page.tsx | Built | All orders list |
| /admin/invoices | invoices/page.tsx | Built | Invoice list, aging |
| /admin/pricing | pricing/page.tsx | Built | Pricing management |
| /admin/products | products/page.tsx | Built | Product CRUD |
| /admin/reports | reports/page.tsx | Built | Revenue/operational reports |

### Auth Routes (`apps/web/src/app/(auth)/`) — not listed above, present in project

### API Routes (`apps/web/src/app/api/`) — 32 routes

#### Portal API (mock/Supabase-backed)
| Route | Method | Notes |
|---|---|---|
| /api/assets | GET | Asset list |
| /api/assets/[id] | GET | Asset detail |
| /api/auth/callback | GET/POST | Supabase auth callback |
| /api/auth/register | POST | User registration |
| /api/health | GET | Health check |
| /api/invoices | GET | Invoice list |
| /api/invoices/[id] | GET | Invoice detail |
| /api/orders | POST | Create order |
| /api/payments | POST | Payment submission |
| /api/products | GET | Product catalog |
| /api/products/[sku] | GET | Product detail |
| /api/tracking | GET | Delivery list |
| /api/tracking/[id] | GET | Delivery detail |
| /api/tracking/tanks | GET | Tank levels |

#### Live Gateway Routes (hit DI gateway at :3847 with mock fallback)
| Route | Gateway Service | Notes |
|---|---|---|
| /api/live/revenue | Ascend SQL | Revenue data |
| /api/live/revenue/by-customer | Ascend SQL | Revenue breakdown |
| /api/live/customers | Salesforce | Customer list |
| /api/live/customers/top | Salesforce | Top customers by spend |
| /api/live/invoices | Ascend SQL | Invoice data |
| /api/live/ar/aging | Ascend SQL | AR aging buckets |
| /api/live/financial/income-statement | Ascend SQL | P&L |
| /api/live/equipment | Samsara | Equipment/asset list |
| /api/live/sites | Ascend/Samsara | Delivery sites |
| /api/live/tanks | Samsara | Tank sensor data |
| /api/live/tanks/assignments | Ascend SQL | Tank-to-customer assignments |
| /api/live/taxes | Ascend SQL | Tax data |
| /api/live/pricing/rack | Ascend SQL | Rack fuel pricing (OPIS fallback) |
| /api/live/pricing/quote | Ascend SQL | Quote pricing with excise tax calc |
| /api/live/crm/accounts | Salesforce | SF account list |
| /api/live/crm/contacts | Salesforce | SF contact list |
| /api/live/crm/leads | Salesforce | SF lead list |
| /api/live/crm/opportunities | Salesforce | SF opportunities with Zod validation |

---

## 2. Component Inventory

58 components across 20 domain directories under `apps/web/src/components/`:

| Directory | Components |
|---|---|
| admin | data-source-badge.tsx |
| assets | asset-card.tsx, asset-map.tsx, asset-type-icon.tsx, service-timeline.tsx, telemetry-readout.tsx |
| auth | forgot-password-form.tsx, login-form.tsx, register-form.tsx |
| brand | logo.tsx |
| cart | cart-item.tsx, cart-summary.tsx |
| common | skeleton.tsx |
| contracts | contract-card.tsx, signature-timeline.tsx |
| dashboard | insights-preview.tsx, quick-actions.tsx, quick-order.tsx, recent-orders.tsx, stat-card.tsx |
| help | contact-form.tsx, faq-accordion.tsx |
| insights | alert-card.tsx, budget-card.tsx, price-chart.tsx, recommendation-card.tsx, sparkline.tsx, spend-bar-chart.tsx, spend-pie-chart.tsx |
| invoices | invoice-card.tsx, invoice-status-badge.tsx, tax-breakdown.tsx |
| layout | header.tsx, nav-tabs.tsx, providers.tsx, search-modal.tsx |
| leasing | accessory-selector.tsx, config-summary.tsx, lease-calculator.tsx, tank-card.tsx |
| notifications | notification-card.tsx |
| orders | order-card.tsx, order-timeline.tsx, status-badge.tsx |
| payments | ach-form.tsx, card-form.tsx, payment-method-selector.tsx |
| products | category-filter.tsx, product-card.tsx, quantity-selector.tsx |
| quotes | customer-search.tsx, quote-line-item.tsx, quote-summary.tsx |
| tracking | delivery-card.tsx, delivery-timeline.tsx, driver-card.tsx, mock-map.tsx, tank-gauge.tsx |

---

## 3. Shared Packages (`packages/`)

### packages/shared
Types, constants, utils, validators shared across web and mobile.

**Types** (`src/types/`):
- `api.ts` — ApiResponse envelope: `{ success, data?, error?, meta? }`
- `auth.ts` — User, Organization, Role types
- `orders.ts` — Order, OrderItem, CartItem, OrderStatus enum
- `products.ts` — Product, Category types
- `users.ts` — User profile types
- `integrations.ts` — Samsara, DocuSign, Avalara integration types

**Constants** (`src/constants/`):
- `status.ts` — OrderStatus, KYCStatus, PaymentStatus enums
- `products.ts` — Product category codes, unit of measure options
- `roles.ts` — Role definitions: owner, admin, orderer, viewer

**Utils** (`src/utils/`):
- `format.ts` — formatCurrency (cents to dollars), formatDate
- `dates.ts` — UTC↔user timezone conversion via date-fns-tz
- `index.ts` — Re-exports

**Validators** (`src/validators/`) — Zod schemas:
- `auth.ts` — signup/login/reset schemas
- `orders.ts` — createOrder, updateOrder schemas
- `products.ts` — product search/filter schemas

### packages/ui
Shared shadcn/ui component library: Button, Input, Card, Badge + `cn` utility.

### packages/db
Supabase migrations and schema.

**Migrations**:
1. `001_init.sql` — Base tables
2. `002_organizations.sql` — Multi-tenant organization structure
3. `003_users.sql` — Users with role junction table
4. `004_kyc.sql` — kyc_applications with phase_data JSON
5. `005_categories.sql` — Product category tree
6. `006_products.sql` — Products with specs_json
7. `007_rls_policies.sql` — Row Level Security for all tables
8. `008_audit_log.sql` — Audit trail trigger

**Seeds**: categories.sql (6 top-level categories), products seed scaffolded

---

## 4. Data Model Summary (from `src/lib/mock-data.ts`)

### Categories (6)
fuel, lubricants, greases, tanks, equipment, supplies

### Products
Mock catalog with ~20+ SKUs including:
- **Fuel**: ULSD #2, Unleaded 87, Biodiesel B20, DEF, Commercial Propane
- **Lubricants**: Motor oil grades, hydraulic fluid, transmission fluid
- **Tanks**: Above-ground (250/500/1000 gal), portable tanks
- **Equipment**: Pumps, hose assemblies
- **Supplies**: Spill kits, PPE

All prices stored as `base_price_cents` integers. Unit of measure: gallon, drum, tote, unit.

### Orders
Mock orders with statuses across the full pipeline: created → confirmed → dispatched → in_transit → delivered → completed. Includes recurring order flag.

### Invoices
Mock invoices with aging distribution: current, 30d, 60d, 90d+. Statuses: draft, sent, viewed, partially_paid, paid, overdue.

### Tracking
Mock tracking sessions linked to orders with driver/vehicle data and delivery windows.

### Tank Levels
Mock IoT tank sensor readings with current_level_percent and threshold_percent.

### Admin Data
Separate mock sets: MOCK_ADMIN_REVENUE, MOCK_ADMIN_CUSTOMERS, MOCK_ADMIN_ORDERS, MOCK_ADMIN_INVOICES for admin panel.

---

## 5. Integration Points

### Live: DI Gateway (:3847)
All 18 `/api/live/*` routes call `gatewayFetch()` from `@/lib/gateway`. Every route has a `MOCK_FALLBACK` constant so it degrades gracefully when gateway is unreachable.

Services hit:
- **Ascend SQL** — revenue, invoices, AR aging, income statement, pricing, tanks, sites, taxes
- **Salesforce** — customers, CRM accounts/contacts/leads/opportunities
- **Samsara** — equipment, tank sensor assignments

### Scaffolded (not wired)
- **Supabase Auth** — auth routes exist (`/api/auth/callback`, `/api/auth/register`); no Supabase client env vars connected in portal `.env`
- **Stripe** — payment components built (ACH form, card form); no `/api/payments` Stripe calls
- **Samsara real-time tracking** — mock-map.tsx used instead of live GPS; `/api/tracking/*` routes return mock data
- **DocuSign** — contract UI built (contract cards, signature timeline); no envelope creation endpoint
- **Avalara** — tax-breakdown.tsx component built; no AvaTax API call in checkout

---

## 6. What's Built vs. Placeholder

### Fully Built (real UI, real routing, real component logic)
- All 31 portal + admin pages render with data
- 58 components with props and domain logic
- Full mock data system (`src/lib/mock-data.ts`) with consistent cross-page data
- Cart store (Zustand) with add/remove/quantity logic
- Auth store (Zustand) for user session
- Live gateway routes for admin metrics (revenue, customers, AR, CRM)
- packages/shared (types, validators, utils) — production-quality

### In Progress (UI built, backend not wired)
- /tracking — mock map, no live Samsara GPS
- /leasing — catalog and configurator UI, no DocuSign lease request
- /notifications — card list, no push subscriptions
- /insights — charts render with mock data, no OPIS/EIA feed
- /payments — form components built, no Stripe API calls

### Placeholder / Not Started
- Supabase database connection (migrations exist, not applied to live project)
- OPIS/EIA price feed edge function
- Stripe ACH/card payment processing
- DocuSign envelope creation and webhook
- Samsara delivery webhook handler
- Avalara tax calculation integration
- Push notifications (web + mobile)
- Mobile app (`apps/mobile/`) — not scaffolded yet

---

## 7. Tech Stack Summary

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript 5 strict |
| Styling | Tailwind CSS 3, shadcn/ui (Radix primitives) |
| State | Zustand (cart/auth), TanStack Query (planned) |
| Charts | Recharts 2 |
| Forms | React Hook Form + Zod |
| Database | Supabase (PostgreSQL 15, pgvector, RLS) |
| Auth | Supabase Auth (email/password, magic link) |
| Payments | Stripe (ACH + card) — scaffolded |
| Tracking | Samsara v1 — scaffolded |
| Contracts | DocuSign eSignature v2.1 — scaffolded |
| Tax | Avalara AvaTax v2 — scaffolded |
| Email/SMS | SendGrid + Twilio — scaffolded |
| Monorepo | Turborepo with packages/shared, packages/ui, packages/db |
| Deployment | Vercel (web), EAS (mobile — not started) |

---

*Indexed 2026-04-01. Source: `/Users/evantheiss/Projects/delta-portal`.*
