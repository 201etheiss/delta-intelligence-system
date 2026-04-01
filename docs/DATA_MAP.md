# Delta Intelligence — Complete Data Map

## Overview

8 connected services, 5,105+ Ascend tables, 101 gateway endpoints.
This document maps every data source, what it contains, how they connect, and where to go for what.

---

## Source 1: Ascend ERP (5,105 tables)

### Quick-Access Views (pre-joined, fast)

| View | Data | Date Range | Key Columns |
|------|------|------------|-------------|
| `DF_PBI_BillingChartQuery` | Invoice headers + customer + location | 2011–2026 (current) | CustomerName, ShipToDescr, CustType, InvoiceDt, Salesperson, Carrier, Lat/Lng, Year, Period |
| `DF_PBI_DS_SalesAndProfitAnalysis` | Line-item detail + pricing + GP | 2020–Jan 2022 only | MasterProdID, MasterProdDescr, UnitPrice, Qty, UnitCost, CustomerName, SiteDescr, PhysStateDescr |
| `DF_PBI_IncomeStatementData` | Income statement rows | Unknown | Check with /ascend/schema/ |
| `DF_PBI_Inventory_StockStatus` | Inventory positions | Unknown | Check with /ascend/schema/ |
| `DF_PBI_InvoicesNotPrinted` | Unprinted invoices | Unknown | Check with /ascend/schema/ |
| `DF_PBI_vOpenOrdersOutofGPCompliance` | Open orders out of compliance | Unknown | Check with /ascend/schema/ |
| `vRackPrice` | DTN rack prices (live daily) | Current | Vendor_Name, SupplyPoint, ProductDescr, EffDtTm, RackPrice, DiscountPrice |
| `vPurchaseJournal` | AP spend by vendor + GL account | Current | vendor_name, vendor_display_id, invoice_no, invoice_date, Account_Desc, debit, credit, Period, Year_For_Period |
| `vInvoiceJournal` | Invoice journal entries | Current | Check schema |
| `vCashDisburseJournal` | Cash disbursements | Current | Check schema |

### Core Tables

| Table | Purpose | Key Columns | Join Keys |
|-------|---------|-------------|-----------|
| `ARInvoice` | Invoice headers (73 cols) | SysTrxNo, ShipToID, InvoiceDt, Total_Amt, Year, Period | SysTrxNo → ARInvoiceItem |
| `ARInvoiceItem` | Invoice line items (82 cols) | SysTrxNo, MasterProdID, Qty, UnitPrice, Total_UnitCost | SysTrxNo → ARInvoice, MasterProdID → product lookup |
| `Address` | Customers + vendors (80 cols) | Id, Name, Phys_City, Phys_State, Customer, Vendor | Id → ARInvoice.ShipToID |
| `Product` | Product catalog (13 cols) | ProdID, Code, LongDescr, ProdType | ProdID ≠ MasterProdID (different ID spaces) |
| `MasterProduct` | Master product registry | MasterProdID, MasterProdType | MasterProdID → ARInvoiceItem.MasterProdID |
| `JournalEntryHeader` | GL journal headers | JournalEntryID, UserID, TransactionDate, PostYear, PostPeriod, Code | JournalEntryID → JournalEntryLine |
| `JournalEntryLine` | GL journal detail | JournalEntryID, AccountNumber, Description, AmountDebit, AmountCredit | JournalEntryID → JournalEntryHeader |
| `AdHocPrices` | Pricing overrides | 10 cols | Check schema |
| `Equipment` | Equipment assets (19 cols) | Check schema | |
| `IndexPrice` | Index pricing | IndexID, SalesAliasID, EffDtTm, Price | |
| `PurchRackPrice` | Purchase rack prices | SupplierSupplyPtID, PurchAliasID, EffDtTm, Price | |
| `DTNOEPriceQuote` | DTN price quotes | ShipToDescr, ProductDescr, PriceDate, UnitPrice, Freight, Supplier | |

### Pre-built Gateway Endpoints

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/ascend/query` | POST {"sql":"..."} | Raw SQL against any table |
| `/ascend/tables` | GET | All 5,105 table names |
| `/ascend/schema/{table}` | GET | Column definitions for any table |
| `/ascend/customers` | GET | Active customers with invoice counts |
| `/ascend/customers/top` | GET ?year= | Top customers by revenue |
| `/ascend/ar/aging` | GET | AR aging by customer |
| `/ascend/ar/summary` | GET | AR summary by type |
| `/ascend/invoices` | GET ?year=&period=&limit= | Invoice list |
| `/ascend/invoices/detail/{id}` | GET | Line items for one invoice |
| `/ascend/gl/chart-of-accounts` | GET | Full chart of accounts |
| `/ascend/gl/trial-balance` | GET ?year=&period= | Trial balance |
| `/ascend/gl/balance-sheet` | GET ?year=&period= | Balance sheet |
| `/ascend/gl/income-statement` | GET ?year=&period= | Income statement |
| `/ascend/gl/pl-by-pc` | GET ?year= | P&L by profit center |
| `/ascend/gl/journal-entries` | GET ?year=&period= | Journal entries |
| `/ascend/gl/equity` | GET ?year= | Equity movements |
| `/ascend/revenue` | GET ?year= | Revenue by account |
| `/ascend/revenue/by-customer` | GET ?year= | Revenue ranked by customer |
| `/ascend/gp/by-pc` | GET ?year= | Gross profit by profit center |
| `/ascend/vendors` | GET | All vendors with transaction counts |
| `/ascend/ap/purchases` | GET ?year=&period= | Purchase journal entries |
| `/ascend/ap/recurring` | GET | Recurring vendor payments |
| `/ascend/assets/fixed` | GET ?year= | Fixed asset movements |
| `/ascend/equipment` | GET | All equipment by type |
| `/ascend/tanks` | GET | Tank equipment |
| `/ascend/tanks/assignments` | GET | Tank-to-customer assignments |
| `/ascend/sites` | GET | All sites with GPS |
| `/ascend/profit-centers` | GET | All 43 profit centers |
| `/ascend/taxes` | GET | Tax codes |
| `/ascend/taxes/collected` | GET ?year= | Taxes collected by code |
| `/ascend/leases` | GET | Lease/rent/storage payments |
| `/ascend/commissions` | GET ?year= | Commission entries |
| `/ascend/costs/by-pc` | GET ?year= | Cost breakdown by profit center |

### Key Join Patterns (Verified)

```
PRICING (current): DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
GP BY CUSTOMER:    Same join + WHERE i.Total_UnitCost > 0, compute SUM(Qty*UnitPrice) - SUM(Qty*Total_UnitCost)
AP VENDOR SPEND:   vPurchaseJournal (self-contained, has vendor_name + Account_Desc + debit)
JOURNAL ENTRIES:   JournalEntryHeader h JOIN JournalEntryLine l ON h.JournalEntryID = l.JournalEntryID
RACK PRICES:       vRackPrice (self-contained, updated daily from DTN)
PRODUCT NAMES:     DF_PBI_DS_SalesAndProfitAnalysis (MasterProdID → MasterProdDescr) — USE FOR LOOKUPS ONLY, data ends Jan 2022
```

### Known MasterProdIDs

| ID | Code | Description |
|----|------|-------------|
| 4399 | DDB | Diesel Dyed Short Truck |
| 4412 | DDB5B | Diesel Dyed Bio5 Short Truck |
| 1096 | DDT | Diesel Dyed Transport |
| 1116 | DDB5T | Diesel Dyed Bio5 Transport |
| 4503 | DDCS | Diesel Dyed Counter Sale |
| 1187 | — | Diesel Dyed variant |
| 1188 | DCB | Diesel Clear Short Truck |
| 1131 | DCT | Diesel Clear Transport |
| 4505 | DCCS | Diesel Clear Counter Sale |

---

## Source 2: Salesforce CRM

| Endpoint | Returns |
|----------|---------|
| `/salesforce/accounts` | All accounts (industry, type, billing address) |
| `/salesforce/contacts` | Contacts with account association |
| `/salesforce/opportunities` | Pipeline (stage, amount, close date) |
| `/salesforce/leads` | Leads by created date |
| `/salesforce/cases` | Support cases (status, priority) |
| `/salesforce/users` | Users (roles, departments) |
| `/salesforce/products` | Product catalog |
| `/salesforce/tasks` | Activity tasks |
| `/salesforce/events` | Calendar events |
| `/salesforce/query` | POST {"soql":"SELECT ..."} — raw SOQL |

**Cross-reference:** Salesforce Account Name ↔ Ascend Address.Name (fuzzy match)

---

## Source 3: Samsara Fleet (160 vehicles, 237 drivers)

| Endpoint | Records | Key Fields |
|----------|---------|------------|
| `/samsara/vehicles` | 160 | id, name, make, model, year, vin, tags, staticAssignedDriver |
| `/samsara/drivers` | 237 | id, name, username, phone, licenseNumber, driverActivationStatus |
| `/samsara/locations` | 157 | id, name, location{time, lat, lng, heading, speed, reverseGeo} |
| `/samsara/addresses` | 326 | id, name, formattedAddress, geofence, tags, addressTypes |
| `/samsara/tags` | 21 | id, name, parentTagId, vehicles, drivers, assets |
| `/samsara/hos` | ~27/day | driver, dutyStatusDurations, distanceTraveled, logMetaData |

**Broken endpoints:** stats, fuel, diagnostics, defects, alerts (gateway parameter bugs)

---

## Source 4: DTN Rack Pricing (via Ascend)

Live daily rack prices accessed via `vRackPrice` table in Ascend SQL.

| Field | Description |
|-------|-------------|
| Vendor_Name | DTN LLC, Sunoco LP, Calumet, Valero, ExxonMobil, Enterprise, etc. |
| SupplyPoint | Terminal code (TX2737, LA2371, LA2368, etc.) |
| ProductDescr | Diesel Dyed, Diesel Clear, Diesel Dyed TexLed, etc. |
| EffDtTm | Price effective date/time (updated daily) |
| RackPrice | Posted rack price ($/gal) |
| DiscountPrice | Net after discounts |

---

## Source 5: Microsoft 365

| Endpoint | Returns |
|----------|---------|
| `/microsoft/sites` | All SharePoint sites (Atlas/Delta Fuel, Accounting, AP Pay File, etc.) |
| `/microsoft/search?q=` | Full-text search across SharePoint + OneDrive |
| `/microsoft/users` | All M365 users |
| `/microsoft/query` | POST — custom Graph API query |

---

## Source 6: Power BI

| Endpoint | Returns |
|----------|---------|
| `/powerbi/workspaces` | All PBI workspaces |
| `/powerbi/datasets` | All datasets |
| `/powerbi/reports` | All reports |
| `/powerbi/query` | POST — DAX query on dataset |

---

## Source 7: Vroozi Procurement (25 suppliers, 21K+ POs)

| Endpoint | Returns |
|----------|---------|
| `/vroozi/purchase-orders` | POs with supplier, amounts, status |
| `/vroozi/invoices` | Vroozi invoices |
| `/vroozi/suppliers` | 25 suppliers with address, contacts |
| `/vroozi/users` | Vroozi users |
| `/vroozi/cost-centers` | Cost centers |
| `/vroozi/gl-accounts` | GL accounts in Vroozi |
| `/vroozi/catalogs` | Product catalogs |

**Cross-reference:** Vroozi externalId/vendorId = Ascend vendor_display_id

---

## Source 8: Fleet Panda (10 assets)

| Endpoint | Returns |
|----------|---------|
| `/fleetpanda/assets` | 10 assets (1 truck, 9 tanks) |
| `/fleetpanda/assets/trucks` | Filtered trucks |
| `/fleetpanda/assets/tanks` | Filtered tanks |
| `/fleetpanda/customers` | Fleet Panda customers |

**Note:** Limited account. Ascend has the full fleet data (6,739 tanks).

---

## Cross-System Entity Mapping

| Entity | Ascend | Salesforce | Samsara | Vroozi |
|--------|--------|------------|---------|--------|
| Customer | Address.Name (Id) | Account.Name (Id) | — | — |
| Vendor | vendor_display_id | — | — | externalId/vendorId |
| Vehicle | Equipment table | — | vehicles (id, name) | assets |
| Employee | UserID (journal) | User.Name | drivers (name) | users |
| Location | Sites (GPS), Address (city/state) | Account.BillingAddress | locations (lat/lng) | supplier.address |
| Product | MasterProdID → MasterProdDescr | Products | — | catalogs |
| Invoice | ARInvoice + ARInvoiceItem | — | — | invoices |

---

## Decision Tree: Where to Find What

```
Pricing/Quoting?
  → Current rack: vRackPrice (Ascend SQL)
  → Historical invoice prices: BillingChartQuery JOIN ARInvoiceItem
  → Tank pricing: Equipment + AdHocPrices tables

Financial Reporting?
  → Balance sheet: /ascend/gl/balance-sheet
  → Income statement: /ascend/gl/income-statement
  → P&L by profit center: /ascend/gl/pl-by-pc
  → Trial balance: /ascend/gl/trial-balance
  → Journal entries: /ascend/gl/journal-entries OR JournalEntryHeader SQL

Customer Analysis?
  → Revenue: BillingChartQuery (current data)
  → GP: BillingChartQuery JOIN ARInvoiceItem (WHERE Total_UnitCost > 0)
  → CRM: /salesforce/accounts + /salesforce/opportunities
  → AR: /ascend/ar/aging

Fleet/Operations?
  → Vehicles: /samsara/vehicles
  → Live GPS: /samsara/locations
  → Drivers: /samsara/drivers
  → Equipment: /ascend/equipment + /ascend/tanks

Vendor/AP?
  → Spend by vendor: vPurchaseJournal (Ascend SQL)
  → POs: /vroozi/purchase-orders
  → Suppliers: /vroozi/suppliers + /ascend/vendors

Documents?
  → SharePoint search: /microsoft/search?q=
  → Reports: /powerbi/reports
```
