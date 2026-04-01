# Ascend ERP — Complete Table Map to Delta Intelligence

**Total Ascend Tables: 5,105** (299 AR, 144 Inventory, 94 Delta Custom, 684 Views, 53 Tax, 48 GL, 33 BOL, 29 Equipment, 28 Products, 27 AP, 21 Fleet, 18 Users, 11 Drivers, 10 Addresses, 9 Sites, 7 PBI Views, 6 JE, 6 Contracts, 3,577 Other)

## Tier 1: Tables We Query NOW (via gateway, live data flowing)

| Ascend Table | Gateway Endpoint | DI Engine | What It Powers |
|---|---|---|---|
| **DF_PBI_IncomeStatementData** | /ascend/query (SQL) | Dashboard, Financial Statements | Revenue YTD ($44.1M), COGS ($36.5M), GP ($7.6M), GP by month charts |
| **DF_PBI_BillingChartQuery** | /ascend/query (SQL) | Dashboard, Inventory/Margin | Top customers by GP, revenue by customer, gallons by month |
| **ARInvoice** | /ascend/query (SQL) | AR Collections, Dashboard | AR aging, AR 90+, invoice counts, recent invoices |
| **ARInvoiceItem** | /ascend/query (SQL) | Inventory/Margin | Line-level billing: Qty * UnitPrice = Revenue, Qty * Total_UnitCost = COGS |
| **vFSWWBalCOA** | /ascend/gl/trial-balance | General Ledger, Financial Statements | Trial balance, balance sheet, P&L by profit center |
| **vRackPrice** | /ascend/query (SQL) | Dashboard, Operations | Today's rack price (Diesel Dyed), pricing trends |
| **Address** | /ascend/customers | AR Collections, Customer 360 | Customer master list |
| **Equipment** | /ascend/equipment | Fixed Assets | Equipment register, types, status |
| **EquipShipTo** | /ascend/tanks/assignments | Equipment Tracker | Tank-to-customer assignments |
| **EquipType** | /ascend/equipment | Fixed Assets | Equipment categories (tanks, vehicles, etc.) |
| **JournalEntryHeader** | /ascend/gl/journal-entries | Journal Entry Engine | Posted JEs with user, date, period |
| **JournalEntryLine** | /ascend/gl/journal-entries | Journal Entry Engine | JE line detail: account, debit, credit |
| **vPurchaseJournal** | /ascend/ap/purchases | AP Processing | Vendor purchases, AP detail |
| **Tax** | /ascend/taxes | Tax Engine | Tax codes, rates, authorities |
| **TaxRate** | /ascend/taxes/rates | Tax Engine | Rate history by tax ID |
| **TaxAuthority** | /ascend/taxes/authorities | Tax Engine | Tax jurisdictions |
| **ARInvoiceItemCompTax** | /ascend/taxes/collected | Tax Engine | Tax collected per invoice |
| **INSite** | /ascend/sites | Operations | Site locations, GPS coordinates, GL mapping |
| **vINSiteProdCont_GL** | /ascend/sites/gl-mapping | General Ledger | Site → GL account mapping (Sales, COGS, Inventory) |

## Tier 2: Tables We Should Query Next (high value, gateway endpoints exist)

| Ascend Table | Gateway Endpoint | DI Engine | Value |
|---|---|---|---|
| **ARAccountAlert** | /ascend/ar/aging | AR Collections | Customer alerts, credit flags |
| **ARCreditLimit** | Needs endpoint | AR Collections | Credit limit per customer |
| **ARCollectionCall** | Needs endpoint | AR Collections | Collection call history |
| **AP_ParentVendor** | /ascend/vendors | AP Processing | Vendor hierarchy |
| **APInvoiceStatus** | Needs endpoint | AP Processing | AP invoice workflow status |
| **GLDivisions** | /ascend/profit-centers | General Ledger | Profit center definitions |
| **DF_PBI_DS_SalesAndProfitAnalysis** | Needs endpoint | Sales Console | Sales + profit combined view |
| **DF_PBI_Inventory_StockStatus** | Needs endpoint | Inventory/Margin | Current inventory levels |
| **Drivers** | /ascend/query | Operations | Driver master (cross-ref with Samsara) |
| **Vehicle** | /ascend/query | Fleet | Vehicle master (cross-ref with Samsara) |
| **Trailer** | /ascend/query | Fleet | Trailer data |
| **BOLHdr** / **BOLItem** | Needs endpoint | Operations | Bill of lading (delivery records) |
| **ContractProdGrp** | Needs endpoint | Contracts | Fuel supply contracts |

## Tier 3: Tables for Full ERP Build (migrate to Supabase)

### GL & Financial Reporting
| Table | Rows (est.) | Use |
|---|---|---|
| GL | ~2M | Full GL transaction history |
| GLCode / GLCodeAudit | ~500 | Chart of accounts with audit |
| GLDivisions | ~20 | Profit center definitions |
| GLMacroSub | ~100 | GL macro substitution (site→PC mapping) |
| GLBankFileCreation | Varies | Bank file exports |
| JournalEntryHeader | ~50K | All posted JEs |
| JournalEntryLine | ~500K | JE line items |
| Journal_Entry_Posted | ~50K | Posted JE index |
| vFSWWBalCOA | View | Trial balance/financial statement view |
| DF_PBI_IncomeStatementData | View | Income statement for Power BI |

### Accounts Receivable (299 tables — key ones)
| Table | Use |
|---|---|
| ARInvoice | Invoice header: customer, date, amount, status, still due |
| ARInvoiceItem | Invoice lines: product, qty, price, cost, tax |
| ARInvHdrCost | Invoice header costs (freight, surcharges) |
| ARCreditLimit | Customer credit limits |
| ARCollectionCall + _Audit | Collection activity history |
| ARAccountAlert | Customer alerts/flags |
| ARFinanceCharge | Finance charge calculations |
| ARBankDeposit | Payment deposits |
| ARShipTo | Ship-to locations (Code = 3-digit ShipTo code) |
| ARClass1-5 | Customer classification dimensions |

### Accounts Payable (27 tables)
| Table | Use |
|---|---|
| APInvoiceStatus | AP invoice tracking |
| APRules | AP processing rules |
| APEFT / APEFTLog | Electronic payment tracking |
| APCheckFormat | Check printing |
| APPeriod | AP period management |
| APInterCompanyPayableAcct | Intercompany AP |
| APInv_Tax | AP invoice tax detail |

### Inventory (144 tables — key ones)
| Table | Use |
|---|---|
| INSite | Storage/delivery sites with GPS |
| INSiteInventory | Current inventory by site |
| INProduct | Product master |
| INProdCont | Product/container (delivery unit) |
| INAdjustmentItem | Inventory adjustments |
| INPriceHistory | Historical pricing |
| INTransferItem | Inventory transfers between sites |
| INGainLoss | Inventory gain/loss tracking |

### Tax (53 tables — key ones)
| Table | Use |
|---|---|
| Tax | Tax code definitions |
| TaxRate | Rate schedules |
| TaxAuthority | Jurisdictions |
| TaxProfile | Customer tax profiles |
| TaxExempt | Exemption certificates |
| TaxAccrued | Accrued tax liability |
| ProdTaxGroup | Product tax groups |

### Equipment & Fleet
| Table | Use |
|---|---|
| Equipment | Master equipment register |
| EquipType | Equipment type categories |
| EquipShipTo | Equipment-to-customer assignments |
| EquipAttrib / EquipAttribValue | Custom equipment attributes |
| EquipComponent | Sub-components |
| Vehicle / VehicleAttrib | Vehicle master |
| Trailer / TrailerAttrib | Trailer master |
| Drivers / DriverPayPlan | Driver records and pay |

### BOL & Dispatch (33 tables)
| Table | Use |
|---|---|
| BOLHdr | Bill of lading header (delivery record) |
| BOLItem | BOL line items |
| BOLHdrCost | Delivery costs |
| AI_BOLOrder | Automated BOL orders |
| DispatchSchedule (if exists) | Delivery scheduling |

## Pruning Strategy: 5,105 → ~80 Active Tables

| Category | Total | Keep Active | Archive | Drop |
|---|---|---|---|---|
| AR | 299 | 15 | 10 | 274 (audit/temp/history) |
| GL | 48 | 10 | 5 | 33 |
| Inventory | 144 | 12 | 5 | 127 |
| AP | 27 | 8 | 3 | 16 |
| Tax | 53 | 8 | 3 | 42 |
| Equipment | 29 | 8 | 2 | 19 |
| Fleet | 21 | 6 | 2 | 13 |
| Drivers | 11 | 3 | 1 | 7 |
| BOL/Dispatch | 33 | 5 | 3 | 25 |
| PBI Views | 7 | 7 | 0 | 0 |
| Delta Custom | 94 | 10 | 5 | 79 |
| Other | 3,577 | ~8 (sites, products, addresses, contracts) | 0 | ~3,569 |
| **Total** | **5,105** | **~100** | **~39** | **~4,966** |

## Data Flow: Ascend → DI (Current Live Path)

```
Ascend SQL Server (VPN)
    │
    ├── Gateway (localhost:3847) — 43 read-only endpoints
    │   ├── Pre-built: /ascend/ar/aging, /ascend/customers, /ascend/gl/*, etc.
    │   └── Ad-hoc: POST /ascend/query { sql: "SELECT ..." }
    │
    ├── Data Bridge (src/lib/engines/data-bridge.ts) — 5-min cache
    │   ├── fetchTrialBalance(period) → vFSWWBalCOA
    │   ├── fetchARAging() → /ascend/ar/aging
    │   ├── fetchRevenueByPeriod(year) → DF_PBI_IncomeStatementData
    │   ├── fetchCOGSByPeriod(year) → DF_PBI_IncomeStatementData
    │   ├── fetchCashPosition() → vFSWWBalCOA (10100, 25100)
    │   ├── fetchEquipment() → Equipment + EquipType
    │   ├── fetchCustomers() → Address (customer view)
    │   ├── fetchVendors() → /vroozi/suppliers
    │   └── fetchRackPrice() → vRackPrice
    │
    └── 17 Engine Modules → 88 API Routes → 54 Pages
```

## Timeline: Ascend → Supabase Migration

| Phase | What | When | Impact |
|---|---|---|---|
| **Now** | Read from Ascend via gateway | Active | All dashboards + engines have live data |
| **Next** | Deploy Supabase 24-table schema | Next session | Cloud persistence, multi-user, RLS |
| **Phase 2** | Sync Ascend → Supabase (incremental ETL) | Week 2 | Data lives in both systems |
| **Phase 3** | DI writes to own Supabase GL | Week 3 | JEs post to DI's ledger |
| **Phase 4** | Ascend becomes read-only archive | Month 2 | DI is the primary financial system |
| **Phase 5** | Evaluate Ascend replacement | Month 3+ | Keep for fuel dispatch or replace entirely |
