# Delta Intelligence — Endpoint + Pattern + Schema Map

## Summary
- **78 gateway endpoints** (72 working, 6 with issues)
- **63 trained intent patterns** across 48 domains
- **8 data sources** connected
- **5,105 Ascend ERP tables** accessible via raw SQL

---

## Complete Endpoint Status

### Ascend ERP (34 endpoints — ALL WORKING)

| # | Method | Endpoint | Status | Data |
|---|--------|----------|--------|------|
| 1 | POST | /ascend/query | OK | Raw SQL against any of 5,105 tables |
| 2 | GET | /ascend/tables | OK | 5,105 table names |
| 3 | GET | /ascend/schema/{table} | OK | Column definitions |
| 4 | GET | /ascend/customers | OK | 1,180 customers |
| 5 | GET | /ascend/customers/top | OK | Revenue-ranked customers |
| 6 | GET | /ascend/ar/aging | OK | AR by customer |
| 7 | GET | /ascend/ar/summary | OK | AR by type ($782M total) |
| 8 | GET | /ascend/invoices | OK | Invoice list |
| 9 | GET | /ascend/invoices/detail/{id} | OK | Line items |
| 10 | GET | /ascend/gl/chart-of-accounts | OK | Chart of accounts |
| 11 | GET | /ascend/gl/trial-balance | OK | 2,008 rows |
| 12 | GET | /ascend/gl/balance-sheet | OK | Balance sheet |
| 13 | GET | /ascend/gl/income-statement | OK | Income statement |
| 14 | GET | /ascend/gl/pl-by-pc | OK | P&L by profit center |
| 15 | GET | /ascend/gl/journal-entries | OK | 1,250+ per period |
| 16 | GET | /ascend/gl/equity | OK | 1,068 equity rows |
| 17 | GET | /ascend/revenue | OK | 355 revenue rows |
| 18 | GET | /ascend/revenue/by-customer | OK | 805 customers |
| 19 | GET | /ascend/gp/by-pc | OK | 61 profit centers |
| 20 | GET | /ascend/vendors | OK | 956 vendors |
| 21 | GET | /ascend/ap/purchases | OK | 192,362 AP rows |
| 22 | GET | /ascend/ap/recurring | OK | 974 recurring |
| 23 | GET | /ascend/assets/fixed | OK | 13 asset categories |
| 24 | GET | /ascend/equipment | OK | Equipment list |
| 25 | GET | /ascend/tanks | OK | 6,739 tanks |
| 26 | GET | /ascend/tanks/assignments | OK | Tank assignments |
| 27 | GET | /ascend/sites | OK | 78 sites with GPS |
| 28 | GET | /ascend/profit-centers | OK | 43 profit centers |
| 29 | GET | /ascend/taxes | OK | Tax codes |
| 30 | GET | /ascend/taxes/collected | OK | 469 tax entries |
| 31 | GET | /ascend/leases | OK | 146 leases |
| 32 | GET | /ascend/commissions | OK | 312 commission entries |
| 33 | GET | /ascend/costs/by-pc | OK | 930 cost rows |
| 34 | GET | /ascend/invoices/detail/{id} | OK | Line items |

### Salesforce CRM (11 endpoints — ALL WORKING)

| # | Method | Endpoint | Status | Data |
|---|--------|----------|--------|------|
| 35 | GET | /salesforce/accounts | OK | 21,311 accounts |
| 36 | GET | /salesforce/contacts | OK | 2,185 contacts |
| 37 | GET | /salesforce/opportunities | OK | 690 opportunities |
| 38 | GET | /salesforce/leads | OK | 3,359 leads |
| 39 | GET | /salesforce/cases | OK | 1 case |
| 40 | GET | /salesforce/users | OK | 128 users |
| 41 | GET | /salesforce/products | OK | 1,891 products |
| 42 | GET | /salesforce/tasks | OK | 20,710 tasks |
| 43 | GET | /salesforce/events | OK | 4,948 events |
| 44 | POST | /salesforce/query | OK | Full SOQL ($91M pipeline confirmed) |

### Samsara Fleet (11 endpoints — 10 WORKING, 1 BROKEN)

| # | Method | Endpoint | Status | Data |
|---|--------|----------|--------|------|
| 45 | GET | /samsara/vehicles | OK | 160 vehicles |
| 46 | GET | /samsara/drivers | OK | 237 drivers |
| 47 | GET | /samsara/locations | OK | 157 GPS positions |
| 48 | GET | /samsara/stats | OK | Odometer, engine hours |
| 49 | GET | /samsara/fuel | OK | Fuel levels |
| 50 | GET | /samsara/diagnostics | OK | Engine states |
| 51 | GET | /samsara/addresses | OK | 326 geofences |
| 52 | GET | /samsara/tags | OK | 21 fleet groups |
| 53 | GET | /samsara/hos | OK | 27 HOS logs/day |
| 54 | GET | /samsara/alerts | OK | Safety events |
| 55 | GET | /samsara/defects | BROKEN | JSON parse error on empty response |

### Power BI (4 endpoints — 1 WORKING, 3 BLOCKED)

| # | Method | Endpoint | Status | Data |
|---|--------|----------|--------|------|
| 56 | GET | /powerbi/workspaces | OK | 5 workspaces |
| 57 | GET | /powerbi/datasets | BLOCKED | App permissions needed |
| 58 | GET | /powerbi/reports | BLOCKED | App permissions needed |
| 59 | POST | /powerbi/query | BLOCKED | App permissions needed |

### Microsoft 365 (4 endpoints — ALL WORKING)

| # | Method | Endpoint | Status | Data |
|---|--------|----------|--------|------|
| 60 | GET | /microsoft/sites | OK | SharePoint sites |
| 61 | GET | /microsoft/search | OK | Full-text document search |
| 62 | GET | /microsoft/users | OK | M365 users |
| 63 | POST | /microsoft/query | OK | Custom Graph API |

### Vroozi (7 endpoints — 5 WORKING, 2 ISSUES)

| # | Method | Endpoint | Status | Data |
|---|--------|----------|--------|------|
| 64 | GET | /vroozi/purchase-orders | OK | 21K+ POs |
| 65 | GET | /vroozi/suppliers | OK | 25 suppliers |
| 66 | GET | /vroozi/users | OK | 125 users |
| 67 | GET | /vroozi/gl-accounts | OK | 889 GL accounts |
| 68 | GET | /vroozi/catalogs | OK | 2,605 catalog items |
| 69 | GET | /vroozi/cost-centers | EMPTY | Working but 0 data |
| 70 | GET | /vroozi/invoices | BROKEN | Auth SHA-256 encoding bug |

### Fleet Panda (4 endpoints — ALL WORKING)

| # | Method | Endpoint | Status | Data |
|---|--------|----------|--------|------|
| 71 | GET | /fleetpanda/assets | OK | 10 assets |
| 72 | GET | /fleetpanda/assets/trucks | OK | 1 truck |
| 73 | GET | /fleetpanda/assets/tanks | OK | 9 tanks |
| 74 | GET | /fleetpanda/customers | OK | Customers |

### Gateway Meta (4 endpoints)

| # | Method | Endpoint | Status |
|---|--------|----------|--------|
| 75 | GET | / | OK | Service info |
| 76 | GET | /whoami | OK | Auth check |
| 77 | GET | /samsara/auth | OK | OAuth flow |
| 78 | GET | /samsara/callback | OK | OAuth callback |

---

## Pattern → Endpoint Routing Map

### Ascend ERP Patterns (22)

| Pattern Domain | Triggers On | Routes To |
|----------------|------------|-----------|
| Pricing / Quoting | price, quote, bid, rate | /ascend/query + /ascend/invoices + /ascend/sites + /ascend/tanks |
| DTN / Rack Pricing | rack price, dtn, wholesale, terminal | /ascend/query (vRackPrice) |
| Rack Price Comparison | compare rack, low rack, cheapest supply | /ascend/query |
| Revenue Summary | total revenue, annual revenue | /ascend/revenue + /ascend/revenue/by-customer |
| Customer Profitability | gross profit, gp, margin, cogs | /ascend/query (GP formula) |
| AR / Collections | ar aging, outstanding, overdue, past due | /ascend/query + /ascend/ar/aging |
| Vendor / AP / Procurement | vendor, supplier, ap spend | /ascend/query + /ascend/vendors + /vroozi/* |
| Customer Type Analysis | customer type, segment, atlas | /ascend/query |
| Salesperson Performance | sales rep, salesperson, who sold | /ascend/query |
| Product Mix | product, fuel type, what we sell | /ascend/query |
| Carrier / Transport | carrier, transport, delivery volume | /ascend/query |
| Geographic / Ship-To | state, region, where we deliver | /ascend/query |
| Monthly / Trend Analysis | by month, trend, monthly revenue | /ascend/query |
| Year-over-Year | yoy, annual growth, compare years | /ascend/query + /ascend/revenue |
| Journal Entries / GL | journal entry, gj, posted journal | /ascend/gl/journal-entries + /ascend/query |
| Trial Balance | trial balance, tb, gl balance | /ascend/gl/trial-balance |
| Equity | equity, retained earnings, net worth | /ascend/gl/equity |
| Commissions | commission, sales commission | /ascend/commissions |
| Fixed Assets / Depreciation | fixed asset, depreciation, capital | /ascend/assets/fixed |
| Inventory / Stock Status | inventory, stock, on hand | /ascend/query (DF_PBI_Inventory_StockStatus) |
| Open Orders / Compliance | open order, compliance, unfilled | /ascend/query (DF_PBI_vOpenOrdersOutofGPCompliance) |
| Sites / Locations + Profit Centers | site, branch, profit center | /ascend/sites + /ascend/profit-centers |

### Samsara Fleet Patterns (6)

| Pattern Domain | Triggers On | Routes To |
|----------------|------------|-----------|
| Vehicles | vehicle, truck, fleet inventory, vin | /samsara/vehicles + /samsara/tags |
| Drivers | driver, cdl, eld, carrier | /samsara/drivers + /samsara/tags |
| GPS / Locations | gps, location, where, parked, idle | /samsara/locations + /samsara/addresses |
| HOS / Compliance | hours of service, duty status, drive time | /samsara/hos + /samsara/drivers |
| Geofences / Yards | terminal, depot, geofence, yard | /samsara/addresses + /samsara/tags |
| Tags / Groups | tag, group, region, fleet group | /samsara/tags |

### Salesforce CRM Patterns (10)

| Pattern Domain | Triggers On | Routes To |
|----------------|------------|-----------|
| Pipeline by Stage | pipeline, stage, won deal, forecast | /salesforce/opportunities |
| Contacts | contact at, who at, people at | /salesforce/contacts + /salesforce/accounts |
| Support Cases | case, support case, customer issue | /salesforce/cases |
| Leads | lead, new lead, qualified lead | /salesforce/leads |
| Users / Team | sf user, sales team, crm user | /salesforce/users |
| Products | sf product, product catalog, family | /salesforce/products |
| Tasks / Activities | task, activity, call log, overdue | /salesforce/tasks |
| Events / Calendar | event, calendar, meeting, visit | /salesforce/events |
| Raw SOQL | soql, salesforce query | /salesforce/query |
| Account Lookup | customer in, account in, who serve | /salesforce/accounts + /ascend/customers |

### Microsoft / Power BI / Vroozi Patterns (10)

| Pattern Domain | Triggers On | Routes To |
|----------------|------------|-----------|
| SharePoint Search | document, sharepoint, file, sop | /microsoft/search + /microsoft/sites |
| Logistics | dispatch, route, freight, bol | /ascend/query + /samsara/* |
| Power BI | power bi, pbi, workspace, report | /powerbi/workspaces |
| Vroozi POs | vroozi po, procurement order | /vroozi/purchase-orders + /vroozi/suppliers |
| Vroozi Cost Centers | cost center, department code | /vroozi/cost-centers + /vroozi/gl-accounts |
| Vroozi Users | vroozi user, approval limit | /vroozi/users |
| Vroozi Catalogs | catalog, punch out | /vroozi/catalogs |
| Vroozi GL | vroozi gl, chart of accounts | /vroozi/gl-accounts |
| Tank / Equipment | tank, equipment, double wall, 3k | /ascend/tanks + /ascend/equipment + /ascend/query |
| Customer Lookup | customer in, account near | /ascend/query + /salesforce/accounts |

---

## Key SQL Views (Verified)

| View | Purpose | Date Range | Row Count |
|------|---------|------------|-----------|
| DF_PBI_BillingChartQuery | Invoice headers + customer + geo | 2011–current | 153,270 |
| DF_PBI_DS_SalesAndProfitAnalysis | Line items + product names + GP | 2020–Jan 2022 | 204,292 |
| DF_PBI_IncomeStatementData | Income statement | Unknown | Check schema |
| DF_PBI_Inventory_StockStatus | Inventory by site | Current | Lubricants/additives |
| vRackPrice | DTN rack prices | Live daily | All supply points |
| vPurchaseJournal | AP vendor spend | Current | 192,362 (2025) |
| vInvoiceJournal | Invoice journal | Current | Check schema |
| vCashDisburseJournal | Cash disbursements | Current | Check schema |

## Key Join Patterns

```
CURRENT PRICING:    BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
GP BY CUSTOMER:     Same + WHERE i.Total_UnitCost > 0, SUM(Qty*UnitPrice - Qty*Total_UnitCost)
AP VENDOR SPEND:    vPurchaseJournal (self-contained)
JOURNAL ENTRIES:    JournalEntryHeader h JOIN JournalEntryLine l ON h.JournalEntryID = l.JournalEntryID
RACK PRICES:        vRackPrice (self-contained, daily)
PRODUCT NAMES:      DF_PBI_DS_SalesAndProfitAnalysis.MasterProdDescr (lookup only, data ends Jan 2022)
CROSS-SYSTEM:       Vroozi.externalId = Ascend.vendor_display_id
                    SF Account.Name ≈ Ascend Address.Name (fuzzy match)
```
