# Delta Intelligence System — Data Mappings

**Last Updated:** 2026-03-31

Field-level mappings from every source system to Delta Intelligence target schemas. This is the definitive reference for building parsers, ETL pipelines, and integration logic.

---

## Ascend → Delta Intelligence

### GL Transactions

| Ascend Field | Type | → Delta Field | Target Table | Notes |
|-------------|------|--------------|-------------|-------|
| TransactionID | INT | transaction_id | journal_entries | PK |
| JournalEntryNo | VARCHAR | je_number | journal_entries | Human-readable |
| TransactionDate | DATETIME | transaction_date | journal_entries | |
| PostDate | DATETIME | post_date | journal_entries | Flag if PostDate >> TransactionDate (late-posted) |
| AccountNo | VARCHAR | account_number | journal_entries | Maps to accounts.standard_acct_no |
| AccountDescription | VARCHAR | account_name | journal_entries | |
| DebitAmount | MONEY | debit | journal_entries | NUMERIC(19,4) in PG |
| CreditAmount | MONEY | credit | journal_entries | NUMERIC(19,4) in PG |
| Description | VARCHAR | description | journal_entries | JE line memo |
| Reference | VARCHAR | reference | journal_entries | Source document |
| CreatedBy | VARCHAR | created_by | journal_entries | User who posted |
| CompanyID | INT | entity_id | journal_entries | Multi-entity support |
| DepartmentCode | VARCHAR | cost_center | journal_entries | Maps to department hierarchy |
| ProfitCenterID | INT | profit_center_id | journal_entries | Division tracking |
| SourceModule | VARCHAR | source | journal_entries | AP, AR, GL, INV, etc. |

### Chart of Accounts

| Ascend Field | Type | → Delta Field | Target Table | Notes |
|-------------|------|--------------|-------------|-------|
| StandardAcctNo | VARCHAR | standard_acct_no | accounts | Unique account identifier |
| AccountDescription | VARCHAR | name | accounts | |
| AccountType | VARCHAR | account_type | accounts | Asset, Liability, Equity, Revenue, Expense |
| NormalBalance | VARCHAR | normal_balance | accounts | Debit or Credit |
| ParentAccountNo | VARCHAR | parent_account | accounts | Hierarchy for rollups |
| IsActive | BIT | is_active | accounts | |
| CompanyID | INT | entity_id | accounts | Multi-entity |
| StatementGroup | VARCHAR | fs_line | accounts | IS, BS, CF mapping |
| SubGroup | VARCHAR | fs_subgroup | accounts | Sub-classification |

### Equipment / Fixed Assets

| Ascend Field | Type | → Delta Field | Target Table | Notes |
|-------------|------|--------------|-------------|-------|
| EquipmentId | INT | equipment_id | fixed_assets | PK |
| Code | VARCHAR | asset_code | fixed_assets | Human-readable code |
| standardAcctNo | VARCHAR | gl_account | fixed_assets | Maps to accounts |
| Description | VARCHAR | description | fixed_assets | |
| EquipmentTypeId | INT | asset_type_id | fixed_assets | Tank, Vehicle, etc. |
| CompanyId | INT | entity_id | fixed_assets | |
| Active | CHAR(1) | is_active | fixed_assets | Y/N |
| OwnerShip | CHAR(1) | ownership_type | fixed_assets | C=Company, L=Leased |
| ActualTankSize | DECIMAL | capacity | fixed_assets | For propane tanks |
| RatedTankSize | DECIMAL | rated_capacity | fixed_assets | |
| Latitude | DECIMAL | latitude | fixed_assets | GPS for map |
| Longitude | DECIMAL | longitude | fixed_assets | |
| Barcode | VARCHAR | barcode | fixed_assets | Physical tracking |
| LastModifiedBy | VARCHAR | last_modified_by | fixed_assets | Audit trail |
| LastModifiedDate | DATETIME | last_modified_at | fixed_assets | |

**Cross-reference:** EquipmentId → Samsara Vehicle ID mapping needed. The `FormattedEquipCode` field (e.g., "40197/40197") and `AttribValues` contain additional identifiers.

---

## Paylocity → Delta Intelligence

### Pay Register

| Paylocity Field | Type | → Delta Field | Target Table | JE Family |
|----------------|------|--------------|-------------|-----------|
| EmployeeId | VARCHAR | employee_id | payroll_data | — |
| EmployeeName | VARCHAR | employee_name | payroll_data | — |
| PayPeriodStart | DATE | period_start | payroll_data | — |
| PayPeriodEnd | DATE | period_end | payroll_data | — |
| DepartmentCode | VARCHAR | cost_center | payroll_data | Maps to GL dept |
| RegularHours | DECIMAL | regular_hours | payroll_data | — |
| OvertimeHours | DECIMAL | overtime_hours | payroll_data | — |
| GrossPay | DECIMAL | gross_pay | payroll_data | Family 2: Debit |
| FederalTax | DECIMAL | federal_tax | payroll_data | Family 6 |
| StateTax | DECIMAL | state_tax | payroll_data | Family 6 |
| SocialSecurity | DECIMAL | fica_ss | payroll_data | Family 2 |
| Medicare | DECIMAL | fica_med | payroll_data | Family 2 |
| HealthInsurance | DECIMAL | health_ins | payroll_data | Family 5 |
| HSAContribution | DECIMAL | hsa_contrib | payroll_data | Family 5: Acct 22630 |
| RetirementContrib | DECIMAL | retirement | payroll_data | Family 2 |
| NetPay | DECIMAL | net_pay | payroll_data | Family 2: Credit |

### Payroll Accrual JE Generation (Family 2)

```
DEBIT:  Salary Expense (by dept)     = SUM(GrossPay) by DepartmentCode
DEBIT:  FICA Expense                 = SUM(fica_ss + fica_med) employer portion
DEBIT:  Benefits Expense             = SUM(health_ins + hsa_contrib) employer portion
CREDIT: Accrued Payroll              = SUM(NetPay)
CREDIT: Payroll Tax Payable          = SUM(federal_tax + state_tax + fica)
CREDIT: Benefits Payable             = SUM(health_ins + hsa_contrib)
CREDIT: HSA Liability (22630)        = SUM(hsa_contrib)
```

---

## Vroozi → Delta Intelligence

### AP Invoices

| Vroozi Field | Type | → Delta Field | Target Table | Notes |
|-------------|------|--------------|-------------|-------|
| InvoiceNumber | VARCHAR | invoice_number | ap_invoices | PK |
| VendorId | VARCHAR | vendor_id | ap_invoices | |
| VendorName | VARCHAR | vendor_name | ap_invoices | |
| InvoiceDate | DATE | invoice_date | ap_invoices | |
| DueDate | DATE | due_date | ap_invoices | Aging calculation |
| TotalAmount | DECIMAL | total_amount | ap_invoices | |
| Currency | VARCHAR | currency | ap_invoices | USD default |
| Status | VARCHAR | status | ap_invoices | Pending, Approved, Paid |
| PONumber | VARCHAR | po_number | ap_invoices | 3-way match key |
| GLAccount | VARCHAR | gl_account | ap_invoice_lines | Auto-coded or manual |
| LineDescription | VARCHAR | line_description | ap_invoice_lines | |
| LineAmount | DECIMAL | line_amount | ap_invoice_lines | |
| Quantity | DECIMAL | quantity | ap_invoice_lines | Receipt match |
| UnitPrice | DECIMAL | unit_price | ap_invoice_lines | Price match |
| CodingConfidence | DECIMAL | coding_confidence | ap_invoice_lines | AI auto-code score |
| ApproverName | VARCHAR | approver | ap_invoices | Workflow tracking |
| ApprovalDate | DATETIME | approved_at | ap_invoices | Touch-time calc |
| SubmitDate | DATETIME | submitted_at | ap_invoices | Touch-time calc |

**Touch-time calculation:** `touch_time = approved_at - submitted_at` (target: >30% reduction)
**Auto-code metric:** `auto_coded_pct = COUNT(coding_confidence > 0.8) / COUNT(*)` (target: >50%)

---

## StoneX → Delta Intelligence

### Hedging Statement

| StoneX Field | Type | → Delta Field | Target Table | Key Account |
|-------------|------|--------------|-------------|------------|
| ContractId | VARCHAR | contract_id | hedging_positions | — |
| ContractType | VARCHAR | contract_type | hedging_positions | Future, Option, Swap |
| Commodity | VARCHAR | commodity | hedging_positions | Propane, Diesel, etc. |
| TradeDate | DATE | trade_date | hedging_positions | — |
| ExpirationDate | DATE | expiration_date | hedging_positions | — |
| Volume | DECIMAL | volume | hedging_positions | Gallons/Barrels |
| StrikePrice | DECIMAL | strike_price | hedging_positions | — |
| CurrentPrice | DECIMAL | market_price | hedging_positions | Mark-to-market |
| RealizedGainLoss | DECIMAL | realized_pl | hedging_realized | 80200 |
| UnrealizedGainLoss | DECIMAL | unrealized_pl | hedging_unrealized | 80200 |
| Commission | DECIMAL | commission | hedging_commissions | 68115 |
| BrokerAccount | VARCHAR | broker_account | hedging_positions | 10345 |

### Hedging JE Generation (Family 4)

```
Mark-to-Market:
  DEBIT/CREDIT: Hedging Gain/Loss (80200) = net unrealized P&L change
  CREDIT/DEBIT: Hedge Asset/Liability      = offsetting entry

Realized Settlement:
  DEBIT:  Cash / Broker Account (10345)    = settlement amount
  CREDIT: Hedging Gain/Loss (80200)        = realized gain
  -- or reverse for realized loss --

Commissions:
  DEBIT:  Commission Expense (68115)       = commission amount
  CREDIT: Broker Account (10345)           = paid from broker balance
```

---

## JPMorgan → Delta Intelligence

### Bank Statement (BAI2 Format)

| BAI2 Field | Type | → Delta Field | Target Table | Notes |
|-----------|------|--------------|-------------|-------|
| AccountNumber | VARCHAR | bank_account | bank_transactions | |
| TransactionDate | DATE | transaction_date | bank_transactions | |
| Amount | DECIMAL | amount | bank_transactions | +credits, -debits |
| TypeCode | VARCHAR | transaction_type | bank_transactions | BAI2 code → human-readable |
| CustomerRef | VARCHAR | reference | bank_transactions | Check no., wire ref |
| BankRef | VARCHAR | bank_reference | bank_transactions | Bank's internal ref |
| Description | VARCHAR | description | bank_transactions | |
| AvailableBalance | DECIMAL | available_balance | bank_balances | End of day |
| LedgerBalance | DECIMAL | ledger_balance | bank_balances | |

### Bank Reconciliation Matching

```
GL Cash Balance (from Ascend)
  + Outstanding Deposits (in GL, not in bank)
  - Outstanding Checks (in GL, not in bank)
  ± Bank Adjustments (in bank, not in GL)
  = Bank Statement Balance

Tolerance: $1.00 (from controls framework)
```

---

## Samsara → Delta Intelligence

### Vehicle Data (REST API)

| Samsara Endpoint | Field | → Delta Field | Target Table |
|-----------------|-------|--------------|-------------|
| /fleet/vehicles | id | samsara_vehicle_id | fleet_vehicles |
| /fleet/vehicles | name | vehicle_name | fleet_vehicles |
| /fleet/vehicles | vin | vin | fleet_vehicles |
| /fleet/vehicles | make | make | fleet_vehicles |
| /fleet/vehicles | model | model | fleet_vehicles |
| /fleet/vehicles | year | year | fleet_vehicles |
| /fleet/vehicles | licensePlate | license_plate | fleet_vehicles |
| /fleet/vehicles/locations | latitude | latitude | gps_readings (TimescaleDB) |
| /fleet/vehicles/locations | longitude | longitude | gps_readings |
| /fleet/vehicles/locations | speed | speed_mph | gps_readings |
| /fleet/vehicles/locations | heading | heading | gps_readings |
| /fleet/vehicles/locations | time | recorded_at | gps_readings |
| /fleet/vehicles/stats | odometerMeters | odometer_miles | engine_readings |
| /fleet/vehicles/stats | engineHours | engine_hours | engine_readings |
| /fleet/vehicles/stats | fuelPercent | fuel_pct | engine_readings |
| /fleet/vehicles/stats | batteryMillivolts | battery_mv | engine_readings |

**Cross-reference table needed:**
| samsara_vehicle_id | ascend_equipment_id | ascend_code | gl_account |
|-------------------|--------------------|-----------|-----------|
| 281474985529450 | ? | BF-186 | 17200 (Vehicles) |
| 281474985529444 | ? | BF-191 | 17200 |

---

## Salesforce → Delta Intelligence

### Key Object Mappings

#### Account → Customer Node (Neo4j) + AR Module

| SF Field | Type | → Delta Field | Target | Notes |
|---------|------|--------------|--------|-------|
| Id | ID | sf_account_id | customers, Account node | PK |
| Name | STRING | customer_name | customers, Account node | |
| BillingAddress | ADDRESS | billing_address | customers | |
| Phone | PHONE | phone | customers | |
| Industry | STRING | industry | Account node property | |
| AnnualRevenue | CURRENCY | annual_revenue | Account node property | Credit scoring input |
| NumberOfEmployees | INT | employee_count | Account node property | |
| OwnerId | ID | sales_rep_id | customers | Maps to User |
| Type | PICKLIST | account_type | customers | Customer, Prospect, Vendor |
| Credit_Limit__c | CURRENCY | credit_limit | ar_credit | If custom field exists |

#### Opportunity → Revenue Forecast

| SF Field | Type | → Delta Field | Target | Notes |
|---------|------|--------------|--------|-------|
| Id | ID | sf_opportunity_id | pipeline | |
| Name | STRING | deal_name | pipeline | |
| Amount | CURRENCY | deal_amount | pipeline | Flash report input |
| StageName | STRING | stage | pipeline | |
| CloseDate | DATE | expected_close | pipeline | |
| Probability | PERCENT | probability | pipeline | Weighted pipeline |
| AccountId | ID | sf_account_id | pipeline | Links to customer |

#### Credit_Application__c → AR/Credit Module

| SF Field | Type | → Delta Field | Target | Notes |
|---------|------|--------------|--------|-------|
| Id | ID | sf_credit_app_id | credit_applications | |
| Account__c | LOOKUP | sf_account_id | credit_applications | |
| Requested_Amount__c | CURRENCY | requested_limit | credit_applications | |
| Status__c | PICKLIST | status | credit_applications | |
| DNB_Score__c | NUMBER | credit_score | credit_applications | From D&B integration |
| Decision_Date__c | DATE | decision_date | credit_applications | |

---

## Mapping Gaps Requiring User Input

| # | Gap | Who Can Answer | Priority |
|---|-----|---------------|----------|
| 1 | Ascend Department Codes → GL Account mapping table | Taylor/Lea | High |
| 2 | Paylocity benefit plan codes → GL codes | Lea | High |
| 3 | Tax jurisdiction codes → tax account structure | Bill Didsbury | High |
| 4 | Samsara Vehicle ID → Ascend Equipment ID crosswalk | Brad Vencil | Medium |
| 5 | Vroozi GL coding rules (what determines auto-code) | Taylor/Lea | High |
| 6 | StoneX statement format (PDF vs CSV, field layout) | Taylor | Medium |
| 7 | JPM BAI2 vs CSV — which format does JPM Access export? | Taylor | Medium |
| 8 | Salesforce custom field names for credit limit, territory | Robert Stewart | Low |
| 9 | Overhead allocation methodology (% by dept, revenue, headcount?) | Taylor | Medium |
| 10 | Interest allocation — which notes payable, rates, terms | Taylor/Mike | Medium |
| 11 | Inventory reserve calculation methodology | Taylor | Medium |
| 12 | Ascend EquipmentTypeId → asset category mapping | Lea | Low |
