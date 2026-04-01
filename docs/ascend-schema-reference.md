# Ascend ERP — Complete Table Schema Reference

Source: DXImportFormats 4.xlsx (272 sheets, 271 tables, 4,704 columns)
Generated: 2026-04-01

---

## Categories

| Category | Tables | Key Tables |
|----------|--------|------------|
| **Uncategorized** | 8 | AP Invoice, AP Job Cost Component, AP Job Cost Job... |
| **Accounts Receivable** | 74 | Account Pricing Group Adjustment, AR Billing Item, AR Collection Call... |
| **Cardlock** | 32 | Cardlock Account, CL Account Aggregate Discount, CL Account Contract Pricing... |
| **Consigned Station** | 12 | CS2 Comssion, CS2 Commsion History, CS2 Fuel Price... |
| **Contracts** | 22 | CN Block Sales Contract, CN Block Sales Contract Products, CN Purchase Contract... |
| **Degree Day** | 12 | DD Account, DD Account Document Delivery, DD Daily Log Entry... |
| **Fuel Supplier** | 33 | FS eBOL, FS eBOL DFS, FS Freight Surcharge... |
| **General Ledger** | 6 | GL Budgets, GL Chart of Account, GL Distribution Journal... |
| **Inventory** | 43 | IN Adjustment, IN Authorized Product, IN Beginning Balance... |
| **Order Entry** | 6 | OE Grouped Open Order Intel, OE Open Order, OE Open Order Grouped... |
| **Purchase Order** | 5 | PO Non Inventory Item, PO Non Inventory Purchase Alias, PO Non Inventory Vendor Cost... |
| **Tax Control** | 5 | TX Tax Break Point Rate, TX Tax ON Tax, TX Tax Profile... |
| **Ascend Setup** | 3 | AS City, AS County, AS Exchange Rate |
| **Miscellaneous** | 9 | Contacts, Contact CardHolder Detail, Destination... |
| **Security Admin** | 1 | Security Roles |

**Total: 271 tables across 15 categories**

## Key Tables (Column Details)

### AP Invoice
*Accounts Payable invoices — vendor payments, aging* — 44 columns

| # | Column | 
|---|--------|
| 1 | Invoice Number |
| 2 | Vendor ID |
| 3 | Invoice Date |
| 4 | Net Due Date |
| 5 | Terms Due Date |
| 6 | Terms Discount |
| 7 | Invoice Class |
| 8 | Payment Method |
| 9 | PO Number |
| 10 | Description |
| 11 | Period |
| 12 | Year |
| 13 | Invoice Amount |
| 14 | Terms Amount |
| 15 | Hold Payment |
| 16 | Purchase Amount |
| 17 | Job Component |
| 18 | Profit Center |
| 19 | Natural Account |
| 20 | Purchase Type |
| 21 | Apply Terms |
| 22 | Description.1 |
| 23 | Vehicle |
| 24 | Driver |
| 25 | 1099 Type |
| 26 | Item ID |
| 27 | Unit Price |
| 28 | Quantity |
| 29 | Company_No |
| 30 | DIN_Number |
| 31 | GLCompanyNo
(Intercompany Company ID) |
| 32 | FilingNo |
| 33 | DataServURL |
| 34 | Standard Account |
| 35 | Ship To Code |
| 36 | Equipment Code |
| 37 | Component Code |
| 38 | Percentage Allocation |
| 39 | Intercompany Profit Center |
| 40 | Intercompany Natural Account |
| 41 | How Invoiced |
| 42 | Tax Profile |
| 43 | Taxable |
| 44 | Flag |

### AP Vendor
*Vendor master — names, contacts, payment terms* — 68 columns

| # | Column | 
|---|--------|
| 1 | Vendor Number |
| 2 | Vendor Name |
| 3 | Federal ID Number |
| 4 | DBA Name |
| 5 | Parent Vendor |
| 6 | Primary Phone Number |
| 7 | Fax Number |
| 8 | Accounts Payable Account |
| 9 | Default Purchase Account |
| 10 | Tax Accrual Account |
| 11 | Tax Profile |
| 12 | Macro Substitution |
| 13 | Inactive (Y/N) |
| 14 | Inactive Until Date |
| 15 | Inactive Reason |
| 16 | Misc. Vendor (Y/N) |
| 17 | Class 1 Code |
| 18 | Class 2 Code |
| 19 | Class 3 Code |
| 20 | Class 4 Code |
| 21 | Class 5 Code |
| 22 | Mail Address1 |
| 23 | Mail Address2 |
| 24 | Mail Address3 |
| 25 | Mail Address4 |
| 26 | Mail City |
| 27 | Mail State |
| 28 | Mail Postal Code |
| 29 | Mail Country |
| 30 | Physical Address1 |
| 31 | Physical Address2 |
| 32 | Physical Address3 |
| 33 | Physical Address4 |
| 34 | Physical City |
| 35 | Physical State |
| 36 | Physical Postal Code |
| 37 | Physical Country |
| 38 | On Hold |
| 39 | AP Terms Code |
| 40 | Deferred Terms Code |
| 41 | Default Invoice Description |
| 42 | Payment Care Of |
| 43 | Currency |
| 44 | Credit Limit |
| 45 | Payment Method |
| 46 | Bank Code |
| 47 | Bank Name |
| 48 | Bank ACH ID Number |
| 49 | Bank Account Number |
| 50 | Bank Account Type |
| 51 | Incorporated |
| 52 | Default 1099 Type |
| 53 | Name Control |
| 54 | Alternative 1099 Name |
| 55 | Active for Purchase Order |
| 56 | Purchase Order Format |
| 57 | Default Costing Method |
| 58 | Default Lead Time Group |
| 59 | Lead Time Blackout |
| 60 | Website |
| 61 | Vendor Type Code |
| 62 | Vendor Type Descr |
| 63 | Freight Zone Code |
| 64 | Freight Zone Descr |
| 65 | FEIN Type |
| 66 | Always show terms amount on EFTs |
| 67 | VendorSSN |
| 68 | Flag |

### AR Invoice
*Accounts Receivable invoices — customer billing* — 13 columns

| # | Column | 
|---|--------|
| 1 | Standard Account No |
| 2 | Ship To Code |
| 3 | Invoice Number |
| 4 | Invoice Date |
| 5 | Invoice Due Date |
| 6 | Original Invoice Amount |
| 7 | Outstanding Invoice Amount |
| 8 | Date of the Last Finance Charge |
| 9 | Billing Item Code |
| 10 | Year |
| 11 | Period |
| 12 | Notes |
| 13 | Flag |

### AR Credit Profile
*Customer credit data — FICO, limits, terms* — 43 columns

| # | Column | 
|---|--------|
| 1 | Standard Account Number  |
| 2 |  Business Established |
| 3 | Business Type Code |
| 4 |  Business Type Descr |
| 5 | FICO Score |
| 6 | Resident Type Code |
| 7 | Resident Type Descr |
| 8 |  Duns/Equifax ID # |
| 9 |  Credit Agency Code |
| 10 | Credit Agency Descr |
| 11 | D & B Rating |
| 12 |  S & P Rating  |
| 13 | Moody Rating |
| 14 |  Financial Stress Score |
| 15 |  Commerical Credit Score |
| 16 |  Payment Index |
| 17 | 3 month Payment Index  |
| 18 | Industry Payment Index |
| 19 |  Pays by Statement |
| 20 |  D & B Average Limit |
| 21 | SIC # |
| 22 | 2 SIC Description |
| 23 | 2 SIC # |
| 24 | Aggressive Limit  |
| 25 | Conservitive Limit |
| 26 |  # of Trade Experiences |
| 27 | Experian Suggested Limit |
| 28 | Equifax Suggested Limit |
| 29 | Credit Comments |
| 30 | Business Risk Failure Score  |
| 31 | Overall Ranking |
| 32 | Ranking Description |
| 33 | Rank |
| 34 | Approval Source |
| 35 | Internal Calculated Exposure |
| 36 | Filed For Bankruptcy Protection |
| 37 |  Bankruptcy Date  |
| 38 |  Bankruptcy Type Code  |
| 39 | Bankruptcy Type Descr |
| 40 | DepositAmount |
| 41 | LetterOfCreditAmount |
| 42 | LastDBRunDate |
| 43 | LetterOfCreditExpiration |
