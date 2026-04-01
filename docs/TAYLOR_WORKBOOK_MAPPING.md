# Taylor's Workbooks → DI Engine Mapping

## Master Financial Workbook (Delta360_Financial_Workbook_V4.xlsx)

### What Taylor Does Monthly (Manual Process)
1. Downloads latest month's trial balance from Ascend
2. Manually inputs TB data into workbook
3. Rolls forward columns and formulas
4. Updates Income Statement, Balance Sheet, Statement of Cash Flows
5. Updates TB mapping tab
6. Reviews consolidated + profit center level actuals vs prior month

### What DI Replaces This With
1. `/api/financial-statements?type=trial-balance&period=2026-03` — auto-pulls TB from Ascend
2. `/api/financial-statements?type=income-statement&period=2026-03` — generates IS from GL
3. `/api/financial-statements?type=balance-sheet&period=2026-03` — generates BS from GL
4. `/api/financial-statements?type=flash&period=2026-03` — executive flash report
5. `/api/financial-statements?type=variance&period=2026-03` — MTD vs prior MTD variance
6. All auto-refreshed from live Ascend data — no manual input

## FAP Asset Matching (2025 FAP Rollforward.xlsx + FAP ops overlay)

### Taylor's Task
Match assets in FAP sub-ledger to Ascend GL journal entries.
No unique ID between systems. Match by: cost, date, vendor, description.
Output: matched pairs with confidence level.

### DI Implementation
1. Upload FAP files via /api/upload (XLSX extraction built in)
2. Pull GL JEs from Ascend: /ascend/query with JE detail for fixed asset accounts (17xxx)
3. AI chat fuzzy-matches: cost ±$1, date ±7 days, vendor name similarity
4. Output confidence: exact match (100%), near match (75-99%), possible (50-74%), unmatched (<50%)

## Other Workbook Mappings

| Workbook | DI Engine | Auto-Replaces |
|----------|-----------|---------------|
| GL Review | General Ledger + Reconciliation | Manual GL review process |
| Analytical Review | Financial Statements (variance tab) | Manual analytical review |
| DSO/AR Analysis | AR Collections engine | Manual DSO calculation |
| Equity Roll-Forward | GL engine (equity accounts) | Manual equity tracking |
| Commission Accrual | JE Engine (payroll family, template #44) | Manual accrual JE |
| Tax Overview + Master | Tax engine | Manual tax provision |
| Fixed Asset Roll-Forward | Fixed Assets engine | Manual depreciation schedule |
| PJ Lease Analysis | AP Processing engine | Manual lease/AP analysis |
| Bank Budget | Cash Flow engine | Manual cash forecast |
| Site/PC Mapping | GL engine (profit center structure) | Manual PC reference |
| Tank/Site Registry | Equipment Tracker (external app) | Already built |
| Units/Customers | AR Collections + Customer 360 | Manual customer data |

## Integration Priority
1. Financial Workbook V4 → Financial Statements engine (highest daily value)
2. FAP files → Fixed Assets engine (audit compliance)
3. Commission Accrual → JE Engine template (recurring monthly)
4. Bank Budget → Cash Flow engine (weekly process)
5. Tax Master → Tax engine (quarterly/annual)
