# Delta Intelligence — Gateway Endpoint Reference

All endpoints are served by the Delta360 Unified Data Gateway. The gateway runs on a Windows server and is accessible via Cloudflare tunnel or direct connection.

**Base URL:** Configurable via `GATEWAY_BASE_URL` env var
**Auth:** API key passed in `x-api-key` header (role-mapped, never exposed to client)

**Total: 78 endpoints across 8 services (72 working, 6 with issues)**

---

## Gateway Meta (4 endpoints)

| # | Method | Path | Status | Description |
|---|--------|------|--------|-------------|
| 1 | GET | `/` | OK | Service info and version |
| 2 | GET | `/whoami` | OK | Returns current API key's role and permissions |
| 3 | GET | `/samsara/auth` | OK | Initiates Samsara OAuth flow |
| 4 | GET | `/samsara/callback` | OK | Samsara OAuth callback handler |

---

## Ascend ERP (34 endpoints — ALL WORKING)

The production ERP system. Contains 5,105 SQL tables accessible via raw queries, plus pre-built convenience endpoints.

### Raw SQL Access

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 1 | POST | `/ascend/query` | Execute raw SQL against any of 5,105 tables | `{ success, data: [...rows], rowCount }` |
| 2 | GET | `/ascend/tables` | List all 5,105 table names | `{ success, data: [{ TABLE_NAME }] }` |
| 3 | GET | `/ascend/schema/{table}` | Column definitions for a table | `{ success, data: [{ COLUMN_NAME, DATA_TYPE, IS_NULLABLE }] }` |

### Customers and Revenue

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 4 | GET | `/ascend/customers` | 1,180 customers | `{ success, data: [{ Id, Name, City, State }] }` |
| 5 | GET | `/ascend/customers/top` | Revenue-ranked customers | `{ success, data: [{ Name, Revenue }] }` |
| 6 | GET | `/ascend/revenue` | 355 revenue rows | `{ success, data: [{ ProfitCenter, Revenue, Period }] }` |
| 7 | GET | `/ascend/revenue/by-customer` | Revenue by customer (805 customers) | `{ success, data: [{ CustomerName, Revenue }] }` |

### Accounts Receivable

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 8 | GET | `/ascend/ar/aging` | AR aging by customer | `{ success, data: [{ Customer, Current, Over30, Over60, Over90 }] }` |
| 9 | GET | `/ascend/ar/summary` | AR summary by type ($782M total) | `{ success, data: [{ Type, Amount }] }` |
| 10 | GET | `/ascend/invoices` | Invoice list | `{ success, data: [{ SysTrxNo, CustomerName, InvoiceDt, Amount }] }` |
| 11 | GET | `/ascend/invoices/detail/{id}` | Invoice line items | `{ success, data: [{ SysTrxLine, Product, Qty, UnitPrice }] }` |

### General Ledger

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 12 | GET | `/ascend/gl/chart-of-accounts` | Chart of accounts | `{ success, data: [{ AccountNumber, Description, Type }] }` |
| 13 | GET | `/ascend/gl/trial-balance` | Trial balance (2,008 rows) | `{ success, data: [{ Account, Debit, Credit }] }` |
| 14 | GET | `/ascend/gl/balance-sheet` | Balance sheet | `{ success, data: [{ Category, Account, Balance }] }` |
| 15 | GET | `/ascend/gl/income-statement` | Income statement | `{ success, data: [{ Category, Account, Amount }] }` |
| 16 | GET | `/ascend/gl/pl-by-pc` | P&L by profit center | `{ success, data: [{ ProfitCenter, Revenue, Expenses, NetIncome }] }` |
| 17 | GET | `/ascend/gl/journal-entries` | Journal entries (1,250+ per period) | `{ success, data: [{ JournalEntryID, UserID, Date, Debit, Credit }] }` |
| 18 | GET | `/ascend/gl/equity` | Equity (1,068 rows) | `{ success, data: [{ Account, Balance }] }` |

### Profitability

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 19 | GET | `/ascend/gp/by-pc` | Gross profit by profit center (61 PCs) | `{ success, data: [{ ProfitCenter, Revenue, COGS, GP }] }` |
| 20 | GET | `/ascend/costs/by-pc` | Costs by profit center (930 rows) | `{ success, data: [{ ProfitCenter, CostCategory, Amount }] }` |

### Accounts Payable

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 21 | GET | `/ascend/vendors` | 956 vendors | `{ success, data: [{ Id, Name, City, State }] }` |
| 22 | GET | `/ascend/ap/purchases` | 192,362 AP rows | `{ success, data: [{ Vendor, Amount, Date }] }` |
| 23 | GET | `/ascend/ap/recurring` | 974 recurring AP entries | `{ success, data: [{ Vendor, Amount, Frequency }] }` |

### Assets and Equipment

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 24 | GET | `/ascend/assets/fixed` | 13 fixed asset categories | `{ success, data: [{ Category, Count, Value }] }` |
| 25 | GET | `/ascend/equipment` | Equipment list | `{ success, data: [{ Id, Description, Type }] }` |
| 26 | GET | `/ascend/tanks` | 6,739 tanks | `{ success, data: [{ TankId, Size, Type, Location }] }` |
| 27 | GET | `/ascend/tanks/assignments` | Tank assignments | `{ success, data: [{ TankId, Customer, Site }] }` |

### Operations

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 28 | GET | `/ascend/sites` | 78 sites with GPS | `{ success, data: [{ SiteId, Name, Lat, Lng }] }` |
| 29 | GET | `/ascend/profit-centers` | 43 profit centers | `{ success, data: [{ Id, Name, Region }] }` |

### Tax, Leases, Commissions

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 30 | GET | `/ascend/taxes` | Tax codes | `{ success, data: [{ Code, Description, Rate }] }` |
| 31 | GET | `/ascend/taxes/collected` | 469 tax entries | `{ success, data: [{ TaxCode, Amount, Period }] }` |
| 32 | GET | `/ascend/leases` | 146 leases | `{ success, data: [{ LeaseId, Customer, MonthlyAmount }] }` |
| 33 | GET | `/ascend/commissions` | 312 commission entries | `{ success, data: [{ Salesperson, Amount, Period }] }` |

---

## Salesforce CRM (11 endpoints — ALL WORKING)

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 34 | GET | `/salesforce/accounts` | 21,311 accounts | `{ success, data: [{ Id, Name, Industry, Type, BillingCity }] }` |
| 35 | GET | `/salesforce/contacts` | 2,185 contacts | `{ success, data: [{ Id, FirstName, LastName, Email, Account }] }` |
| 36 | GET | `/salesforce/opportunities` | 690 opportunities | `{ success, data: [{ Id, Name, StageName, Amount, CloseDate }] }` |
| 37 | GET | `/salesforce/leads` | 3,359 leads | `{ success, data: [{ Id, FirstName, LastName, Company, Status }] }` |
| 38 | GET | `/salesforce/cases` | 1 case | `{ success, data: [{ Id, CaseNumber, Subject, Status }] }` |
| 39 | GET | `/salesforce/users` | 128 users | `{ success, data: [{ Id, Name, Email, IsActive, Role }] }` |
| 40 | GET | `/salesforce/products` | 1,891 products | `{ success, data: [{ Id, Name, ProductCode, Family }] }` |
| 41 | GET | `/salesforce/tasks` | 20,710 tasks | `{ success, data: [{ Id, Subject, Status, Priority }] }` |
| 42 | GET | `/salesforce/events` | 4,948 events | `{ success, data: [{ Id, Subject, StartDateTime, EndDateTime }] }` |
| 43 | POST | `/salesforce/query` | Full SOQL queries | `{ success, data: [...records] }` |

**SOQL example:** `POST /salesforce/query` with body `{ "soql": "SELECT Id, Name FROM Account LIMIT 5" }`

---

## Samsara Fleet (11 endpoints — 10 WORKING, 1 BROKEN)

### Working Endpoints

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 44 | GET | `/samsara/vehicles` | 160 vehicles | `{ success, data: [{ id, name, make, model, year, vin }] }` |
| 45 | GET | `/samsara/drivers` | 237 drivers | `{ success, data: [{ id, name, phone, licenseNumber, status }] }` |
| 46 | GET | `/samsara/locations` | 157 live GPS positions | `{ success, data: [{ id, name, location: { lat, lng, speed } }] }` |
| 47 | GET | `/samsara/stats` | Odometer, engine hours | `{ success, data: [...] }` |
| 48 | GET | `/samsara/fuel` | Fuel levels | `{ success, data: [...] }` |
| 49 | GET | `/samsara/diagnostics` | Engine states | `{ success, data: [...] }` |
| 50 | GET | `/samsara/addresses` | 326 geofence locations | `{ success, data: [{ id, name, formattedAddress, geofence }] }` |
| 51 | GET | `/samsara/tags` | 21 fleet groups | `{ success, data: [{ id, name, vehicles, drivers }] }` |
| 52 | GET | `/samsara/hos` | HOS daily logs (query: `?startDate=&endDate=`) | `{ success, data: [{ driver, dutyStatusDurations }] }` |
| 53 | GET | `/samsara/alerts` | Safety events | `{ success, data: [...] }` |

### Broken Endpoints

| # | Method | Path | Issue |
|---|--------|------|-------|
| 54 | GET | `/samsara/defects` | JSON parse error on empty response |

---

## Power BI (4 endpoints — 1 WORKING, 3 BLOCKED)

| # | Method | Path | Status | Description |
|---|--------|------|--------|-------------|
| 55 | GET | `/powerbi/workspaces` | OK | 5 workspaces | `{ success, data: [{ id, name, isOnDedicatedCapacity }] }` |
| 56 | GET | `/powerbi/datasets` | BLOCKED | Requires delegated (not app) permissions |
| 57 | GET | `/powerbi/reports` | BLOCKED | Requires delegated permissions |
| 58 | POST | `/powerbi/query` | BLOCKED | DAX query execution (requires delegated permissions) |

---

## Microsoft 365 (4 endpoints — ALL WORKING)

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 59 | GET | `/microsoft/sites` | All SharePoint sites | `{ success, data: [{ id, name, webUrl }] }` |
| 60 | GET | `/microsoft/search` | Full-text search across SharePoint + OneDrive (`?q=keyword`) | `{ success, data: [{ name, webUrl, lastModified }] }` |
| 61 | GET | `/microsoft/users` | M365 users | `{ success, data: [{ id, displayName, mail }] }` |
| 62 | POST | `/microsoft/query` | Custom Graph API call | `{ success, data: {...} }` |

---

## Vroozi Procurement (7 endpoints — 5 WORKING, 2 ISSUES)

| # | Method | Path | Status | Description | Sample Response Shape |
|---|--------|------|--------|-------------|----------------------|
| 63 | GET | `/vroozi/purchase-orders` | OK | 21,446+ POs (25/page) | `{ success, data: [{ id, status, supplier, amount }] }` |
| 64 | GET | `/vroozi/suppliers` | OK | 25 suppliers | `{ success, data: [{ id, name, address, vendorId }] }` |
| 65 | GET | `/vroozi/users` | OK | 125 users | `{ success, data: [{ id, email, firstname, lastname, roles }] }` |
| 66 | GET | `/vroozi/gl-accounts` | OK | 889 GL accounts | `{ success, data: [{ id, externalId, code, description }] }` |
| 67 | GET | `/vroozi/catalogs` | OK | 2,605 catalog items | `{ success, data: [{ id, name, catalogType, catalogStatus }] }` |
| 68 | GET | `/vroozi/cost-centers` | EMPTY | Works but returns 0 records | `{ success, data: [] }` |
| 69 | GET | `/vroozi/invoices` | BROKEN | Auth SHA-256 encoding bug | Error response |

---

## Fleet Panda (4 endpoints — ALL WORKING)

| # | Method | Path | Description | Sample Response Shape |
|---|--------|------|-------------|----------------------|
| 70 | GET | `/fleetpanda/assets` | 10 assets | `{ success, data: [{ id, name, type }] }` |
| 71 | GET | `/fleetpanda/assets/trucks` | 1 truck | `{ success, data: [{ id, name, vin }] }` |
| 72 | GET | `/fleetpanda/assets/tanks` | 9 tanks | `{ success, data: [{ id, name, capacity }] }` |
| 73 | GET | `/fleetpanda/customers` | Customers | `{ success, data: [{ id, name }] }` |

---

## Key SQL Views (for POST /ascend/query)

| View | Purpose | Row Count |
|------|---------|-----------|
| DF_PBI_BillingChartQuery | Invoice headers + customer + geo (2011-current) | 153,270 |
| DF_PBI_DS_SalesAndProfitAnalysis | Line items + product names + GP (2020-Jan 2022) | 204,292 |
| vRackPrice | DTN rack prices (live daily) | All supply points |
| vPurchaseJournal | AP vendor spend | 192,362 (2025) |
| JournalEntryHeader + JournalEntryLine | Journal entries | 1,250+/period |

## Key Join Patterns

```sql
-- Current pricing (billing + line items)
SELECT b.CustomerName, i.UnitPrice, i.Qty
FROM DF_PBI_BillingChartQuery b
JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo

-- Gross profit by customer
SELECT b.CustomerName,
  SUM(i.Qty*i.UnitPrice) AS Revenue,
  SUM(i.Qty*ISNULL(i.Total_UnitCost,0)) AS COGS
FROM DF_PBI_BillingChartQuery b
JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
WHERE b.Year=2025 AND i.Total_UnitCost > 0
GROUP BY b.CustomerName

-- Rack prices
SELECT Vendor_Name, SupplyPoint, ProductDescr, RackPrice
FROM vRackPrice WHERE ProductDescr LIKE '%Diesel%'
ORDER BY EffDtTm DESC
```
