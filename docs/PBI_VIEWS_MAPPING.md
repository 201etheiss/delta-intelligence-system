# Power BI Views → Delta Intelligence Engine Mapping

## 101 Delta Custom Views/Tables in Ascend

These are the curated, analytics-ready data views that Power BI currently uses. We map them directly into DI engines instead of rebuilding from raw tables.

## Core PBI Views (7) — Already Powering DI Dashboards

### 1. DF_PBI_IncomeStatementData (VIEW)
**DI Engine:** Dashboard KPIs, Financial Statements, Daily Brief
**Columns:** AccountGroup, Account_Desc, Section, Period, Year_For_Period, Period_Balance, Budget_1, Period_Units, Class_Id1, Class_Id2
**Key Queries:**
- Revenue YTD: `WHERE AccountGroup='Revenue' AND Period BETWEEN 1 AND 12`
- COGS: `WHERE AccountGroup='Gross margin' AND Period BETWEEN 1 AND 12`
- GP = Revenue - COGS
- Budget comparison: Budget_1 column has budget amounts per period
- **NEW: Budget vs Actual** — Use `Budget_1` field for BvA variance in Budgets engine

### 2. DF_PBI_BillingChartQuery (VIEW)
**DI Engine:** Inventory/Margin, Top Customers, Revenue by Customer
**Columns:** SysTrxNo, CustomerName, InvoiceDt, Period, Year, Posted, Salesperson, SalespersonEmail, source, ShipToDescr, Latitude, Longitude, Carrier
**Key Joins:** JOIN ARInvoiceItem ON SysTrxNo for line-level Qty, UnitPrice, Total_UnitCost
**Key Queries:**
- Top customers by GP: GROUP BY CustomerName, SUM(Qty * (UnitPrice - Total_UnitCost))
- Revenue by month: GROUP BY Period, SUM(Qty * UnitPrice)
- Gallons by month: GROUP BY Period, SUM(Qty)
- **NEW: Sales by Salesperson** — Salesperson + SalespersonEmail fields enable rep-level analytics for Sales Scorecard integration

### 3. DF_PBI_DS_SalesAndProfitAnalysis (TABLE)
**DI Engine:** Sales Console, Inventory/Margin, Operations
**Columns:** 85+ columns — the most comprehensive view. Includes: CustomerName, UnitPrice, Qty, UnitCost, ItemTaxes, SalesPerson, ProductCode, SiteCode, DriverName, BOLNo, DelivQty, VehicleCode, EquipCode, GLMacroSub (profit center), PostingPeriod
**This is the master analytics table.** Every dimension: customer, product, site, driver, vehicle, equipment, salesperson, profit center, carrier.
**Key Queries:**
- Margin by product: GROUP BY MasterProdDescr, SUM(Qty * UnitPrice), SUM(Qty * UnitCost)
- Margin by division: GROUP BY GLMacroSub (first 4 chars = profit center)
- Margin by customer: GROUP BY CustomerName
- Margin by salesperson: GROUP BY SalesPerson
- Volume by driver: GROUP BY DriverName, SUM(DelivQty)
- Volume by vehicle: GROUP BY VehicleCode, SUM(DelivQty)
- **NEW: This single table replaces 5+ separate queries in the dashboard**

### 4. DF_PBI_Inventory_StockStatus (TABLE)
**DI Engine:** Inventory/Margin
**Columns:** SiteCode, ProdCode, ProdDescr, BeginningQty, EndingQty, EndingAmt, ReceiptQty, SalesQty, Wac (weighted avg cost), CostMethod, VehicleCode
**Key Queries:**
- Current inventory by site: WHERE DateRangeorPeriod = 'current'
- Inventory value: SUM(EndingAmt)
- Stock movement: BeginningQty → Receipts → Sales → EndingQty

### 5. DF_PBI_BillingChartQuery_NoCRRB (VIEW)
**DI Engine:** Revenue analytics (excludes credit/rebill transactions)
**Use:** Clean revenue figures without credit memo distortion

### 6. DF_PBI_InvoicesNotPrinted (VIEW)
**DI Engine:** Operations Console
**Use:** Flag invoices that haven't been printed/sent

### 7. DF_PBI_vOpenOrdersOutofGPCompliance (VIEW)
**DI Engine:** Sales Console, Margin Analytics
**Use:** Orders with GP below compliance threshold — needs management review

## Key Delta Custom Views for DI Engines

### Financial
| View | DI Engine | Value |
|------|-----------|-------|
| DF_vPBI_GPvExp_GL | Financial Statements | GP vs Expenses at GL level |
| DF_vPBI_GPvExp_Invoices | Margin Analytics | GP vs Expenses at invoice level |
| DF_vPBI_GPvExp_OpenOrders | Sales Console | GP compliance on open orders |
| DF_ARInvoiceGPTotal | AR Collections | Invoice GP totals with payment status |
| DF_vARInvoiceItemGPTotal | Margin Analytics | Line-item GP detail |
| DF_COGSandOrders | Inventory/Margin | COGS linked to orders |
| DF_ARATB_Historical | Financial Statements | Historical AR trial balance |
| DF_StandardAcct_CreditProfile | AR Collections | Account credit profiles |

### Operations & Dispatch
| View | DI Engine | Value |
|------|-----------|-------|
| DF_SalesandOrders | Operations Console | Combined sales + orders view |
| DF_OrdersView | Operations Console | Order status tracking |
| DF_vOpenOrders | Operations Console | Current open orders |
| DF_vDeliveryTicketRpt | Operations Console | Delivery ticket detail |
| DF_ShipToEquipmentDetails | Equipment Tracker | Ship-to with equipment assignments |
| DF_vShipToEquipTankDetails | Equipment Tracker | Tank-level details per ship-to |
| DF_vMasterSiteAddress | Operations Console | Site master with addresses |

### AP/Vroozi Integration (20+ views)
| View | DI Engine | Value |
|------|-----------|-------|
| DF_Vroozi_APInvoices | AP Processing | AP invoices from Vroozi |
| DF_Vroozi_APInvoiceBurndown | AP Processing | AP burndown tracking |
| DF_Vroozi_Vendors | AP Processing | Vendor master from Vroozi |
| DF_Vroozi_GLAccts | General Ledger | GL accounts for Vroozi |
| DF_Vroozi_InvoicePaymentsv2 | AP Processing | Payment detail |
| DF_PA_ImportAPInvoice | AP Processing | AP invoice import staging |
| DF_PA_PayClearly_ApprovalList | AP Processing | Payment approval queue |

### Customer & Sales
| View | DI Engine | Value |
|------|-----------|-------|
| DF_PDS_CustomerMaster | Customer 360, AR | Complete customer master (Code, Name, DBA, CreditStatus, Active, Region, Manager) |
| DF_vFuelPriceArea | Pricing/Margin | Fuel pricing by area |
| DF_vProduct | Inventory/Margin | Product master |
| DF_SupplierTerminalLoadNumbers | Operations | Terminal load tracking |

## Budget Data Discovery

**DF_PBI_IncomeStatementData has a `Budget_1` column** — this means Ascend already has budgets loaded per account per period. We can pull Budget vs Actual directly:

```sql
SELECT
  Account_Desc,
  AccountGroup,
  Period,
  SUM(ABS(Period_Balance)) AS Actual,
  SUM(ABS(Budget_1)) AS Budget,
  SUM(ABS(Period_Balance)) - SUM(ABS(Budget_1)) AS Variance
FROM DF_PBI_IncomeStatementData
WHERE Year_For_Period = 2026
  AND Period BETWEEN 1 AND 12
GROUP BY Account_Desc, AccountGroup, Period
HAVING ABS(SUM(ABS(Period_Balance)) - SUM(ABS(Budget_1))) > 0
ORDER BY AccountGroup, Account_Desc, Period
```

This eliminates the need for Taylor to manually maintain budget spreadsheets — the data is already in Ascend.

## Migration Priority

### Use As-Is (query via gateway, no migration needed)
All 7 PBI views + DF_PBI_DS_SalesAndProfitAnalysis — these are live views that auto-update when Ascend data changes.

### Wire New Gateway Endpoints For
1. `/ascend/pbi/sales-profit` → DF_PBI_DS_SalesAndProfitAnalysis (the 85-column analytics table)
2. `/ascend/pbi/inventory` → DF_PBI_Inventory_StockStatus
3. `/ascend/pbi/gp-compliance` → DF_PBI_vOpenOrdersOutofGPCompliance
4. `/ascend/pbi/budget-vs-actual` → DF_PBI_IncomeStatementData with Budget_1
5. `/ascend/pbi/customer-master` → DF_PDS_CustomerMaster
6. `/ascend/vroozi/invoices` → DF_Vroozi_APInvoices
7. `/ascend/vroozi/payments` → DF_Vroozi_InvoicePaymentsv2
