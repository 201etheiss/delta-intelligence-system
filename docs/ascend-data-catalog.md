# Ascend ERP Data Landscape Index
## Complete Gateway Mapping & SQL Schema Reference

**Generated:** 2026-04-01
**Data Coverage:** Ascend SQL (271 tables, 5,105 total), Gateway (78 endpoints across 8 services)
**Data Freshness:** DF_PBI_BillingChartQuery current through Period 3 2026

---

## A. GATEWAY ENDPOINTS — COMPLETE CATALOG

### Ascend ERP (34 endpoints — ALL WORKING)

**Raw Query & Discovery**
- `POST /ascend/query` — Execute raw SELECT against any of 5,105 tables. Body: `{"sql":"SELECT..."}`
- `GET /ascend/tables` — Returns list of all 5,105 table names
- `GET /ascend/schema/{table}` — Column definitions and types for a specific table

**Customer Data**
- `GET /ascend/customers` — All customers with invoice counts since 2024
- `GET /ascend/customers/top?year=YYYY` — Top customers ranked by revenue

**Accounts Receivable**
- `GET /ascend/ar/aging` — AR aging buckets: Current, 1-30, 31-60, 61-90, 90+ days
- `GET /ascend/ar/summary` — AR summary grouped by customer type
- `GET /ascend/invoices?year=YYYY&period=N&limit=X` — Invoice list with filtering
- `GET /ascend/invoices/detail/{sysTrxNo}` — Line items for specific invoice

**General Ledger & Financial Statements**
- `GET /ascend/gl/chart-of-accounts` — Full chart of accounts with account groups
- `GET /ascend/gl/trial-balance?year=YYYY&period=N` — Trial balance by period
- `GET /ascend/gl/balance-sheet?year=YYYY&period=N` — Balance sheet
- `GET /ascend/gl/income-statement?year=YYYY&period=N` — Income statement
- `GET /ascend/gl/pl-by-pc?year=YYYY` — P&L by profit center
- `GET /ascend/gl/journal-entries?year=YYYY&period=N` — Journal entries with line detail
- `GET /ascend/gl/equity?year=YYYY` — Equity account movements

**Revenue & Profitability**
- `GET /ascend/revenue?year=YYYY` — Revenue by account and period
- `GET /ascend/revenue/by-customer?year=YYYY` — Revenue ranked by customer
- `GET /ascend/gp/by-pc?year=YYYY&period=N&posted=bool` — Gross profit by profit center

**Accounts Payable**
- `GET /ascend/vendors` — All vendors with transaction counts
- `GET /ascend/ap/purchases?year=YYYY&period=N` — Purchase journal entries
- `GET /ascend/ap/recurring` — Recurring vendor payments (3+ months consecutive)

**Fixed Assets & Equipment**
- `GET /ascend/assets/fixed?year=YYYY` — Fixed asset movements
- `GET /ascend/equipment` — All equipment by asset type
- `GET /ascend/tanks` — Tank equipment only
- `GET /ascend/tanks/assignments` — Tank-to-customer assignments

**Operational Master Data**
- `GET /ascend/sites` — All sites with GPS coordinates
- `GET /ascend/profit-centers` — All 43 profit centers with names and regions

**Taxes & Other**
- `GET /ascend/taxes` — Tax codes with authorities
- `GET /ascend/taxes/collected?year=YYYY` — Taxes collected by code and authority
- `GET /ascend/leases` — Recurring lease/rent/storage payments
- `GET /ascend/commissions?year=YYYY` — Commission entries by profit center
- `GET /ascend/costs/by-pc?year=YYYY` — Cost breakdown by profit center

### Salesforce CRM (11 endpoints)
- `POST /salesforce/query` — SOQL queries
- `GET /salesforce/accounts`, `/contacts`, `/opportunities`, `/leads`, `/cases`, `/users`, `/products`, `/tasks`, `/events`

### Samsara Fleet (11 endpoints — 10 working)
- `GET /samsara/vehicles`, `/drivers`, `/locations`, `/stats`, `/fuel`, `/addresses`, `/tags`

### Vroozi Procurement (7 endpoints — 5 working)
- `GET /vroozi/purchase-orders`, `/suppliers`, `/users`, `/gl-accounts`, `/catalogs`

### Fleet Panda (4 endpoints)
- `GET /fleetpanda/assets`, `/assets/trucks`, `/assets/tanks`, `/customers`

### Microsoft 365 (4 endpoints)
- `GET /microsoft/sites`, `/search`, `/users`; `POST /microsoft/query`

### Power BI (4 endpoints — 1 working)
- `GET /powerbi/workspaces` — works; datasets/reports return "app-restricted"

---

## B. KEY ASCEND SQL TABLES

### Primary Transaction Tables

| Table | Purpose | Est. Rows | Key Columns |
|-------|---------|-----------|-------------|
| **DF_PBI_BillingChartQuery** | Invoice headers + customer context (PRIMARY) | 4.5M | SysTrxNo, CustomerName, ShipToDescr, CustType, InvoiceDt, Salesperson, Carrier, Lat/Lng, Year, Period |
| **ARInvoiceItem** | Invoice line items with pricing | 12M+ | SysTrxNo, SysTrxLine, MasterProdID, Qty, UnitPrice, Total_UnitCost, MasterSiteID |
| **ARInvoice** | Invoice headers (73 cols) | 58K | SysTrxNo, ShipToID, InvoiceDt, Total_Amt, DueDt1, Status (O/A/C/P/D/E), ADOTotalStillDue |
| **vPurchaseJournal** | AP spend by vendor + GL (VIEW) | 15K+ | vendor_name, Account_Desc (680 categories), debit, credit, Year_For_Period |
| **vRackPrice** | DTN fuel rack prices (daily) | Live | Vendor_Name, SupplyPoint, ProductDescr, RackPrice, EffDtTm |
| **JournalEntryHeader** | GL journal headers | 5K+ | JournalEntryID, TransactionDate, PostYear, PostPeriod, Posted (Y/N) |
| **JournalEntryLine** | GL journal detail | 30K+ | JournalEntryID, AccountNumber, AmountDebit, AmountCredit |
| **APInvoice** | AP vendor invoices (44 cols) | 25K+ | InvoiceNumber, VendorID, InvoiceDate, InvoiceAmount, Period, Year |
| **APVendor** | Vendor master (68 cols) | 680 | VendorNumber, VendorName, CreditLimit, PaymentMethod |
| **Address** | Customer & vendor master (80 cols) | 1,200+ | Id, Name, Latitude, Longitude, Customer (Y/N), Vendor (Y/N) |
| **ARShipTo** | ShipTo detail (154 cols) | 2,000+ | ShiptoID, Code, LongDescr, StandardAcctID, Latitude, Longitude |

### Join Keys
- `DF_PBI_BillingChartQuery.SysTrxNo` → `ARInvoiceItem.SysTrxNo` (invoice detail)
- `ARInvoice.ShipToID` → `ARShipTo.ShiptoID` (ship-to location)
- `Address.Id` → `ARShipTo.StandardAcctID` (customer master)
- `APInvoice.VendorID` → `APVendor.VendorNumber` (vendor master)
- `JournalEntryHeader.JournalEntryID` → `JournalEntryLine.JournalEntryID` (GL detail)

---

## C. VERIFIED SQL PATTERNS (12 Domains)

### 1. Top Customers
```sql
SELECT TOP 10 b.CustomerName, SUM(i.Qty * i.UnitPrice) AS Revenue,
       SUM(i.Qty) AS TotalQty, COUNT(DISTINCT b.SysTrxNo) AS Invoices
FROM DF_PBI_BillingChartQuery b
JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
WHERE b.Year = 2025 GROUP BY b.CustomerName ORDER BY Revenue DESC
```

### 2. Customer Profitability
```sql
SELECT TOP 10 b.CustomerName, SUM(i.Qty * i.UnitPrice) AS Revenue,
       SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost,0))) AS GrossProfit
FROM DF_PBI_BillingChartQuery b
JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
WHERE b.Year = 2025 AND i.Total_UnitCost > 0
GROUP BY b.CustomerName ORDER BY GrossProfit DESC
```

### 3. Salesperson Performance
```sql
SELECT TOP 10 b.Salesperson, SUM(i.Qty * i.UnitPrice) AS Revenue,
       SUM(i.Qty * ISNULL(i.Total_UnitCost,0)) AS COGS
FROM DF_PBI_BillingChartQuery b
JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
WHERE b.Year = 2025 AND i.Total_UnitCost > 0
GROUP BY b.Salesperson ORDER BY Revenue DESC
```

### 4. Monthly Revenue Trends
```sql
SELECT b.Year, b.Period, SUM(i.Qty * i.UnitPrice) AS Revenue,
       COUNT(DISTINCT b.CustomerName) AS ActiveCustomers
FROM DF_PBI_BillingChartQuery b
JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
WHERE b.Year >= 2024 GROUP BY b.Year, b.Period ORDER BY b.Year, b.Period
```

### 5. Product Mix
```sql
SELECT TOP 15 i.MasterProdID, COUNT(*) AS LineItems, SUM(i.Qty) AS TotalQty,
       SUM(i.Qty * i.UnitPrice) AS Revenue
FROM ARInvoiceItem i
JOIN DF_PBI_BillingChartQuery b ON i.SysTrxNo = b.SysTrxNo
WHERE b.Year = 2025 GROUP BY i.MasterProdID ORDER BY Revenue DESC
```

### 6-12. Additional patterns: Customer Type, Geographic, Carrier Volume, AR Collections, Rack Prices, Revenue by Site, Salesperson+Customer Profitability

---

## D. DATA FLOW MAP

| DI Module | Gateway Endpoints |
|-----------|------------------|
| **Finance** | `/ascend/gl/*`, `/ascend/ar/*`, `/ascend/ap/*`, `/ascend/revenue/*`, `/ascend/gp/*`, `/ascend/taxes/*` |
| **Operations** | `/samsara/*`, `/ascend/equipment`, `/ascend/tanks/*`, `/ascend/sites`, `/fleetpanda/*` |
| **Sales/CRM** | `/salesforce/*`, `/ascend/revenue/by-customer`, `/ascend/customers/*` |
| **ERP** | `/ascend/query` (vPurchaseJournal, APInvoice), `/vroozi/*`, `/salesforce/query` (Contract, Opportunity) |
| **Intelligence** | All endpoints (cross-domain synthesis via Nova AI) |

---

## E. KNOWN GAPS

| Category | Tables | Gap Description |
|----------|--------|----------------|
| **Inventory** | 43 tables (IN *) | No dedicated GET endpoints; only via POST /ascend/query |
| **Procurement** | 5 tables (PO *) | Vroozi covers suppliers but not Ascend PO detail |
| **Contracts** | 22 tables (CN *) | Only via Salesforce Contract object (partial) |
| **Cardlock** | 32 tables (CL *) | No endpoints; specialized vertical |
| **Fuel Supply Chain** | 33 tables (FS *) | vRackPrice exists but eBOL, OPIS, supplier detail only via query |
| **Order Entry** | 6 tables (OE *) | No open order endpoints |
| **Degree Day** | 12 tables (DD *) | No endpoints; niche vertical |

---

## F. DATA QUALITY WARNINGS

1. **Revenue Cardinality:** DO NOT use `SUM(BillingChartQuery JOIN ARInvoiceItem)` for company-wide totals — creates cartesian product. Use `GET /ascend/gp/by-pc` for accurate aggregates.
2. **Product ID Mismatch:** `Product.ProdID` != `ARInvoiceItem.MasterProdID`. Use `DF_PBI_DS_SalesAndProfitAnalysis` for lookups (data ends Jan 2022).
3. **Key Diesel MasterProdIDs:** 4399=Dyed Short Truck, 1096=Dyed Transport, 4503=Dyed Counter Sale
4. **GP Formula:** Revenue - COGS. AccountGroup='Gross margin' is COGS in Ascend, NOT GP.
5. **Period Filter:** Always use `Period BETWEEN 1 AND 12` (excludes adjustment periods)
6. **Carrier NULL:** ~1.2M records have NULL carrier (counter sales)
