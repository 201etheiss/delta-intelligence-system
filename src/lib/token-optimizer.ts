/**
 * Token Optimization Layer for Delta Intelligence
 *
 * 4-layer strategy to minimize token burn:
 * 1. Schema Index — compact reference of all data sources (~500 tokens vs ~3k)
 * 2. Query Planner — pre-route queries to specific endpoints before model sees them
 * 3. Result Compressor — digest large API responses into structured summaries
 * 4. Conversation Compactor — summarize older messages to reclaim context space
 */

import { RESPONSE_SCHEMA } from '@/lib/response-schema';
import { buildGlossaryPromptSection } from '@/lib/glossary';
import { buildSalesKnowledgePrompt } from '@/lib/sales-knowledge';

// ─── Layer 1: Schema Index ─────────────────────────────────────────────
// Pre-built compact index. The model gets this instead of full endpoint docs.
// This is the "table of contents" — the model requests specifics via tool calls.

export const SCHEMA_INDEX = `# Delta360 Data Sources

## ascend (ERP)
Key tables: Address (customers/vendors), ARInvoice (invoice headers), ARInvoiceItem (invoice line items), Product, AdHocPrices, Equipment, TankEquipment, ARShipTo (ShipTo details with Code field), SalesAlias (sales product codes), ProdCont (product containers), Container
Pre-built endpoints: ar-aging, ar-summary, balance-sheet, income-statement, trial-balance, pl-by-pc, equity, journal-entries, revenue, revenue-by-customer, gp-by-pc, costs-by-pc, customers, vendors, equipment, tanks, tanks/assignments, sites, profit-centers, invoices
SQL Schema (for POST /ascend/query — send {"sql":"SELECT ..."}):
  DF_PBI_BillingChartQuery (PRIMARY — current data to 2026): SysTrxNo, CustomerName, ShipToDescr, CustType, InvoiceDt, Salesperson, Carrier, Latitude, Longitude
  ARInvoiceItem (line items with pricing): SysTrxNo, SysTrxLine, MasterProdID, Qty, UnitPrice, OrigUnitPrice, MasterSiteID
  DF_PBI_DS_SalesAndProfitAnalysis (historical + product names — data only to Jan 2022): MasterProdID, MasterProdCode, MasterProdDescr, UnitPrice, Qty, CustomerName, SiteDescr, PhysStateDescr
  Key join: DF_PBI_BillingChartQuery.SysTrxNo = ARInvoiceItem.SysTrxNo (gets recent pricing with customer context)
  Key diesel MasterProdIDs: 4399=Dyed Short Truck, 4412=Dyed Bio5, 1096=Dyed Transport, 1116=Dyed Bio5 Transport, 4503=Dyed Counter Sale, 1187=variant
  Address: Id, Name, Phys_City, Phys_State — for customer address lookups
  AdHocPrices: pricing overrides | Equipment: asset inventory | 5,105 total tables available
  DTN/Rack Pricing (LIVE — updated daily):
    vRackPrice: Vendor_Name, SupplyPoint, ProductDescr, EffDtTm, RackPrice, DiscountPrice — current rack prices from DTN, Sunoco, etc.
    IndexPrice: IndexID, SalesAliasID, EffDtTm, Price — index pricing
    PurchRackPrice: SupplierSupplyPtID, PurchAliasID, EffDtTm, Price — purchase rack
    DTNOEPriceQuote: ShipToDescr, ProductDescr, PriceDate, UnitPrice, Qty, Freight, Site, Supplier — generated price quotes
    ARShiptoRefRackPrice: per-customer rack pricing overrides
  Logistics: LogisticsOrderTracking, LogisticsPriceTracking
  Journal Entries: JournalEntryHeader (JournalEntryID, UserID, TransactionDate, PostYear, PostPeriod, Code, Posted, Remarks) + JournalEntryLine (AccountNumber, Description, AmountDebit, AmountCredit)
  Pre-built GL endpoints: /ascend/gl/journal-entries, /ascend/gl/balance-sheet, /ascend/gl/income-statement, /ascend/gl/trial-balance, /ascend/gl/pl-by-pc, /ascend/gl/equity
ShipTo Detail: ARShipTo table — Code (3-digit ShipTo code like 001/002/003), LongDescr, StandardAcctID, ZoneID, BankID, 154 columns
  Join: LEFT JOIN ARShipTo st ON b.ShipToID = st.ShiptoID — gives st.Code as the ShipTo number
  SalesAlias: Code, SellAsDescr, ProdContID — links to ProdCont → Product + Container
  Product hierarchy: SalesAlias → ProdCont → Product + Container. Dept/Seg/Cat from reference files, not SQL tables.
REVENUE ACCURACY WARNING:
  DO NOT use SUM from BillingChartQuery JOIN ARInvoiceItem for aggregate revenue totals — creates cartesian products on high-line-item transactions (e.g. Delta Fuel Company Use has 127K lines, inflates to $701M vs real $228M).
  For aggregate revenue/GP: use GET /ascend/gp/by-pc?year=YYYY (returns Revenue, COGS, GP per profit center — matches PBI data).
  BillingChartQuery JOIN is fine for per-customer, per-salesperson, per-shipto DETAIL queries — just not company-wide totals.
Query: POST /ascend/query (raw SQL), GET /ascend/tables, GET /ascend/schema/{table}

## microsoft (M365 — SharePoint + OneDrive)
Resources: sites (all SharePoint sites), users, search (full-text across SharePoint+OneDrive)
Sites include: Atlas/Delta Fuel, Accounting & Finance, AP Pay File, and more
Search: GET /microsoft/search?q=keyword — searches all documents, spreadsheets, presentations
Query: POST /microsoft/query (custom Graph API call)

## salesforce (CRM — 21,311 accounts, 2,185 contacts, 690 opportunities, 3,359 leads, 1 case, 128 users, 1,891 products, 20,710 tasks, 4,948 events)
Objects & fields:
  accounts: Id, Name, Industry, Type (Customer/Prospect/etc), BillingCity, BillingState, BillingCountry, Phone, Website, OwnerId, CreatedDate, LastModifiedDate
  contacts: Id, FirstName, LastName, Email, Phone, MobilePhone, Title, Department, Account.Name, MailingCity, MailingState
  opportunities: Id, Name, StageName (Suspect/Prospect Analysis/Qualified/Closed Won/Closed Lost), Amount, CloseDate, Probability, Account.Name, OwnerId, CreatedDate
  leads: Id, FirstName, LastName, Company, Email, Phone, Status (New/Qualified/Nurturing), LeadSource (Campaign/Rep-Added Lead/External Referral), CreatedDate
  cases: Id, CaseNumber, Subject, Status, Priority, Account.Name, CreatedDate, ClosedDate
  users: Id, Name, Email, IsActive, Profile.Name, UserRole.Name, Department
  products: Id, Name, ProductCode, Family (Fittings & Hardware/Hoses & Reels/etc), IsActive, Description
  tasks: Id, Subject, Status (Not Started/Completed), Priority, ActivityDate, Who.Name, What.Name, OwnerId
  events: Id, Subject, StartDateTime, EndDateTime, Who.Name, What.Name, OwnerId
Query: POST /salesforce/query with {"soql":"SELECT Id, Name FROM Account LIMIT 5"}
Opportunity stages: Suspect (10%) → Prospect Analysis (20%) → Qualified → Closed Won / Closed Lost
Industries: Commercial, Construction, Oil & Gas, Government, Agriculture, Mining, Transportation

## powerbi (Analytics — 5 workspaces)
Workspaces: RMC Online, RMC Online Dev, Sales Analytics (dedicated capacity), Operations Analytics (dedicated), Financial Analytics (dedicated)
Endpoints: GET /powerbi/workspaces (working), GET /powerbi/datasets (app-restricted), GET /powerbi/reports (app-restricted)
Query: POST /powerbi/query (DAX) — may be app-restricted
Note: datasets and reports endpoints return "API is not accessible for application" — only workspaces listing works currently

## vroozi (Procurement — 125 users, 889 GL accounts, 2,605 catalogs)
Working endpoints:
  /vroozi/purchase-orders — POs with status, supplier, amounts (25 per page)
  /vroozi/suppliers — 25 suppliers with address, contacts, vendorId, PO config
  /vroozi/users — 125 users. Fields: id, email, firstname, lastname, roles[] (AP_EDITOR, EMPLOYEE, APPROVER, etc), approvalLimit, spendLimit, userDefaults{shippingAddress, companyCodeRef, profitCenterRef}, defaultApproverRef
  /vroozi/gl-accounts — 889 GL accounts. Fields: id, externalId (GL code), code, description, companyCodeRef, active. Departments: Sales & BD, Maintenance & Shop, Ops Supervision & Mgmt, Dispatch & Logistics, Freight & Transportation, Field Ops & Tech. Suffixes: -Tax, -VEH, -PTO, -OT (overtime)
  /vroozi/catalogs — 2,605 catalogs. Fields: id, name, catalogType (PUNCH_OUT/HOSTED), supplierRefs[], submitterRef, catalogStatus (APPROVED/PENDING), validFrom, validTo
  /vroozi/cost-centers — endpoint works but returns 0 records currently
Broken: /vroozi/invoices — returns auth header error (SHA-256 encoding issue)
Company: Delta Fuel Company LLC (companyCode 01)
Profit centers: Midland (1020), Shreveport, Lake Charles, Corpus Christi, Colorado

## samsara (Fleet — 11 endpoints, 6 verified live)
WORKING endpoints:
  /samsara/vehicles — 160 vehicles. Fields: id, name, make, model, year, vin, esn, tags[], gateway, licensePlate, staticAssignedDriver, vehicleRegulationMode, createdAtTime, updatedAtTime. Makes: FREIGHTLINER (Cascadia, SD122, M2), KENWORTH (T880), PETERBILT, INTERNATIONAL, FORD, RAM, CHEVROLET.
  /samsara/drivers — 237 drivers. Fields: id, name, username, phone, licenseNumber, licenseState, eldSettings{rulesets[]}, timezone, carrierSettings{carrierName, dotNumber, mainOfficeAddress, homeTerminalName, homeTerminalAddress}, driverActivationStatus (active/deactivated), tags[], createdAtTime, updatedAtTime.
  /samsara/locations — 157 live GPS positions. Fields: id, name, location{time, latitude, longitude, heading, speed, reverseGeo{formattedLocation}}. Updates every ~60s for moving vehicles.
  /samsara/addresses — 326 geofence locations. Fields: id, name, formattedAddress, geofence{polygon{vertices[]}|circle{lat,lng,radiusMeters}}, tags[], addressTypes[] (yard, customer, etc), latitude, longitude. Key yards: MIDLAND TX, SHREVEPORT YARD, LAKE CHARLES LA, CORPUS CHRISTI.
  /samsara/tags — 21 fleet groups. Fields: id, name, parentTagId, parentTag, vehicles[], drivers[], assets[], machines[], sensors[]. Key tags: Delta Fuel (root), Shreveport, Midland, Corpus Christi, Colorado, Lake Charles, CO Mobile Fueling, Cameron.
  /samsara/hos?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD — HOS daily logs. Fields: driver{id,name,timezone,eldSettings}, startTime, endTime, logMetaData{shippingDocs, vehicles[], trailerNames[], isCertified, carrierName}, distanceTraveled{driveDistanceMeters}, dutyStatusDurations{activeDurationMs, onDutyDurationMs, driveDurationMs, offDutyDurationMs, sleeperBerthDurationMs, yardMoveDurationMs, personalConveyanceDurationMs}. DOT: 223878.
ALL WORKING (verified 2026-03-29):
  /samsara/stats?types=gpsOdometerMeters — GPS odometer per vehicle in METERS (convert: meters * 0.000621371 = miles). 32 vehicles per page.
  /samsara/stats?types=obdOdometerMeters,obdEngineSeconds — OBD odometer + engine hours.
  /samsara/diagnostics — engine states + OBD data for 153 vehicles.
  /samsara/defects?startTime=ISO&endTime=ISO — vehicle defect reports (DVIR).
  /samsara/alerts?startTime=ISO&endTime=ISO — safety events and alerts.
  /samsara/fuel — fuel level data (limited — 0 vehicles currently reporting fuel level via OBD).

## fleetpanda (Fleet Assets)
Resources: assets (all), trucks, tanks, customers
`;

// ─── Layer 2: Query Planner ────────────────────────────────────────────
// Maps user intent to a specific execution plan BEFORE the model runs.
// Returns a compact "plan hint" the model uses to pick the right endpoints.

// Common SQL join referenced across many patterns
const BILLING_JOIN = 'DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo';

interface QueryPlan {
  domains: string[];
  suggestedEndpoints: string[];
  hint: string;
}

const INTENT_PATTERNS: Array<{ pattern: RegExp; domains: string[]; endpoints: string[]; hint: string }> = [
  {
    pattern: /\b(ar\s*aging|accounts?\s*receivable|outstanding|overdue|past\s*due)\b/i,
    domains: ['financial'],
    endpoints: ['/ascend/ar/aging', '/ascend/ar/summary'],
    hint: 'Use /ascend/ar/aging for customer-level detail, /ascend/ar/summary for type-level rollup.',
  },
  {
    pattern: /\b(top\s*customer|biggest\s*client|revenue\s*by\s*customer|customer\s*rank)\b/i,
    domains: ['customers'],
    endpoints: ['/ascend/customers/top', '/ascend/revenue/by-customer'],
    hint: 'Use /ascend/customers/top for ranked list, /ascend/revenue/by-customer for detailed revenue+units.',
  },
  {
    pattern: /\b(balance\s*sheet|assets?\s*and\s*liabilities|financial\s*position)\b/i,
    domains: ['financial'],
    endpoints: ['/ascend/gl/balance-sheet'],
    hint: 'Use /ascend/gl/balance-sheet?year=2026&period=3 for current period.',
  },
  {
    pattern: /\b(income\s*statement|p&?l|profit\s*(?:and|&)\s*loss|revenue\s*vs\s*expense)\b/i,
    domains: ['financial'],
    endpoints: ['/ascend/gl/income-statement', '/ascend/gl/pl-by-pc'],
    hint: 'Use /ascend/gl/income-statement for company-wide, /ascend/gl/pl-by-pc for by profit center.',
  },
  {
    pattern: /\b(pipeline|opportunit|deal|forecast|sales\s*funnel)\b/i,
    domains: ['sales'],
    endpoints: ['/salesforce/opportunities'],
    hint: `PIPELINE / OPPORTUNITIES:
1. Full pipeline: POST /salesforce/query: SELECT Id, Name, StageName, Amount, CloseDate, Probability, Account.Name, Owner.Name, CreatedDate FROM Opportunity WHERE IsClosed = false ORDER BY CloseDate ASC
2. By stage: SELECT StageName, COUNT(Id) AS Cnt, SUM(Amount) AS Total FROM Opportunity WHERE IsClosed = false GROUP BY StageName
3. Stages: Suspect (10%) → Prospect Analysis (20%) → Qualified → Closed Won / Closed Lost
4. Division targets: Commercial 4 new opps/month, Industrial 3 RFQ/month, O&G Field 4/month, O&G Corporate 2 RFP/month, Contractor 2/month
5. Close rate: SELECT Owner.Name, StageName, COUNT(Id) FROM Opportunity WHERE CloseDate = THIS_YEAR AND (StageName = 'Closed Won' OR StageName = 'Closed Lost') GROUP BY Owner.Name, StageName`,
  },
  // ── Samsara Fleet — Vehicles ───────────────────────────────────────
  {
    pattern: /\b(vehicle|truck|fleet\s*(?:list|inventory|size|count)|trailer|vin|freightliner|kenworth|peterbilt|cascadia|how\s*many\s*(?:truck|vehicle))\b/i,
    domains: ['fleet'],
    endpoints: ['/samsara/vehicles', '/samsara/tags'],
    hint: `FLEET VEHICLES — 160 vehicles in Samsara:
1. All vehicles: GET /samsara/vehicles — returns id, name, make, model, year, vin, esn, tags[], gateway, licensePlate, staticAssignedDriver
2. By location/group: GET /samsara/tags — 21 groups (Shreveport, Midland, Corpus Christi, Colorado, Lake Charles, Cameron, CO Mobile Fueling)
3. Vehicle naming: TR-xxx (tractors), BF-xxx (bulk fuel), PU-xxx (pickups), FL-xxx (flatbeds), SV-xxx (service), TK-xxx (tanks)
4. Makes: FREIGHTLINER (Cascadia, SD122, M2), KENWORTH (T880), PETERBILT, INTERNATIONAL, FORD, RAM, CHEVROLET
5. Each vehicle has tags[] showing which regional group it belongs to (parentTag = "Delta Fuel")`,
  },
  // ── Samsara Fleet — Drivers ────────────────────────────────────────
  {
    pattern: /\b(driver|operator|who\s*(?:is\s*)?driv|eld|cdl|license|carrier\s*name|dot\s*number|driver\s*(?:list|status|active|deactivated))\b/i,
    domains: ['fleet'],
    endpoints: ['/samsara/drivers', '/samsara/tags'],
    hint: `FLEET DRIVERS — 237 drivers in Samsara:
1. All drivers: GET /samsara/drivers — returns id, name, username, phone, licenseNumber, licenseState, driverActivationStatus, tags[], carrierSettings, eldSettings
2. Driver status: driverActivationStatus = "active" or "deactivated"
3. ELD settings: all drivers on USA 70hr/8day cycle, US Interstate Property shift, 34-hour Restart
4. Carrier: Delta Fuel Company, L.L.C. — DOT: 223878
5. Home terminals: Midland TX (6600 W Hwy 80), Shreveport LA (521 Main St, Natchez MS 39120)
6. Drivers grouped by tag: Shreveport, Midland, Corpus Christi, Colorado, Lake Charles, Cameron, CO Mobile Fueling
7. By group: GET /samsara/tags — each tag includes drivers[] array with id+name`,
  },
  // ── Samsara Fleet — GPS / Locations ────────────────────────────────
  {
    pattern: /\b(gps|location|where\s*(?:is|are)|track(?:ing)?|position|live\s*(?:map|track|fleet)|heading|speed|moving|parked|idle)\b/i,
    domains: ['fleet'],
    endpoints: ['/samsara/locations', '/samsara/addresses'],
    hint: `LIVE GPS TRACKING — 157 vehicle positions:
1. All positions: GET /samsara/locations — returns id, name, location{time, latitude, longitude, heading, speed, reverseGeo{formattedLocation}}
2. Speed = 0 means parked/idle. Speed in m/s (multiply by 2.237 for mph).
3. Heading in degrees (0=North, 90=East, 180=South, 270=West).
4. reverseGeo.formattedLocation gives human-readable address.
5. Geofence locations: GET /samsara/addresses — 326 defined geofences (yards, customer sites)
6. Key yards: MIDLAND TX (6600 W Hwy 80), SHREVEPORT YARD (1000 Wells Island Rd), LAKE CHARLES LA (5625 Broad St)
7. To check if vehicle is at a yard: compare lat/lng with /samsara/addresses coordinates`,
  },
  // ── Samsara Fleet — HOS / Compliance ───────────────────────────────
  {
    pattern: /\b(hos|hours\s*of\s*service|duty\s*status|drive\s*time|on\s*duty|off\s*duty|sleeper|eld\s*log|compliance|violation|daily\s*log|certified|drive\s*hour|rest\s*break|14\s*hour|11\s*hour|70\s*hour)\b/i,
    domains: ['fleet'],
    endpoints: ['/samsara/hos', '/samsara/drivers'],
    hint: `HOS / HOURS OF SERVICE — ELD compliance logs:
1. Daily logs: GET /samsara/hos?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD — BOTH params required
2. Fields: driver{id, name}, dutyStatusDurations{activeDurationMs, onDutyDurationMs, driveDurationMs, offDutyDurationMs, sleeperBerthDurationMs, yardMoveDurationMs, personalConveyanceDurationMs}
3. distanceTraveled.driveDistanceMeters — total miles driven that day
4. logMetaData: shippingDocs, vehicles[], trailerNames[], isCertified (true = driver signed off)
5. Duration values in milliseconds — divide by 3600000 for hours
6. Ruleset: USA 70hr/8day cycle, US Interstate Property shift, 34-hour Restart, Property break
7. DOT: 223878, Carrier: Delta Fuel Company, L.L.C.
8. Date range: use SHORT ranges (1-3 days max). Long ranges (7+ days) TIMEOUT with 237 drivers. For weekly totals, query 2-3 day chunks and sum.
9. Example: startDate=2026-03-28&endDate=2026-03-30 (3 days, returns ~27-54 logs)
10. For monthly totals: sum daily drive distances across multiple short queries rather than one 30-day query`,
  },
  // ── Fleet Mileage / Cost Per Mile ──────────────────────────────────
  {
    pattern: /\b(mileage|odometer|miles?\s*driven|price\s*per\s*mile|cost\s*per\s*mile|total\s*miles|drive\s*distance|fleet\s*mileage)\b/i,
    domains: ['fleet'],
    endpoints: ['/samsara/stats', '/samsara/hos', '/samsara/vehicles'],
    hint: `FLEET MILEAGE / COST PER MILE:
1. GPS Odometer per vehicle: GET /samsara/stats?types=gpsOdometerMeters — returns vehicle name + total GPS odometer in METERS. Convert: meters * 0.000621371 = miles.
2. OBD Odometer: GET /samsara/stats?types=obdOdometerMeters — engine-reported odometer (more accurate but not all vehicles report).
3. Daily drive distance: GET /samsara/hos?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD — returns distanceTraveled.driveDistanceMeters per driver per day. Sum across date range for period total.
4. Filter trucks only: GET /samsara/vehicles first, filter by make (FREIGHTLINER, KENWORTH, PETERBILT) — exclude FORD, RAM, CHEVROLET, pickups.
5. FUEL COST DATA: Fuel costs tracked in Ascend AP via vPurchaseJournal. Vendor name is NOT "Comdata" — search for actual fuel vendors:
   SELECT DISTINCT vendor_name, SUM(debit) AS TotalSpend FROM vPurchaseJournal WHERE Account_Desc LIKE '%Fuel%' OR Account_Desc LIKE '%COGS%Diesel%' OR Account_Desc LIKE '%COGS%Clear%' AND Year_For_Period = 2026 GROUP BY vendor_name ORDER BY TotalSpend DESC
   Known fuel vendors include: Dale Petroleum Company, various oil companies. Also check GL accounts with "fuel" or "COGS" in description.
6. Cross-reference: match fuel spend to Samsara vehicles via carrier/profit center assignments.
7. Formula: Price Per Mile = Fuel Spend / Samsara Drive Miles (trucks only, exclude pickups)
8. For HOS data: use /samsara/hos?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD — CRITICAL: use 1-3 day ranges only. 7+ days TIMEOUT. For weekly/monthly totals, use odometer instead.
9. For odometer: use /samsara/stats?types=gpsOdometerMeters (returns total GPS odometer in meters per vehicle — best source for total mileage)
10. PREFERRED for cost-per-mile: use odometer data (cumulative, no timeout risk) rather than HOS daily logs`,
  },
  // ── Samsara Fleet — Geofences / Yards ──────────────────────────────
  {
    pattern: /\b(geofence|yard|terminal|depot|base|home\s*terminal|address(?:es)?|customer\s*site|delivery\s*point|bulk\s*storage|fuel\s*island)\b/i,
    domains: ['fleet'],
    endpoints: ['/samsara/addresses', '/samsara/tags'],
    hint: `GEOFENCES / YARD LOCATIONS — 326 defined locations:
1. All addresses: GET /samsara/addresses — returns id, name, formattedAddress, geofence (polygon or circle), tags[], addressTypes[], latitude, longitude
2. Address types: yard, customer, fuel island, bulk storage
3. Key Delta Fuel yards: MIDLAND TX, SHREVEPORT YARD, LAKE CHARLES LA, CORPUS CHRISTI
4. Geofence types: polygon{vertices[{lat,lng}]} or circle{lat, lng, radiusMeters}
5. Tags on addresses: DF Yard, DF Bulk Storage, DF Fuel Island (all under parent "Delta Fuel")
6. Fleet tags/groups: GET /samsara/tags — 21 groups with vehicles[], drivers[], addresses[]`,
  },
  // ── Samsara Fleet — Tags / Groups ──────────────────────────────────
  {
    pattern: /\b(fleet\s*(?:group|tag|region|division)|samsara\s*tag|regional\s*(?:fleet|group)|(?:shreveport|midland|corpus|colorado|lake\s*charles|cameron)\s*(?:fleet|truck|driver|team))\b/i,
    domains: ['fleet'],
    endpoints: ['/samsara/tags'],
    hint: `FLEET TAGS / REGIONAL GROUPS — 21 groups:
1. All tags: GET /samsara/tags — returns id, name, parentTagId, vehicles[], drivers[], assets[]
2. Root tag: "Delta Fuel" (id: 4118600) — all other tags are children
3. Regional tags: Shreveport, Midland, Corpus Christi, Colorado, Lake Charles, Cameron, CO Mobile Fueling
4. Functional tags: DF Yard, DF Bulk Storage, DF Fuel Island
5. Each tag includes full lists of vehicles[], drivers[], assets[] assigned to that group
6. Use tags to filter fleet by region or function`,
  },
  {
    pattern: /\b(equipment|tank|asset\s*(?:list|inventory)|fixed\s*asset)\b/i,
    domains: ['equipment'],
    endpoints: ['/ascend/equipment', '/ascend/tanks', '/ascend/assets/fixed'],
    hint: 'Use /ascend/equipment for all types, /ascend/tanks for tanks only, /ascend/assets/fixed for book values.',
  },
  // ── Journal Entries / GL ────────────────────────────────────────────
  {
    pattern: /\b(journal\s*entr|gj\b|general\s*journal|gl\s*entr|posted\s*journal|who\s*posted|user.?id.?journal)\b/i,
    domains: ['journal'],
    endpoints: ['/ascend/gl/journal-entries', '/ascend/query'],
    hint: `JOURNAL ENTRIES:
1. Pre-built endpoint: GET /ascend/gl/journal-entries?year=2026&period=1 — returns JournalEntryID, Code, Posted, PostYear, PostPeriod, UserID, Remarks, AccountNumber, Description, AmountDebit, AmountCredit (1,250+ rows per period)
2. Summary by UserID: POST /ascend/query:
   SELECT h.UserID, COUNT(DISTINCT h.JournalEntryID) AS JournalCount, COUNT(l.LineID) AS LineItems, SUM(l.AmountDebit) AS TotalDebits, SUM(l.AmountCredit) AS TotalCredits, MIN(h.TransactionDate) AS FirstEntry, MAX(h.TransactionDate) AS LastEntry
   FROM JournalEntryHeader h JOIN JournalEntryLine l ON h.JournalEntryID = l.JournalEntryID
   WHERE h.PostYear = 2026 GROUP BY h.UserID ORDER BY JournalCount DESC
3. Detail by specific user: add WHERE h.UserID = 'esmith' to filter
4. Key tables: JournalEntryHeader (JournalEntryID, UserID, TransactionDate, PostYear, PostPeriod, Code, Posted, Remarks), JournalEntryLine (JournalEntryID, LineID, AccountNumber, Description, AmountDebit, AmountCredit)
5. Known 2026 users: esmith (82 journals, $110M), lcowan (35, $11.5M), hpasupu (47, $1.5M), tveazey (45, $4.9M), ypatel (2, $366K)`,
  },
  {
    pattern: /\b(purchase\s*order|po\s|procurement|supplier|vendor\s*(?:list|spend))\b/i,
    domains: ['procurement'],
    endpoints: ['/vroozi/purchase-orders', '/vroozi/suppliers', '/ascend/vendors'],
    hint: 'Use /vroozi/purchase-orders for POs, /ascend/vendors for vendor master, /ascend/ap/purchases for spend.',
  },
  {
    pattern: /\b(invoice|billing|payment)\b/i,
    domains: ['invoices'],
    endpoints: ['/ascend/invoices', '/ascend/ar/aging'],
    hint: 'Use /ascend/invoices for list with filters, /ascend/invoices/detail/{sysTrxNo} for line items.',
  },
  {
    pattern: /\b(cost|expense|overhead|margin|profit\s*center|gross\s*profit|gp\b|cogs)\b/i,
    domains: ['costs'],
    endpoints: ['/ascend/query', '/ascend/costs/by-pc', '/ascend/gp/by-pc', '/ascend/profit-centers'],
    hint: `GROSS PROFIT / COST ANALYSIS:
1. GP by profit center: GET /ascend/gp/by-pc?year=2025 — returns Revenue, COGS, GP per profit center
2. GP by CUSTOMER (use SQL): POST /ascend/query:
   SELECT TOP 20 b.CustomerName, SUM(i.Qty * i.UnitPrice) AS Revenue, SUM(i.Qty * ISNULL(i.Total_UnitCost, 0)) AS COGS, SUM(i.Qty * i.UnitPrice) - SUM(i.Qty * ISNULL(i.Total_UnitCost, 0)) AS GP
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 AND i.Total_UnitCost IS NOT NULL AND i.Total_UnitCost > 0
   GROUP BY b.CustomerName ORDER BY GP DESC
3. Cost breakdown by PC: GET /ascend/costs/by-pc?year=2025
4. IMPORTANT: Only include rows WHERE i.Total_UnitCost > 0 — many rows have NULL cost data.`,
  },
  {
    pattern: /\b(tax|sales\s*tax|tax\s*collected)\b/i,
    domains: ['tax'],
    endpoints: ['/ascend/taxes', '/ascend/taxes/collected'],
    hint: 'Use /ascend/taxes for codes, /ascend/taxes/collected for amounts by period.',
  },
  {
    pattern: /\b(lease|rent|storage|recurring)\b/i,
    domains: ['leases'],
    endpoints: ['/ascend/leases', '/ascend/ap/recurring'],
    hint: 'Use /ascend/leases for lease/rent/storage, /ascend/ap/recurring for all recurring vendor payments.',
  },
  // ── Pricing / Quoting ──────────────────────────────────────────────
  {
    pattern: /\b(price|pricing|quote|bid|cost\s*to\s*deliver|rate|per\s*gallon|freight|delivery\s*cost)\b/i,
    domains: ['pricing'],
    endpoints: ['/ascend/query', '/ascend/invoices', '/ascend/revenue/by-customer', '/ascend/customers', '/ascend/sites', '/ascend/profit-centers', '/ascend/tanks', '/ascend/costs/by-pc'],
    hint: `PRICING QUERY — Use DF_PBI_BillingChartQuery (has current data to 2026) + ARInvoiceItem (has UnitPrice):
1. Recent invoice prices: POST /ascend/query:
   SELECT TOP 20 b.CustomerName, b.ShipToDescr, b.InvoiceDt, i.UnitPrice, i.Qty, i.MasterProdID
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.InvoiceDt >= '2026-01-01' ORDER BY b.InvoiceDt DESC
2. For specific products: filter by MasterProdID (e.g. 4399=Diesel Dyed Short Truck, 1096=Diesel Dyed Transport)
3. For location-specific: add AND b.ShipToDescr LIKE '%city_name%'
4. For tank/equipment: check /ascend/tanks and /ascend/equipment endpoints
5. Present actual transaction prices with dates and customer names — NOT averages.
6. Key join pattern: DF_PBI_BillingChartQuery.SysTrxNo = ARInvoiceItem.SysTrxNo`,
  },
  {
    pattern: /\b(diesel|gasoline|propane|fuel\s*price|gallon|dyed|clear|def|ethanol)\b/i,
    domains: ['fuel-pricing'],
    endpoints: ['/ascend/query', '/ascend/invoices', '/ascend/revenue/by-customer'],
    hint: `FUEL PRICING — Use DF_PBI_BillingChartQuery (recent data to 2026) joined with ARInvoiceItem (has UnitPrice):
KEY: MasterProdID maps to DF_PBI_DS_SalesAndProfitAnalysis.MasterProdDescr for product names.
Diesel Dyed product IDs: 4399 (Short Truck), 4412 (DDB5B Short Truck), 1096 (Transport), 1116 (DDB5T Transport), 4503 (Counter Sale), 1187 (another variant)
1. Recent prices: POST /ascend/query:
   SELECT TOP 20 b.CustomerName, b.ShipToDescr, b.InvoiceDt, i.UnitPrice, i.Qty, i.MasterProdID
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE i.MasterProdID IN (4399, 4412, 1096, 1116, 4503, 1187) AND b.InvoiceDt >= '2026-01-01'
   ORDER BY b.InvoiceDt DESC
2. For location-specific: add AND b.ShipToDescr LIKE '%plaquemine%' or filter by state in results
3. Show individual line items with dates and customer names — NOT averages.
4. MasterProdID reference: 4399=Diesel Dyed Short Truck, 1096=Diesel Dyed Transport, 4503=Diesel Dyed Counter Sale
5. ALSO get current rack price for context: SELECT TOP 5 Vendor_Name, SupplyPoint, ProductDescr, EffDtTm, RackPrice FROM vRackPrice WHERE ProductDescr LIKE '%Diesel%Dyed%' ORDER BY EffDtTm DESC`,
  },
  // ── Salesperson Performance ────────────────────────────────────────
  {
    pattern: /\b(salesperson|sales\s*rep|sales\s*team|rep\s*performance|who\s*sold|sales\s*rank|sales\s*leader)\b/i,
    domains: ['sales-performance'],
    endpoints: ['/ascend/query', '/salesforce/tasks', '/salesforce/events', '/salesforce/opportunities'],
    hint: `SALESPERSON PERFORMANCE — Revenue + GP by rep + Salesforce KPIs:
1. Revenue + COGS by salesperson: POST /ascend/query:
   SELECT TOP 10 b.Salesperson, SUM(i.Qty * i.UnitPrice) AS Revenue, SUM(i.Qty * ISNULL(i.Total_UnitCost,0)) AS COGS
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 AND i.Total_UnitCost > 0 GROUP BY b.Salesperson ORDER BY Revenue DESC
2. Gross profit by salesperson: replace ORDER BY Revenue DESC with ORDER BY (Revenue - COGS) DESC
3. Salesperson + customer detail: add b.CustomerName to SELECT and GROUP BY for per-account breakdown
4. Monthly performance: add b.Period to SELECT/GROUP BY, filter b.Period = N for specific month
5. Known salespersons: Ashley Hadwin, Scott Taylor, Megan Owen, Brandon Thornton, Brian McCaskill, Nathan Green, Cody McLelland, Peet Booysen, Alexis Deaton (Commercial); Layla McCall, Russ Mason, Chad Sheppard, Sam Ferguson, Wayne Tramel (Contractor); George Leiato, Leslie Whisenhant, Barry Iseminger (Industrial); Ashlee Hey, Patience Hill, Anna Snodgrass (O&G Field); Matt Gulledge (O&G Corporate)
6. SF ACTIVITY CHECK: POST /salesforce/query with SOQL to count activities by OwnerId
7. PIPELINE CHECK: POST /salesforce/query: SELECT OwnerId, Owner.Name, StageName, COUNT(Id) FROM Opportunity WHERE CreatedDate = THIS_YEAR GROUP BY OwnerId, Owner.Name, StageName
8. Compare activity counts against division KPI targets (see Sales Performance Standards in system prompt)`,
  },
  // ── Customer Type Analysis ───────────────────────────────────────
  {
    pattern: /\b(cust(?:omer)?\s*type|customer\s*segment|customer\s*category|oil\s*(?:&|and)\s*gas|construction|commercial|atlas|fleet\s*trucking)\b/i,
    domains: ['customer-segments'],
    endpoints: ['/ascend/query'],
    hint: `CUSTOMER TYPE ANALYSIS — Revenue breakdown by CustType:
1. Revenue by customer type: POST /ascend/query:
   SELECT b.CustType, COUNT(DISTINCT b.CustomerName) AS Customers, SUM(i.Qty * i.UnitPrice) AS Revenue
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 GROUP BY b.CustType ORDER BY Revenue DESC
2. Known types: Atlas Acquisition, Oil & Gas Operator, Construction, Commercial, Company Use, Industrial Plants, Retail Reseller, Fleet Trucking, Oil & Gas Service, Railroad Services, Pipeline, State/Local Government, Agriculture Farming, Marine, Federal Government
3. For GP by type: add SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost,0))) AS GrossProfit and filter i.Total_UnitCost > 0`,
  },
  // ── Product Mix ──────────────────────────────────────────────────
  {
    pattern: /\b(product\s*mix|top\s*product|product\s*breakdown|what\s*(?:do\s*we|products?\s*(?:do|are))\s*sell|best\s*sell|volume\s*by\s*product)\b/i,
    domains: ['product-mix'],
    endpoints: ['/ascend/query'],
    hint: `PRODUCT MIX — Top products by revenue:
1. Product revenue ranking: POST /ascend/query:
   SELECT TOP 15 i.MasterProdID, COUNT(*) AS LineItems, SUM(i.Qty) AS TotalQty, SUM(i.Qty * i.UnitPrice) AS Revenue
   FROM ARInvoiceItem i JOIN DF_PBI_BillingChartQuery b ON i.SysTrxNo = b.SysTrxNo
   WHERE b.Year = 2025 GROUP BY i.MasterProdID ORDER BY Revenue DESC
2. Product name lookup (IDs to names): POST /ascend/query:
   SELECT DISTINCT MasterProdID, MasterProdCode, MasterProdDescr FROM DF_PBI_DS_SalesAndProfitAnalysis WHERE MasterProdID IN (10283,1096,4399,4505,1131,4384,1188)
3. Known top products: 10283=highest revenue, 1096=DDT (Diesel Dyed Transport), 4399=DDB (Diesel Dyed Short Truck), 4505=high volume, 1131=DCT (Diesel Clear Transport), 1188=DCB (Diesel Clear Short Truck)
4. Product table: SELECT ProdID, Code, LongDescr FROM Product — note: ProdID != MasterProdID in many cases`,
  },
  // ── Carrier / Transport ──────────────────────────────────────────
  {
    pattern: /\b(carrier\s*(?:performance|volume|rank)|transport\s*(?:volume|fleet)|short\s*truck|delivery\s*(?:count|volume)|who\s*deliver)\b/i,
    domains: ['carrier-transport'],
    endpoints: ['/ascend/query'],
    hint: `CARRIER / TRANSPORT ANALYSIS — Delivery volume by carrier:
1. Carrier volume ranking: POST /ascend/query:
   SELECT TOP 10 b.Carrier, COUNT(*) AS Deliveries, SUM(i.Qty) AS TotalQty
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 GROUP BY b.Carrier ORDER BY Deliveries DESC
2. Known carriers: DF 1036 Midland Transport, DF 1011 Shreveport Transport, DF 1039 Corpus Christi Transport, DF 1019 Shreveport Short Truck, DF 1022 Lake Charles Short Truck, DF 1020 Midland Short Truck, DF 1047 Colorado Transport, Dale Petroleum Company
3. Carrier + product: add i.MasterProdID to see what each carrier hauls
4. NULL carrier = ~1.2M records (billing items, counter sales, etc.)`,
  },
  // ── Geographic / Ship-To Analysis ────────────────────────────────
  {
    pattern: /\b(geographic|by\s*(?:state|region|location|city|area)|ship\s*to|where\s*(?:do\s*we|are\s*our)\s*(?:deliver|customer|operate)|footprint|territory|market\s*(?:area|coverage))\b/i,
    domains: ['geographic'],
    endpoints: ['/ascend/query'],
    hint: `GEOGRAPHIC ANALYSIS — Revenue by location:
1. Revenue by ship-to (job site level): POST /ascend/query:
   SELECT TOP 10 b.ShipToDescr, SUM(i.Qty * i.UnitPrice) AS Revenue, COUNT(*) AS LineItems
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 GROUP BY b.ShipToDescr ORDER BY Revenue DESC
2. Customer count by state (Address table): POST /ascend/query:
   SELECT TOP 15 a.Phys_State, COUNT(DISTINCT a.Name) AS Customers FROM Address a
   WHERE a.Phys_State IS NOT NULL GROUP BY a.Phys_State ORDER BY Customers DESC
3. Key states: TX (112 customers), LA (113), MS (48), OK (13), FL (13), CO (via DF 1047 Colorado Transport)
4. For GPS coordinates: DF_PBI_BillingChartQuery has Latitude, Longitude fields
5. Revenue by site: add i.MasterSiteID to GROUP BY for site-level granularity`,
  },
  // ── Monthly / Trend Analysis ─────────────────────────────────────
  {
    pattern: /\b(monthly|trend|yoy|year\s*over\s*year|growth|seasonal|month\s*over\s*month|mom|period|quarterly|by\s*month)\b/i,
    domains: ['trends'],
    endpoints: ['/ascend/query'],
    hint: `MONTHLY TREND ANALYSIS — Revenue and customer counts over time:
1. Revenue by month: POST /ascend/query:
   SELECT b.Year, b.Period, SUM(i.Qty * i.UnitPrice) AS Revenue, COUNT(DISTINCT b.CustomerName) AS ActiveCustomers
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year >= 2024 GROUP BY b.Year, b.Period ORDER BY b.Year, b.Period
2. Data range: 2024 Period 1 through 2026 Period 3 (current). ~27 months of trend data.
3. Active customers per month: ~350-425 range
4. For GP trend: add SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost,0))) AS GrossProfit and filter i.Total_UnitCost > 0
5. For salesperson trend: add b.Salesperson to SELECT/GROUP BY`,
  },
  // ── Customer Profitability ───────────────────────────────────────
  {
    pattern: /\b(customer\s*profitab|most\s*profitable|gp\s*by\s*customer|margin\s*by\s*customer|customer\s*margin|best\s*margin|profit\s*per\s*customer)\b/i,
    domains: ['customer-profitability'],
    endpoints: ['/ascend/query'],
    hint: `CUSTOMER PROFITABILITY — Gross profit ranking:
1. GP by customer: POST /ascend/query:
   SELECT TOP 10 b.CustomerName, COUNT(DISTINCT b.SysTrxNo) AS Invoices, SUM(i.Qty) AS TotalQty,
   SUM(i.Qty * i.UnitPrice) AS Revenue, SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost,0))) AS GrossProfit
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 AND i.Total_UnitCost > 0
   GROUP BY b.CustomerName ORDER BY GrossProfit DESC
2. Top profitable: CB&I LLC ($10.3M GP), KZJV LLC ($3.8M), Ageron Energy ($3.1M), MPG Pipeline ($2.7M)
3. For margin %: add (SUM(Revenue) - SUM(COGS)) / SUM(Revenue) * 100 AS MarginPct
4. Salesperson + customer GP: add b.Salesperson to GROUP BY for rep-level profitability`,
  },
  // ── AR / Collections / Outstanding ───────────────────────────────
  {
    pattern: /\b(open\s*invoice|outstanding\s*balance|still\s*due|unpaid|collection|receivable\s*status|ar\s*status|payment\s*status|disputed)\b/i,
    domains: ['ar-collections'],
    endpoints: ['/ascend/query', '/ascend/ar/aging'],
    hint: `AR / COLLECTIONS — Invoice status and outstanding balances:
1. AR status summary: POST /ascend/query:
   SELECT Status, COUNT(*) AS Cnt, SUM(ADOTotalStillDue) AS TotalDue
   FROM ARInvoice WHERE Year >= 2025 GROUP BY Status ORDER BY TotalDue DESC
2. Status codes: O=Open ($42.8M due), A=Active ($17.7M due), C=Closed ($1.2M residual), P=Partial ($547K), D=Disputed ($2.2K), E=other
3. Open invoices detail: POST /ascend/query:
   SELECT TOP 20 InvoiceNo, InvoiceDt, DueDt1, ADOTotalStillDue, ShipToID FROM ARInvoice
   WHERE Status = 'O' AND Year >= 2025 AND ADOTotalStillDue > 0 ORDER BY ADOTotalStillDue DESC
4. Pre-built endpoint: GET /ascend/ar/aging for customer-level aging buckets (0-30, 31-60, 61-90, 90+)
5. Key fields: ADOTotalStillDue (amount owed), ADOAmtApplied (payments applied), DueDt1 (due date), Disputed flag`,
  },
  // ── Rack Price Comparison ────────────────────────────────────────
  {
    pattern: /\b(rack\s*comparison|vendor\s*(?:price|comparison|pricing)|cheapest\s*(?:fuel|diesel|rack)|best\s*(?:price|rack)|supplier\s*comparison|fuel\s*cost\s*comparison)\b/i,
    domains: ['rack-comparison'],
    endpoints: ['/ascend/query'],
    hint: `RACK PRICE COMPARISON — Compare vendor pricing:
1. Latest rack prices by vendor: POST /ascend/query:
   SELECT TOP 10 Vendor_Name, ProductDescr, RackPrice, DiscountPrice, EffDtTm
   FROM vRackPrice ORDER BY EffDtTm DESC
2. Average rack by vendor/product (last 30 days): POST /ascend/query:
   SELECT TOP 10 Vendor_Name, SupplyPoint, ProductDescr, AVG(RackPrice) AS AvgRack, MIN(RackPrice) AS MinRack, MAX(RackPrice) AS MaxRack
   FROM vRackPrice WHERE EffDtTm >= DATEADD(day, -30, GETDATE())
   GROUP BY Vendor_Name, SupplyPoint, ProductDescr ORDER BY AvgRack DESC
3. Key vendors: DTN LLC, Sunoco LP, ExxonMobil, Fuel Masters LLC, Dale Petroleum, Delek, Calumet, Motiva
4. Prices updated daily — always show EffDtTm for freshness
5. Filter by supply point: WHERE SupplyPoint LIKE 'TX%' for Texas terminals`,
  },
  // ── Customer / Account lookup ──────────────────────────────────────
  {
    pattern: /\b(customer\s*(?:in|near|at)|account\s*(?:in|near|at)|who\s*(?:do\s*we|are\s*our)\s*(?:serve|deliver|sell))\b/i,
    domains: ['geo-customers'],
    endpoints: ['/ascend/query', '/ascend/customers', '/ascend/sites', '/salesforce/accounts'],
    hint: `CUSTOMER GEO LOOKUP — Use Address table:
1. POST /ascend/query: SELECT Id, Name, Phys_City, Phys_State, Phys_Postal_Code FROM Address WHERE Customer = 1 AND (Phys_City LIKE '%target_city%' OR Phys_State = 'XX')
2. Cross-reference with /ascend/sites for GPS coordinates and site assignments.
3. Check /salesforce/accounts for CRM data on the same accounts.`,
  },
  // ── DTN / Rack Pricing ──────────────────────────────────────────────
  {
    pattern: /\b(rack\s*price|dtn|supply\s*point|wholesale|posted\s*price|index\s*price|terminal\s*price|spot\s*price)\b/i,
    domains: ['rack-pricing'],
    endpoints: ['/ascend/query'],
    hint: `DTN/RACK PRICING — Live daily pricing from suppliers:
1. Current rack prices: POST /ascend/query:
   SELECT TOP 20 Vendor_Name, SupplyPoint, ProductDescr, EffDtTm, RackPrice, DiscountPrice
   FROM vRackPrice WHERE ProductDescr LIKE '%Diesel%Dyed%' ORDER BY EffDtTm DESC
2. For specific supply points (TX, LA): add WHERE SupplyPoint LIKE 'TX%' or 'LA%'
3. For index prices: SELECT TOP 10 * FROM IndexPrice ORDER BY EffDtTm DESC
4. For purchase rack: SELECT TOP 10 * FROM PurchRackPrice ORDER BY EffDtTm DESC
5. DTN rack prices are updated daily — always show the EffDtTm so users know freshness.
6. Key vendors: DTN LLC, Sunoco LP, Calumet, Delek, Motiva`,
  },
  // ── SharePoint / Document Search ───────────────────────────────────
  {
    pattern: /\b(document|file|sharepoint|onedrive|spreadsheet|presentation|procedure|sop|manual|policy|fleet\s*doc|logistics\s*doc)\b/i,
    domains: ['documents'],
    endpoints: ['/microsoft/search', '/microsoft/sites'],
    hint: `MICROSOFT 365 DOCUMENT SEARCH:
1. Search all SharePoint + OneDrive: GET /microsoft/search?q=your+search+terms
2. List all SharePoint sites: GET /microsoft/sites
3. For fleet/logistics docs: GET /microsoft/search?q=fleet+logistics
4. For pricing docs: GET /microsoft/search?q=pricing+matrix+tank
5. Results include file names, locations, and site context.`,
  },
  // ── Logistics / Fleet Operations ───────────────────────────────────
  {
    pattern: /\b(logistics|dispatch|route|delivery\s*schedule|freight\s*rate|carrier|transport|bol|bill\s*of\s*lading)\b/i,
    domains: ['logistics'],
    endpoints: ['/ascend/query', '/samsara/vehicles', '/samsara/locations'],
    hint: `LOGISTICS — Use multiple data sources:
1. Order tracking: POST /ascend/query: SELECT TOP 20 * FROM LogisticsOrderTracking ORDER BY 1 DESC
2. Price tracking: POST /ascend/query: SELECT TOP 20 * FROM LogisticsPriceTracking ORDER BY 1 DESC
3. Fleet positions: GET /samsara/locations for live GPS
4. Carriers: available in DF_PBI_BillingChartQuery.Carrier field
5. BOL data: check BOL-related tables via /ascend/query
6. For fleet docs: GET /microsoft/search?q=fleet+dispatch+route`,
  },
  // ── Vendor / AP / Procurement ───────────────────────────────────────
  {
    pattern: /\b(vendor|supplier|ap\s*spend|accounts?\s*payable|purchase\s*journal|top\s*vendor|vendor\s*spend|procurement\s*spend|vroozi)\b/i,
    domains: ['vendors'],
    endpoints: ['/ascend/query', '/ascend/vendors', '/ascend/ap/purchases', '/vroozi/suppliers', '/vroozi/purchase-orders'],
    hint: `VENDOR / AP ANALYSIS — Cross-reference Ascend + Vroozi:
1. Top vendors by spend: POST /ascend/query:
   SELECT TOP 20 vendor_name, vendor_display_id, COUNT(DISTINCT invoice_no) AS InvoiceCount, SUM(debit) AS TotalSpend, MIN(invoice_date) AS FirstInvoice, MAX(invoice_date) AS LastInvoice
   FROM vPurchaseJournal WHERE Year_For_Period = 2025
   GROUP BY vendor_name, vendor_display_id ORDER BY TotalSpend DESC
2. Vendor spend by GL account: POST /ascend/query:
   SELECT TOP 20 vendor_name, Account_Desc, SUM(debit) AS Spend
   FROM vPurchaseJournal WHERE Year_For_Period = 2025
   GROUP BY vendor_name, Account_Desc ORDER BY Spend DESC
3. Vroozi suppliers: GET /vroozi/suppliers — 25 suppliers with address, contacts, PO config
4. Vroozi POs: GET /vroozi/purchase-orders — active purchase orders with status, supplier, amounts
5. Cross-reference key: Vroozi externalId/vendorId = Ascend vendor_display_id
6. Key table: vPurchaseJournal (vendor_name, vendor_display_id, invoice_no, invoice_date, Account_Desc, account, debit, credit, Period, Year_For_Period)
7. Known top 2025 vendors: Vtex LLC ($51.6M), Calumet Lubricants ($38.8M), Dale Petroleum ($32.9M), Valero ($23.7M), Paylocity ($20.4M)
8. Note: Only 25 suppliers in Vroozi (operational). Major fuel suppliers are Ascend-only.`,
  },
  // ── Revenue Summary ─────────────────────────────────────────────────
  {
    pattern: /\b(total\s*revenue|annual\s*revenue|revenue\s*(?:summary|breakdown|by\s*(?:product|account|period))|how\s*much\s*(?:revenue|did\s*we\s*(?:make|earn|bill))|top\s*line|sales\s*revenue)\b/i,
    domains: ['financial'],
    endpoints: ['/ascend/revenue', '/ascend/revenue/by-customer'],
    hint: `REVENUE SUMMARY — Pre-built endpoints with GL-level data:
1. Revenue by account/period: GET /ascend/revenue?year=2025 — returns Account_Desc, Period (1-12), Revenue, Units. 355 rows covering all revenue accounts (Diesel Dyed, Diesel Clear, Unleaded, Propane, Lubricants, Additive, Equipment Rental, Sales Discounts, etc.)
2. Revenue by customer: GET /ascend/revenue/by-customer?year=2025 — returns CustomerName, CustType, Revenue, Units, Invoices. 805 rows.
3. Key accounts: Revenue - Diesel Dyed (largest), Revenue - Diesel Clear, Revenue - Unleaded Regular, Revenue - Lubricant, Revenue - Propane
4. Period = fiscal month (1=Jan, 12=Dec). Revenue values are GL-posted amounts.
5. For SQL-level product revenue: use product-mix pattern with ARInvoiceItem join.`,
  },
  // ── Trial Balance ──────────────────────────────────────────────────
  {
    pattern: /\b(trial\s*balance|tb\b|account\s*balance|gl\s*balance|general\s*ledger\s*balance|chart\s*of\s*accounts\s*balance)\b/i,
    domains: ['financial'],
    endpoints: ['/ascend/gl/trial-balance'],
    hint: `TRIAL BALANCE — Full GL account balances by profit center:
1. GET /ascend/gl/trial-balance?year=2025&period=12 — returns T (account type: A=Asset, L=Liability, Q=Equity, R=Revenue, X=Expense), AcctDesc, Natural (GL account number), PC (profit center code), PCDesc, BegBal, Period_Debit, Period_Credit, MTDNet, EndBal. ~2,008 rows.
2. Account types: A=Asset, L=Liability, Q=Equity, R=Revenue, X=Expense
3. Natural = GL natural account number (e.g., 10000=Petty Cash, 17200=Vehicles, 50130=COGS-Clear Diesel, 85200=Interest Expense)
4. Filter by type for balance sheet items (A, L, Q) vs income statement items (R, X)
5. Each row is a unique account + profit center combination
6. Use for reconciliation, account-level detail, or building custom financial statements.`,
  },
  // ── Equity ─────────────────────────────────────────────────────────
  {
    pattern: /\b(equity|retained\s*earnings|shareholder|owner.*equity|stockholder|net\s*worth|book\s*value|capital\s*account)\b/i,
    domains: ['financial'],
    endpoints: ['/ascend/gl/equity'],
    hint: `EQUITY — Retained earnings and equity accounts:
1. GET /ascend/gl/equity?year=2025 — returns AcctDesc, Period, BegBal, Debits, Credits, MTDNet, EndBal. ~1,068 rows.
2. Key account: Retained Earnings (largest single balance at -$27.16M BegBal — negative = credit balance = equity)
3. Also includes: Common Stock, Additional Paid-in Capital, Treasury Stock, Distributions
4. Multiple rows per account (one per profit center per period)
5. Use period=12 for year-end balances. EndBal is cumulative through that period.`,
  },
  // ── BOL / Bill of Lading / Fuel Purchases ─────────────────────────
  {
    pattern: /\b(bol\b|bill\s*of\s*lading|fuel\s*purchase|inbound\s*fuel|purchase\s*(?:summary|volume)|supplier\s*(?:purchase|volume|bol)|supply\s*point|load\s*count|allocation|credit)\b/i,
    domains: ['bol'],
    endpoints: ['/ascend/query'],
    hint: `BOL / FUEL PURCHASE ANALYSIS — CRITICAL: Always use vBOLHdrInfo view (NOT raw BOLHdr.FromSiteID). The view has supplier names resolved.
1. BOL summary by supplier + supply point + carrier: POST /ascend/query:
   SELECT TOP 50 h.SupplierCode, h.SupplierDescr, h.SupplyPtCode, h.SupplyPtDescr, h.CarrierDescr, COUNT(*) AS BOLCount, SUM(h.TotalItemAmt) AS TotalAmt
   FROM vBOLHdrInfo h JOIN BOLHdr b ON h.VSysTrxNo = b.SysTrxNo
   WHERE b.BOLDtTm >= '2026-01-01' AND b.BOLDtTm < '2026-02-01'
   GROUP BY h.SupplierCode, h.SupplierDescr, h.SupplyPtCode, h.SupplyPtDescr, h.CarrierDescr ORDER BY BOLCount DESC
NEVER query BOLHdr.FromSiteID directly — it returns numeric IDs without names. Always use vBOLHdrInfo which resolves SupplierCode, SupplierDescr, SupplyPtDescr, CarrierDescr.
2. BOL product breakdown: POST /ascend/query:
   SELECT d.Code, d.Descr, COUNT(*) AS Lines, SUM(d.NetQty) AS TotalGallons, SUM(d.Amt) AS TotalAmt
   FROM vBolItemDetails d JOIN BOLHdr b ON d.SysTrxNo = b.SysTrxNo
   WHERE b.BOLDtTm >= '2026-01-01' AND b.BOLDtTm < '2026-02-01'
   GROUP BY d.Code, d.Descr ORDER BY TotalGallons DESC
3. Key views: vBOLHdrInfo (SupplierCode, SupplierDescr, SupplyPtCode, SupplyPtDescr, CarrierDescr, TotalItemAmt), vBolItemDetails (Code, Descr, NetQty, Amt, GrossQty)
4. Key tables: BOLHdr (SysTrxNo, BOLNo, BOLDtTm, CarrierID, FromSiteID), BOLItem (SysTrxNo, MasterProdID)
5. Jan 2026 verified: 2,612 BOLs, $28.4M. Top suppliers: Flint Hills (FHRUB), Calumet (CALC), Vtex (VTEXCA), Valero (VALUB), Sunoco (SUNUB), Enterprise (ENTPRO)
6. Product DO = Ultra Low Sulfur #2 Fuel Oil Dyed (6.4M gal, $11M in Jan 2026)
7. Supply points map to DTN rack: TX2685=Magellan Odessa, LA2394=ERPC Bossier City, TX2747=Three Rivers, LA2378=Calumet Shreveport`,
  },
  // ── Sales KPI / Performance Evaluation ──────────────────────────────
  {
    pattern: /\b(kpi|hitting\s*(?:target|goal|number)|sales\s*(?:scorecard|performance\s*review|activity\s*report)|activity\s*count|visit\s*count|(?:weekly|monthly)\s*activit|rep\s*(?:performance|compliance)|rig\s*check.?in|how\s*(?:many|much)\s*(?:activit|visit|call|meeting)|am\s*i\s*hitting)\b/i,
    domains: ['sales-kpi'],
    endpoints: ['/salesforce/tasks', '/salesforce/events', '/salesforce/opportunities'],
    hint: `SALES KPI EVALUATION — Cross-reference Salesforce activity data against division targets:
1. Activity count by rep: POST /salesforce/query:
   SELECT OwnerId, Owner.Name, COUNT(Id) AS ActivityCount FROM Event WHERE CreatedDate = THIS_WEEK GROUP BY OwnerId, Owner.Name ORDER BY ActivityCount DESC
   (Also query Task: SELECT OwnerId, Owner.Name, COUNT(Id) FROM Task WHERE CreatedDate = THIS_WEEK GROUP BY OwnerId, Owner.Name)
2. Visit count (Events with Subject containing 'Visit' or 'Site Visit'): POST /salesforce/query:
   SELECT OwnerId, Owner.Name, COUNT(Id) AS VisitCount FROM Event WHERE Subject LIKE '%Visit%' AND CreatedDate = THIS_WEEK GROUP BY OwnerId, Owner.Name
3. Opportunity creation this month: POST /salesforce/query:
   SELECT OwnerId, Owner.Name, COUNT(Id) AS NewOpps, SUM(Amount) AS TotalAmount FROM Opportunity WHERE CreatedDate = THIS_MONTH GROUP BY OwnerId, Owner.Name
4. Close rate: POST /salesforce/query:
   SELECT OwnerId, Owner.Name, StageName, COUNT(Id) AS Cnt FROM Opportunity WHERE CloseDate = THIS_YEAR AND (StageName = 'Closed Won' OR StageName = 'Closed Lost') GROUP BY OwnerId, Owner.Name, StageName

DIVISION KPI TARGETS (compare actual counts against these):
  Commercial: 60 activities/week, 5 existing + 15 new prospect visits/week, 4 new opps/month, 2 new accounts/month (Closed Won), $20K-$40K new GP/month, 35% close rate, min $25K GP/account, $20K annual GP increase YoY
  Industrial: 50 activities/week (10 total if <5 new prospects), 1 new + 2 existing visits/week, 4 new + 8 existing target accounts/month, 3 RFQ/month, 2 RFP/quarter, 1 new account/quarter, avg GP $250K/account
  O&G Field: 60 activities/week, 15 new + 15 existing rig check-ins/week, 4 new opps/month, 1 new account/month, avg GP $328K/account
  O&G Corporate: 60 activities/week, 2 new + 4 existing visits/week (8+16/month), 2 RFP/month, 2 RFQ/quarter, 1 new account/month, 1 closed/quarter, avg GP $328K/account
  Contractor: 60 activities/week, 2 existing + 3 new prospect visits/week, 2 new opps/month, 1 new customer/month (Closed Won), $5K-$10K new GP/month, $10K annual GP increase YoY

SALESFORCE ACTIVITY RULES:
  - Activity types: Log a Call, Task (reminders only), New Event (visits, meetings, emails that happened)
  - Internal Event/Meeting = excluded from external activity count
  - Rig Check-In = O&G Field specific, logged separately
  - If it is not in Salesforce, it did not happen
  - Opportunity stages: Suspect (10%) → Prospect Analysis (20%) → Qualified → Closed Won / Closed Lost
  - Reps must update stage, expected close date, and estimated GP at each progression`,
  },
  // ── Salesforce Activity Logging Guide ─────────────────────────────
  {
    pattern: /\b(how\s*(?:to|do\s*i)\s*(?:log|create|record)|log\s*(?:a\s*)?(?:visit|call|event|activity|check.?in)|create\s*(?:a\s*)?(?:opportunity|account|prospect|lead)|salesforce\s*(?:guide|how|help|tutorial))\b/i,
    domains: ['sales-process'],
    endpoints: ['/salesforce/tasks', '/salesforce/events', '/salesforce/opportunities', '/salesforce/accounts'],
    hint: `SALESFORCE ACTIVITY LOGGING GUIDE:

HOW TO LOG A VISIT:
1. Search for the Account in Salesforce
2. Scroll to Activity section, click "New Event"
3. Set 3 required fields: Subject (Site Visit/Customer Visit), Date/Time, Related To (Account)
4. Save. Visit notes should include: what was discussed, customer needs, Delta360 solutions presented, follow-up actions

HOW TO LOG A PHONE CALL:
1. Go to Account page
2. Click "Log a Call" in Activity section
3. Set Subject to "Outbound Phone Call" or "Inbound Phone Call"
4. Set date and time, Save
Note: Phone calls count toward activity numbers but do NOT count as visits

HOW TO CREATE AN OPPORTUNITY:
1. Go to Account page, click "Create Opportunity"
2. Select Opportunity Type from dropdown
3. Fill in: Name, Stage (Suspect/Prospect Analysis/Qualified), Expected Close Date, Estimated GP, Amount
4. Update Stage as deal progresses. Mark Closed Won or Closed Lost when done.

HOW TO CREATE A PROSPECT ACCOUNT:
1. Accounts tab → "Create Parent Account"
2. Select Account Type from dropdown
3. Fill in: Company Name, Industry, Address, Phone, Website
4. Save. Then log visits and create opportunities on this account.

RIG CHECK-INS (O&G Field only):
1. Go to Account record
2. Click "Create Check-In"
3. Enter contact person and check-in details
4. Save. Tracked separately from regular visits.

RULES:
- Internal meetings: set Subject to "Internal Event/Meeting" (excluded from external count)
- Task tool: use ONLY for reminders/to-dos, not for logging past activities
- New Event: primary place to log emails, site visits, meetings that HAVE taken place`,
  },
  // ── Rig Check-Ins (O&G Field) ──────────────────────────────────────
  {
    pattern: /\b(rig\s*check.?in|check.?in|field\s*visit|rig\s*visit|drilling\s*site|production\s*site|well\s*site)\b/i,
    domains: ['sales-kpi'],
    endpoints: ['/salesforce/query'],
    hint: `RIG CHECK-INS (O&G Field division only):
1. Check_In__c is a CUSTOM Salesforce object for O&G Field rig visits. Query: POST /salesforce/query:
   SELECT Id, Name, CreatedDate, CreatedById, Contact__c, Account__c, Notes__c FROM Check_In__c WHERE CreatedDate = THIS_WEEK ORDER BY CreatedDate DESC
2. Count by rep: SELECT CreatedById, COUNT(Id) AS CheckIns FROM Check_In__c WHERE CreatedDate >= 2026-03-01T00:00:00Z GROUP BY CreatedById
3. O&G Field target: 30 check-ins/week (15 new rigs + 15 existing rigs)
4. O&G Field reps: Ashlee Hey (005Hu00000S1SXfIAN), Patience Hill (005cx000004xgYnAAI), Anna Snodgrass (005Hu00000S2EZPIA3)
5. If Check_In__c returns error, the object may have a different API name. Try: SELECT Id FROM Check_In__c LIMIT 1 to verify it exists.`,
  },
  // ── Tank Assignments & Equipment Sites ───────────────────────────
  {
    pattern: /\b(tank\s*assign|equipment\s*at\s*site|site\s*equipment|deployed\s*tank|assigned\s*tank|tank\s*at|equipment\s*deploy)\b/i,
    domains: ['equipment'],
    endpoints: ['/ascend/tanks/assignments', '/ascend/tanks', '/ascend/equipment', '/ascend/sites'],
    hint: `TANK ASSIGNMENTS & SITE EQUIPMENT:
1. Tank assignments: GET /ascend/tanks/assignments — which tanks are deployed to which customer sites
2. All tanks: GET /ascend/tanks — full inventory with capacity, type (DW/SW), product, status
3. Equipment: GET /ascend/equipment — all asset types (tanks, pumps, meters, hoses)
4. Sites: GET /ascend/sites — customer delivery sites with GPS coordinates
5. Cross-reference: tank assignments link to sites and customers for a complete deployment map`,
  },
  // ── Vroozi Procurement ──────────────────────────────────────────
  {
    pattern: /\b(purchase\s*order|po\s*status|vroozi|procurement|catalog|cost\s*center|gl\s*account|spending\s*limit|approval\s*limit)\b/i,
    domains: ['procurement'],
    endpoints: ['/vroozi/purchase-orders', '/vroozi/suppliers', '/vroozi/users', '/vroozi/gl-accounts', '/vroozi/catalogs'],
    hint: `VROOZI PROCUREMENT:
1. Purchase orders: GET /vroozi/purchase-orders — POs with status, supplier, amounts (25 per page)
2. Suppliers: GET /vroozi/suppliers — 25 suppliers with address, contacts, vendorId
3. Users: GET /vroozi/users — 125 users with roles (AP_EDITOR, EMPLOYEE, APPROVER), approvalLimit, spendLimit, default shipping/profitCenter
4. GL accounts: GET /vroozi/gl-accounts — 889 accounts with externalId (GL code), code, description, companyCodeRef. Departments: Sales & BD, Maintenance & Shop, Ops Supervision, Dispatch, Freight, Field Ops
5. Catalogs: GET /vroozi/catalogs — 2,605 catalogs (PUNCH_OUT/HOSTED type) with supplier refs, status, validity dates
6. Cost centers: GET /vroozi/cost-centers — 0 records currently
7. Company: Delta Fuel Company LLC (code 01). Profit centers: Midland (1020), Shreveport, Lake Charles, Corpus Christi, Colorado`,
  },
  // ── Salesperson Account Report ────────────────────────────────────
  {
    pattern: /\b(salesperson\s*(?:report|account|customer|ship\s*to)|rep\s*(?:account|customer|book)|account\s*(?:list|book)\s*(?:for|by)|(?:standard\s*acct|ship\s*to)\s*(?:for|by)\s*(?:salesperson|rep))\b/i,
    domains: ['sales-performance'],
    endpoints: ['/ascend/query'],
    hint: `SALESPERSON ACCOUNT REPORT — Standard Acct + ShipTo with GP:
1. Full account book by salesperson: POST /ascend/query:
   SELECT b.StandardAcctNo, b.CustomerName, st.Code AS ShipToCode, b.ShipToDescr, b.CustType,
   COUNT(DISTINCT b.SysTrxNo) AS Invoices, SUM(i.Qty) AS TotalQty,
   SUM(i.Qty * i.UnitPrice) AS Revenue,
   SUM(CASE WHEN i.Total_UnitCost > 0 THEN i.Qty * ISNULL(i.Total_UnitCost, 0) ELSE 0 END) AS COGS,
   SUM(CASE WHEN i.Total_UnitCost > 0 THEN i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost, 0)) ELSE 0 END) AS GrossProfit,
   MIN(b.InvoiceDt) AS FirstInvoice, MAX(b.InvoiceDt) AS LastInvoice
   FROM DF_PBI_BillingChartQuery b
   JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   LEFT JOIN ARShipTo st ON b.ShipToID = st.ShiptoID
   WHERE b.Salesperson LIKE '%LastName%' AND b.InvoiceDt >= DATEADD(month, -24, GETDATE()) AND i.Total_UnitCost > 0
   GROUP BY b.StandardAcctNo, b.CustomerName, st.Code, b.ShipToDescr, b.CustType
   ORDER BY GrossProfit DESC
2. st.Code = the 3-digit ShipTo code (001, 002, 003)
3. CRITICAL: filter i.Total_UnitCost > 0 to exclude rows without cost data
4. For GP margin: add (GrossProfit/Revenue)*100 in the output
5. Known salespersons: search by Salesperson LIKE '%LastName%'`,
  },
  // ── SalesAlias / Product Lookup ─────────────────────────────────
  {
    pattern: /\b(sales\s*alias|product\s*code|product\s*container|prod\s*cont|sell\s*as|product\s*lookup|what\s*product|product\s*descr)\b/i,
    domains: ['products'],
    endpoints: ['/ascend/query'],
    hint: `SALES ALIAS / PRODUCT LOOKUP:
1. All sales aliases: POST /ascend/query:
   SELECT sa.SalesAliasID, sa.Code AS SalesAlias_Code, sa.SellAsDescr AS SalesAlias_Descr,
   p.Code AS Product_Code, p.LongDescr AS Product_Descr, c.Code AS Container_Code, c.LongDescr AS Container_Descr
   FROM SalesAlias sa JOIN ProdCont pc ON sa.ProdContID = pc.ProdContID
   JOIN Product p ON pc.ProdID = p.ProdID JOIN Container c ON pc.ContID = c.ContID
   ORDER BY sa.SalesAliasID
2. 2,493 sales aliases in the system
3. Dept/Seg/Cat NOT in SQL — use reference file data (stored in DI knowledge base)
4. MasterProdID in BillingChartQuery maps to MasterProdCode/MasterProdDescr in DF_PBI_DS_SalesAndProfitAnalysis (but that view only has data to Jan 2022)`,
  },
  // ── Customer Address Lookup ──────────────────────────────────────
  {
    pattern: /\b(customer\s*address|where\s*is\s*(?:the\s*)?customer|customer\s*location|contact\s*info|billing\s*address|physical\s*address|find\s*customer)\b/i,
    domains: ['customers'],
    endpoints: ['/ascend/query', '/salesforce/query'],
    hint: `CUSTOMER ADDRESS / CONTACT LOOKUP:
1. Ascend addresses: POST /ascend/query:
   SELECT Id, Name, Phys_City, Phys_State, Phys_Postal_Code, Phys_Address1, Phone FROM Address WHERE Name LIKE '%customer_name%' AND Customer = 1
2. Salesforce contacts: POST /salesforce/query:
   SELECT Id, FirstName, LastName, Email, Phone, MobilePhone, Title, Account.Name FROM Contact WHERE Account.Name LIKE '%customer_name%'
3. Salesforce accounts: POST /salesforce/query:
   SELECT Id, Name, BillingCity, BillingState, Phone, Website, Industry FROM Account WHERE Name LIKE '%customer_name%'
4. Cross-reference: same customer may have different name in Ascend vs Salesforce. Use entity resolver for fuzzy matching.`,
  },
  // ── Email Management ──────────────────────────────────────────────
  {
    pattern: /\b(email|inbox|mailbox|flag\s*email|categorize\s*email|inbox\s*rule|email\s*rule|prioritize\s*inbox|organize\s*email|sort\s*email|check\s*email|read\s*email|send\s*email|unread|mail\s*folder)\b/i,
    domains: ['email'],
    endpoints: ['/microsoft/query', '/microsoft/write'],
    hint: `EMAIL MANAGEMENT — You have FULL access to all @delta360.energy mailboxes via Microsoft Graph:

READING EMAILS:
1. Use the read_email tool with userEmail to read any mailbox
2. Returns: id, subject, from, fromEmail, date, preview, isRead, importance
3. Search: pass a search string to filter by keyword
4. Unread only: set unreadOnly=true

FLAGGING & CATEGORIZING:
1. First: call read_email to get message IDs
2. Then: call manage_email with action='flag' and the message IDs
3. Categories: Red category, Orange category, Yellow category, Green category, Blue category, Purple category
4. Use action='categorize' with the category name and message IDs

CREATING INBOX RULES:
Use manage_email with action='createRule' and a rule object:
{
  "displayName": "Priority Senders",
  "sequence": 1,
  "isEnabled": true,
  "conditions": { "senderContains": ["avegas@delta360.energy", "rstewart@delta360.energy"] },
  "actions": { "markImportance": "high", "flag": { "flagStatus": "flagged" } }
}

MOVING EMAILS:
1. Use manage_email with action='createFolder' to create a target folder
2. Then use action='move' with message IDs and folderName

SENDING EMAILS:
Use send_email with from (sender), to, subject, body (HTML supported)

WORKFLOW: To prioritize someone's inbox:
Step 1: read_email (get last 20 messages with IDs)
Step 2: Filter by sender/keyword in the results
Step 3: manage_email action='categorize' for matching messages
Step 4: manage_email action='createRule' for ongoing auto-categorization`,
  },
  // ── Commissions ────────────────────────────────────────────────────
  {
    pattern: /\b(commission|sales\s*commission|commission\s*(?:expense|accrual|by\s*(?:pc|profit\s*center|rep|salesperson))|accrued?\s*commission)\b/i,
    domains: ['financial'],
    endpoints: ['/ascend/commissions'],
    hint: `COMMISSIONS — GL journal entries for commission accruals:
1. GET /ascend/commissions?year=2025 — returns PostPeriod, Code (journal entry code e.g. GJ202512-034), PC (profit center), AccountNumber, Description, Dr (debit), Cr (credit). 312 rows.
2. Pattern: Corporate PC 0001 gets the credit (liability accrual), individual profit centers get debits (expense allocation)
3. Description format: "Accrued Commissions MM.YY" or "Reclass PC XXXX to YYYY MM.YY"
4. Reclasses move commission expense between profit centers (e.g., 1037 to 1022, 1038 to 0001)
5. Key PCs with commission expense: 1009 (Contractors), 1016 (Mobile Fueling), 1036 (Midland Transport), 1039 (Corpus Christi), 1022 (Lake Charles)
6. To get total commission expense: sum Dr values excluding reclasses, or sum all Dr for a specific PC.`,
  },
  // ── Fixed Assets / Depreciation ────────────────────────────────────
  {
    pattern: /\b(fixed\s*asset|depreciation|capital\s*asset|book\s*value|asset\s*(?:register|schedule|roll\s*forward)|accumulated\s*depreciation|right\s*of\s*use|rou\b|construction\s*in\s*progress|cip\b)\b/i,
    domains: ['financial'],
    endpoints: ['/ascend/assets/fixed'],
    hint: `FIXED ASSETS — Asset roll-forward with additions, disposals, depreciation:
1. GET /ascend/assets/fixed?year=2025 — returns AcctDesc, Natural (GL account), BegBal, Additions, Disposals, NetChange, EndBal. 13 rows (one per asset category).
2. Categories: Land, Buildings, Vehicles ($16.6M end), Field Equipment ($14.6M end), Plant Equipment, Furniture & Fixtures, Computer Equipment, Leasehold Improvements, Construction In Progress ($710K end)
3. Accumulated Depreciation: BegBal -$14.8M, EndBal -$18.2M (net depreciation charge of $3.4M)
4. Right of Use Assets: Financing ($2.8M end) and Operating ($453K end) — IFRS 16 / ASC 842 lease accounting
5. Fa_Depreciation table exists but is empty — use this endpoint for depreciation data instead.
6. Vehicles had $12.7M additions and $5.9M disposals in 2025 — heavy fleet turnover.`,
  },
  // ── Sites / Locations ──────────────────────────────────────────────
  {
    pattern: /\b(site\s*(?:list|lookup|location|address|code)|branch(?:es)?|office\s*location|where\s*(?:are\s*our|do\s*we\s*have)\s*(?:sites|offices|branches|locations)|physical\s*location)\b/i,
    domains: ['sites'],
    endpoints: ['/ascend/sites'],
    hint: `SITES — Physical locations with GPS coordinates:
1. GET /ascend/sites — returns SiteID, Code, LongDescr (location name), GLMacroSub, ProfitCenter, FormattedAddress, Latitude, Longitude, Inactive (Y/N). 78 rows.
2. Active sites include: Corporate (0001), Ferriday, St Joseph, Tallulah, Monroe, Natchez, Shreveport, Midland, Lake Charles, Corpus Christi, Houston, Denver, El Dorado, plus card locks and direct ship locations
3. VTEX sites: Corporate-VTEX (3000), North Louisiana (3001), Magellan Midland (3002), Magellan Odessa (3003)
4. Inactive=Y for closed sites (e.g., Validus Frac OK)
5. GLMacroSub maps to GL posting (e.g., 1020***** = Midland)
6. ProfitCenter field links to /ascend/profit-centers for the full PC description.`,
  },
  // ── Profit Centers ─────────────────────────────────────────────────
  {
    pattern: /\b(profit\s*center\s*(?:list|lookup|code|all)|list\s*(?:all\s*)?(?:pc|profit\s*center)|pc\s*(?:list|lookup|code|directory)|what\s*(?:are|is)\s*(?:the\s*)?(?:pc|profit\s*center))\b/i,
    domains: ['reference'],
    endpoints: ['/ascend/profit-centers'],
    hint: `PROFIT CENTERS — Reference list of all 43 PCs:
1. GET /ascend/profit-centers — returns PC (code) and PCDesc (description). 43 rows.
2. Key PCs: 0001=Corporate, 1001=Ferriday, 1019=Shreveport, 1020=Midland, 1022=Lake Charles, 1039=Corpus Christi, 1044=Houston, 1047=Denver
3. Functional PCs: 1004=Government, 1009=Contractors, 1010=Propane, 1012=Welding Shop, 1016=Mobile Fueling, 1017=Truck Shop, 1018=Central Lube, 1021=Airplane
4. VTEX PCs: 3000=Corporate-VTEX, 3001=North Louisiana-VTEX, 3002=East Texas-VTEX
5. Transport PCs: 1011=Shreveport Transport, 1036=Midland Transport, 1037=Lake Charles Transport
6. Use this as reference to decode PC codes in other financial data.`,
  },
  // ── Inventory / Stock Status ───────────────────────────────────────
  {
    pattern: /\b(inventory|stock\s*(?:status|level|on\s*hand)|warehouse|in\s*stock|out\s*of\s*stock|product\s*inventory|lubricant\s*inventory|wac|weighted\s*average\s*cost)\b/i,
    domains: ['inventory'],
    endpoints: ['/ascend/query'],
    hint: `INVENTORY / STOCK STATUS — DF_PBI_Inventory_StockStatus table:
1. POST /ascend/query: SELECT TOP 20 SiteDesc, ProdDescr, ContDescr, OnHandUOMDescr, EndingQty, EndingAmt, BegWac, EndWac, CostMethod, PostingPeriod FROM DF_PBI_Inventory_StockStatus WHERE EndingQty > 0 ORDER BY EndingAmt DESC
2. Columns: DateRangeorPeriod, CompanyName, SiteID, SiteCode, SiteDesc, ProdID, ProdCode, ProdDescr, ContID, ContCode, ContDescr, OnHandUOMDescr, BeginningQty, EndingQty, EndingAmt, ReceiptQty, ReceiptAmt, AdjustQty, SalesQty, SalesAmt, BegWac, EndWac, CostMethod
3. Sites: Midland (1020), Shreveport, Lake Charles, Corpus Christi, etc.
4. Products: lubricants, additives, DEF, propane — mostly non-fuel inventory tracked by case/gallon
5. PostingPeriod format: "YYYY/MM" — filter by period for point-in-time inventory
6. WAC = Weighted Average Cost method used for valuation
7. For current inventory: filter WHERE PostingPeriod = '2025/12' AND EndingQty > 0`,
  },
  // ── Open Orders / Compliance ───────────────────────────────────────
  {
    pattern: /\b(open\s*order|order\s*(?:status|compliance|backlog)|out\s*of\s*compliance|gp\s*compliance|unfulfilled\s*order|pending\s*order|order\s*queue)\b/i,
    domains: ['orders'],
    endpoints: ['/ascend/query'],
    hint: `OPEN ORDERS / COMPLIANCE — DF_PBI_vOpenOrdersOutofGPCompliance:
1. POST /ascend/query: SELECT TOP 20 * FROM DF_PBI_vOpenOrdersOutofGPCompliance
2. Columns: SysTrxNo, [Out of Compliance] (Y/N)
3. This view flags orders that are out of GP (Great Plains) compliance
4. Cross-reference SysTrxNo with ARInvoice or DF_PBI_BillingChartQuery for order details:
   SELECT o.SysTrxNo, o.[Out of Compliance], b.CustomerName, b.InvoiceDt, b.ShipToDescr
   FROM DF_PBI_vOpenOrdersOutofGPCompliance o
   LEFT JOIN DF_PBI_BillingChartQuery b ON o.SysTrxNo = b.SysTrxNo
5. Use for operational monitoring of order processing compliance.`,
  },
  // ── Year-over-Year / Annual Comparison ─────────────────────────────
  {
    pattern: /\b(year\s*over\s*year|yoy|annual\s*comparison|compare\s*year|2024\s*vs\s*2025|last\s*year\s*vs|prior\s*year|annual\s*growth|year\s*to\s*date|ytd\s*comparison)\b/i,
    domains: ['trends'],
    endpoints: ['/ascend/query', '/ascend/revenue'],
    hint: `YEAR-OVER-YEAR COMPARISON — Annual metrics side by side:
1. Revenue + customers + invoices by year: POST /ascend/query:
   SELECT b.Year, SUM(i.Qty * i.UnitPrice) AS Revenue, COUNT(DISTINCT b.CustomerName) AS ActiveCustomers, COUNT(DISTINCT b.SysTrxNo) AS Invoices
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year IN (2024, 2025) GROUP BY b.Year ORDER BY b.Year
2. 2025 vs 2024: Revenue $1.12B vs $529M (111% growth), Customers ~805 vs 809 (flat), Invoices 39,361 vs 37,979 (+3.6%)
3. Revenue by account type YoY: GET /ascend/revenue?year=2024 vs GET /ascend/revenue?year=2025
4. GP by year: add SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost,0))) AS GrossProfit WHERE i.Total_UnitCost > 0
5. Monthly trend across years: add b.Period to GROUP BY for month-level comparison
6. By profit center YoY: add b.ShipToDescr or use /ascend/costs/by-pc with different year params.`,
  },
  // ── Tank / Equipment specific ──────────────────────────────────────
  {
    pattern: /\b(\d+\s*(?:k|gal|gallon)\s*(?:tank|dw|double\s*wall|single\s*wall)|tank\s*(?:price|cost|quote|inventory|available))\b/i,
    domains: ['tank-pricing'],
    endpoints: ['/ascend/query', '/ascend/tanks', '/ascend/equipment', '/ascend/tanks/assignments'],
    hint: `TANK PRICING — Multi-step using actual Ascend tables:
1. Check inventory: /ascend/tanks for current tank inventory, /ascend/tanks/assignments for deployed vs available
2. Find tank products: POST /ascend/query: SELECT ProdID, Code, LongDescr FROM Product WHERE LongDescr LIKE '%tank%' OR LongDescr LIKE '%double%wall%' OR Code LIKE '%DW%'
3. Historical tank pricing: POST /ascend/query:
   SELECT TOP 20 i.UnitPrice, i.Qty, p.LongDescr, h.InvoiceDt, a.Name AS Customer, a.Phys_City
   FROM ARInvoiceItem i
   JOIN ARInvoice h ON i.SysTrxNo = h.SysTrxNo
   JOIN Address a ON h.ShipToID = a.Id
   JOIN Product p ON i.MasterProdID = p.ProdID
   WHERE (p.LongDescr LIKE '%tank%' OR p.LongDescr LIKE '%double%wall%')
   ORDER BY h.InvoiceDt DESC
4. Also check AdHocPrices table for any override pricing.
5. Present actual transaction prices with dates, not computed averages.`,
  },
  // ── Salesforce Pipeline by Stage ─────────────────────────────────────
  {
    pattern: /\b(pipeline\s*by\s*stage|stage\s*breakdown|deal\s*stage|opportunity\s*stage|funnel\s*breakdown|forecast\s*by\s*stage|won\s*(?:deal|opportunit)|closed\s*won|closed\s*lost)\b/i,
    domains: ['sales'],
    endpoints: ['/salesforce/opportunities'],
    hint: `SALESFORCE PIPELINE BY STAGE — 690 opportunities:
1. All pipeline: GET /salesforce/opportunities — returns Id, Name, StageName, Amount, CloseDate, Probability, Account.Name, OwnerId, CreatedDate
2. Stages: Suspect (10%), Prospect Analysis (20%), Qualified, Closed Won, Closed Lost
3. For stage summary, group results by StageName and sum Amount
4. For SOQL precision: POST /salesforce/query:
   {"soql":"SELECT StageName, COUNT(Id) cnt, SUM(Amount) total FROM Opportunity GROUP BY StageName"}
5. For owner breakdown: add OwnerId to GROUP BY or filter WHERE OwnerId = '005...'`,
  },
  // ── Salesforce Contacts at Company ───────────────────────────────────
  {
    pattern: /\b(contact\s*(?:at|for|from)|who\s*(?:(?:is|are)\s*(?:my|our|the)\s*)?contact|people\s*at|point\s*of\s*contact|key\s*contact|account\s*contact)\b/i,
    domains: ['sales'],
    endpoints: ['/salesforce/contacts', '/salesforce/accounts'],
    hint: `SALESFORCE CONTACTS — 2,185 contacts:
1. All contacts: GET /salesforce/contacts — returns Id, FirstName, LastName, Email, Phone, MobilePhone, Title, Department, Account.Name, MailingCity, MailingState
2. Contacts at a specific company: POST /salesforce/query:
   {"soql":"SELECT FirstName, LastName, Email, Phone, Title FROM Contact WHERE Account.Name LIKE '%company_name%'"}
3. Cross-reference with /salesforce/accounts to get account details (Industry, Type, BillingCity)
4. For decision-makers: filter WHERE Title LIKE '%VP%' OR Title LIKE '%Director%' OR Title LIKE '%Manager%'`,
  },
  // ── Salesforce Support Cases ─────────────────────────────────────────
  {
    pattern: /\b(support\s*case|open\s*case|case\s*(?:status|list|history)|customer\s*issue|ticket|case\s*number|escalat|case\s*priority)\b/i,
    domains: ['support'],
    endpoints: ['/salesforce/cases'],
    hint: `SALESFORCE CASES — Currently 1 case in system:
1. All cases: GET /salesforce/cases — returns Id, CaseNumber, Subject, Status (New/Open/Closed), Priority (High/Medium/Low), Account.Name, CreatedDate, ClosedDate
2. For filtered view: POST /salesforce/query:
   {"soql":"SELECT CaseNumber, Subject, Status, Priority, Account.Name, CreatedDate FROM Case WHERE Status != 'Closed' ORDER BY CreatedDate DESC"}
3. Current case: #00001019 "Pump Failure" — High priority, New status, Tarver Motors Company Inc`,
  },
  // ── Salesforce Leads ─────────────────────────────────────────────────
  {
    pattern: /\b(lead\s*(?:list|status|source|pipeline)|new\s*lead|qualified\s*lead|lead\s*nurtur|lead\s*convert|inbound\s*lead|campaign\s*lead|prospect\s*list)\b/i,
    domains: ['sales'],
    endpoints: ['/salesforce/leads'],
    hint: `SALESFORCE LEADS — 3,359 leads:
1. All leads: GET /salesforce/leads — returns Id, FirstName, LastName, Company, Email, Phone, Status, LeadSource, CreatedDate
2. Lead statuses: New, Qualified, Nurturing
3. Lead sources: Campaign, Rep-Added Lead, External Referral
4. For status breakdown: POST /salesforce/query:
   {"soql":"SELECT Status, COUNT(Id) cnt FROM Lead GROUP BY Status"}
5. Recent leads: POST /salesforce/query:
   {"soql":"SELECT FirstName, LastName, Company, Email, Status, LeadSource, CreatedDate FROM Lead ORDER BY CreatedDate DESC LIMIT 20"}`,
  },
  // ── Salesforce Users / Team ──────────────────────────────────────────
  {
    pattern: /\b(sf\s*user|salesforce\s*user|crm\s*user|who\s*(?:has|uses)\s*salesforce|sales\s*team\s*member|user\s*role|sf\s*admin)\b/i,
    domains: ['sales'],
    endpoints: ['/salesforce/users'],
    hint: `SALESFORCE USERS — 128 users:
1. All users: GET /salesforce/users — returns Id, Name, Email, IsActive, Profile.Name, UserRole.Name, Department
2. Profiles: System Administrator, Service Supervisor, Oil & Gas - Minimum Access, IT- Minimum Access
3. Roles: CEO, COO, Field Sales 1 Oil & Gas, etc.
4. All emails @delta360.energy domain
5. Filter active: POST /salesforce/query:
   {"soql":"SELECT Name, Email, Profile.Name, UserRole.Name FROM User WHERE IsActive = true ORDER BY Name"}`,
  },
  // ── Salesforce Products ──────────────────────────────────────────────
  {
    pattern: /\b(sf\s*product|salesforce\s*product|product\s*catalog|product\s*family|product\s*code|cpq|quote\s*product)\b/i,
    domains: ['sales'],
    endpoints: ['/salesforce/products'],
    hint: `SALESFORCE PRODUCTS — 1,891 products:
1. All products: GET /salesforce/products — returns Id, Name, ProductCode, Family, IsActive, Description
2. Product families: Fittings & Hardware, Hoses & Reels, and more
3. Many products are inactive (IsActive=false) — filter for active only when relevant
4. For active products by family: POST /salesforce/query:
   {"soql":"SELECT Family, COUNT(Id) cnt FROM Product2 WHERE IsActive = true GROUP BY Family"}`,
  },
  // ── Salesforce Tasks / Activities ────────────────────────────────────
  {
    pattern: /\b(sf\s*task|salesforce\s*task|sales\s*activit|activity\s*log|call\s*log|follow\s*up\s*task|overdue\s*task|task\s*(?:list|assign|complete))\b/i,
    domains: ['sales'],
    endpoints: ['/salesforce/tasks'],
    hint: `SALESFORCE TASKS — 20,710 tasks:
1. All tasks: GET /salesforce/tasks — returns Id, Subject, Status (Not Started/Completed), Priority, ActivityDate, Who.Name, What.Name, OwnerId
2. Common subjects: Phone Numbers, Call, Email, Follow Up
3. For open tasks: POST /salesforce/query:
   {"soql":"SELECT Subject, Status, Priority, ActivityDate, Who.Name, What.Name FROM Task WHERE Status = 'Not Started' ORDER BY ActivityDate ASC LIMIT 20"}
4. For tasks by owner: add WHERE OwnerId = '005...'`,
  },
  // ── Salesforce Events / Calendar ─────────────────────────────────────
  {
    pattern: /\b(sf\s*event|salesforce\s*event|calendar|meeting|scheduled\s*(?:visit|call|event)|upcoming\s*(?:event|meeting)|sales\s*visit)\b/i,
    domains: ['sales'],
    endpoints: ['/salesforce/events'],
    hint: `SALESFORCE EVENTS — 4,948 events:
1. All events: GET /salesforce/events — returns Id, Subject, StartDateTime, EndDateTime, Who.Name, What.Name, OwnerId
2. Common subjects: Sales Visit, AR Aging Weekly Review, Rebates Discussion, Data & Reporting
3. For upcoming events: POST /salesforce/query:
   {"soql":"SELECT Subject, StartDateTime, EndDateTime, Who.Name FROM Event WHERE StartDateTime >= TODAY ORDER BY StartDateTime ASC LIMIT 20"}
4. Events span from current to 2027 — includes recurring meetings`,
  },
  // ── Salesforce Raw SOQL ──────────────────────────────────────────────
  {
    pattern: /\b(soql|salesforce\s*query|sf\s*query|custom\s*salesforce|salesforce\s*report)\b/i,
    domains: ['sales'],
    endpoints: ['/salesforce/query'],
    hint: `SALESFORCE SOQL — Raw query access:
1. POST /salesforce/query with body {"soql":"SELECT Id, Name FROM Account LIMIT 5"}
2. Available objects: Account, Contact, Opportunity, Lead, Case, User, Product2, Task, Event
3. Supports GROUP BY, COUNT, SUM, WHERE, LIKE, ORDER BY, LIMIT
4. Use Account.Name for related account lookups on Contact, Opportunity, Case
5. Date filters: WHERE CreatedDate = THIS_MONTH or WHERE CloseDate >= 2026-01-01`,
  },
  // ── Power BI Workspaces / Reports ────────────────────────────────────
  {
    pattern: /\b(power\s*bi|pbi|workspace|dashboard\s*(?:list|report)|bi\s*report|analytics\s*report|sales\s*analytics|operations\s*analytics|financial\s*analytics)\b/i,
    domains: ['analytics'],
    endpoints: ['/powerbi/workspaces'],
    hint: `POWER BI — 5 workspaces available:
1. List workspaces: GET /powerbi/workspaces — returns id, name, type, isOnDedicatedCapacity
2. Workspaces: RMC Online, RMC Online Dev, Sales Analytics (dedicated), Operations Analytics (dedicated), Financial Analytics (dedicated)
3. Note: /powerbi/datasets and /powerbi/reports currently return "API is not accessible for application"
4. Only workspace listing is functional — dataset/report details require additional Power BI API permissions
5. For actual data/reports, use the Ascend ERP SQL endpoints which back most Power BI dashboards`,
  },
  // ── Vroozi Purchase Orders (this month) ──────────────────────────────
  {
    pattern: /\b(vroozi\s*(?:po|purchase|order)|procurement\s*order|po\s*(?:status|list|this\s*month|recent)|purchase\s*request|requisition)\b/i,
    domains: ['procurement'],
    endpoints: ['/vroozi/purchase-orders', '/vroozi/suppliers'],
    hint: `VROOZI PURCHASE ORDERS — 25 POs per page:
1. All POs: GET /vroozi/purchase-orders — returns id, poNumber, status, supplierRef, totalAmount, currency, dateCreated, lineItems[]
2. PO statuses: APPROVED, PENDING, REJECTED, CLOSED
3. Suppliers: 25 active suppliers with vendorId cross-ref to Ascend
4. For recent POs: results are paginated (25 per page), sorted by most recent
5. Cross-reference: Vroozi vendorId = Ascend vendor_display_id for spend analysis
6. Company: Delta Fuel Company LLC (companyCode 01)`,
  },
  // ── Vroozi Cost Centers ──────────────────────────────────────────────
  {
    pattern: /\b(vroozi\s*cost\s*center|procurement\s*cost\s*center|cost\s*(?:center|code)\s*list|department\s*code)\b/i,
    domains: ['procurement'],
    endpoints: ['/vroozi/cost-centers', '/vroozi/gl-accounts'],
    hint: `VROOZI COST CENTERS & GL ACCOUNTS:
1. Cost centers: GET /vroozi/cost-centers — currently returns 0 records (not populated)
2. GL accounts: GET /vroozi/gl-accounts — 889 GL accounts with code, description, companyCodeRef
3. GL account categories: Sales & BD, Maintenance & Shop, Ops Supervision & Mgmt, Dispatch & Logistics, Freight & Transportation, Field Ops & Tech
4. GL suffixes indicate pay type: base (no suffix), -OT (overtime), -PTO, -VEH (vehicle), -Tax
5. Company: Delta Fuel Company LLC (code 01)
6. For cost allocation, use GL accounts as proxy for cost centers`,
  },
  // ── Vroozi Users ─────────────────────────────────────────────────────
  {
    pattern: /\b(vroozi\s*user|procurement\s*user|who\s*(?:can|has)\s*(?:approv|purchas|order)|approval\s*limit|spend\s*limit|purchasing\s*team)\b/i,
    domains: ['procurement'],
    endpoints: ['/vroozi/users'],
    hint: `VROOZI USERS — 125 users (5 pages of 25):
1. All users: GET /vroozi/users — returns id, email, firstname, lastname, roles[], approvalLimit, spendLimit, userDefaults, defaultApproverRef
2. Roles: AP_EDITOR, EMPLOYEE, APPROVER, AP_APPROVER, AP_AUDITOR
3. Approval/spend limits vary by user (e.g., $350 typical)
4. User defaults include: shippingAddress, companyCodeRef, profitCenterRef
5. Profit centers in defaults: Midland (1020), Shreveport, Lake Charles, etc.
6. All emails @delta360.energy domain`,
  },
  // ── Vroozi Catalogs ──────────────────────────────────────────────────
  {
    pattern: /\b(vroozi\s*catalog|procurement\s*catalog|punch\s*out|hosted\s*catalog|supplier\s*catalog|catalog\s*(?:list|item|search))\b/i,
    domains: ['procurement'],
    endpoints: ['/vroozi/catalogs'],
    hint: `VROOZI CATALOGS — 2,605 catalogs (105 pages of 25):
1. All catalogs: GET /vroozi/catalogs — returns id, name, catalogType (PUNCH_OUT/HOSTED), supplierRefs[], submitterRef, catalogStatus, active, validFrom, validTo
2. Catalog types: PUNCH_OUT (external supplier sites), HOSTED (internal item lists)
3. Status: APPROVED, PENDING
4. Key suppliers in catalogs: Genuine Parts Company, Amazon Capital Services, and more
5. Catalogs link to specific suppliers via supplierRefs[].vendorId`,
  },
  // ── Vroozi GL Accounts ───────────────────────────────────────────────
  {
    pattern: /\b(vroozi\s*gl|gl\s*account\s*(?:list|code)|general\s*ledger\s*(?:code|account)|chart\s*of\s*accounts\s*vroozi)\b/i,
    domains: ['procurement'],
    endpoints: ['/vroozi/gl-accounts'],
    hint: `VROOZI GL ACCOUNTS — 889 accounts (36 pages):
1. All GL accounts: GET /vroozi/gl-accounts — returns id, externalId (GL code), code, description, companyCodeRef, active
2. Department categories: Sales & BD (60006/60026/60066/60096/60106), Maintenance & Shop, Ops Supervision & Mgmt, Dispatch & Logistics, Freight & Transportation, Field Ops & Tech
3. Pay type suffixes: base (no suffix), -OT, -PTO, -VEH, -Tax
4. All under company code 01 (Delta Fuel Company LLC)
5. Paginated — 25 per page, use page param for additional pages`,
  },
  // ══════════════════════════════════════════════════════════════════════
  // CROSS-DOMAIN PATTERNS — Connect multiple data sources together
  // ══════════════════════════════════════════════════════════════════════

  // ── Cross-Domain 1: Customer 360 (Ascend + Salesforce) ─────────────
  {
    pattern: /\b(customer\s*360|customer\s*(?:across|both|match|compare|unified|full\s*view|complete\s*view)|ascend\s*(?:and|&|\+)\s*salesforce|salesforce\s*(?:and|&|\+)\s*ascend|crm\s*(?:and|&|\+)\s*erp|erp\s*(?:and|&|\+)\s*crm|cross\s*(?:system|reference)\s*customer)\b/i,
    domains: ['cross-domain', 'customers', 'sales'],
    endpoints: ['/ascend/query', '/ascend/customers', '/salesforce/query'],
    hint: `CUSTOMER 360 — Cross-reference Ascend ERP + Salesforce CRM:
1. Ascend customers (billing/revenue): POST /ascend/query:
   SELECT TOP 20 b.CustomerName, b.CustType, SUM(i.Qty * i.UnitPrice) AS Revenue, COUNT(DISTINCT b.SysTrxNo) AS Invoices
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 GROUP BY b.CustomerName, b.CustType ORDER BY Revenue DESC
2. Salesforce account match: POST /salesforce/query:
   {"soql":"SELECT Name, Industry, Type, BillingState, BillingCity, OwnerId FROM Account WHERE Name LIKE '%customer_name%'"}
3. VERIFIED CROSS-SYSTEM MATCHES (customers in BOTH Ascend + Salesforce):
   - ConocoPhillips Company — Ascend: top revenue customer | SF: Industry='Atlas Acquisition', Type='Customer', BillingCity='MIDLAND'/'HOUSTON'
   - Aethon — Ascend: major O&G customer | SF: 100+ well-site sub-accounts (Aethon - Akita, Aethon - Blue Jay, etc.)
   - Baytex Energy USA Inc — Ascend: Atlas Acquisition | SF: Industry='Atlas Acquisition', Type='Customer', BillingState='Texas'
   - CB&I LLC — Ascend: top GP customer ($10.3M GP) | SF: search via SOQL LIKE '%CB%I%'
4. Salesforce adds: Industry classification, BillingState/City, Owner (salesperson in CRM), Type (Customer/Prospect)
5. Match key: Ascend Address.Name ≈ Salesforce Account.Name (fuzzy match — Ascend uses "ConocoPhillips Company", SF has both "ConocoPhillips Company" and "CONOCOPHILLIPS COMPANY")
6. Aethon pattern: Ascend has parent "Aethon", Salesforce has 100+ well-site accounts like "Aethon - Akita 90 Rockies 2H"`,
  },
  // ── Cross-Domain 2: Vendor + Rack Price Connection ─────────────────
  {
    pattern: /\b(vendor\s*(?:rack|price|supplier)|rack\s*(?:vendor|supplier)|who\s*(?:supplies|provides)\s*(?:rack|fuel)|vendor\s*(?:and|&|\+)\s*rack|rack\s*(?:and|&|\+)\s*vendor|supplier\s*overlap|vendor\s*dual\s*role|pay\s*(?:and|&)\s*(?:buy|purchase))\b/i,
    domains: ['cross-domain', 'vendors', 'rack-pricing'],
    endpoints: ['/ascend/query'],
    hint: `VENDOR + RACK PRICE CONNECTION — Vendors who are ALSO rack price suppliers:
1. Top AP vendors (who we pay): POST /ascend/query:
   SELECT TOP 15 vendor_name, vendor_display_id, SUM(debit) AS TotalSpend
   FROM vPurchaseJournal WHERE Year_For_Period = 2025
   GROUP BY vendor_name, vendor_display_id ORDER BY TotalSpend DESC
2. Rack price vendors (who set fuel pricing): POST /ascend/query:
   SELECT DISTINCT Vendor_Name FROM vRackPrice ORDER BY Vendor_Name
3. VERIFIED OVERLAP — Vendors appearing in BOTH AP spend AND rack pricing:
   - Sunoco LP — AP: $14.9M spend (10th largest) | Rack: active rack price supplier
   - Calumet Lubricants Co — AP: $38.8M spend (2nd) | Rack: "Calumet Lubricants Co" in vRackPrice (as "Calumet" variant)
   - Dale Petroleum Company — AP: $32.9M spend (3rd) | Rack: "Dale Petroleum Company" in vRackPrice
   - Valero Marketing & Supply Co — AP: $23.7M spend (4th) | Rack: "Valero Marketing & Supply Co" in vRackPrice
   - Citgo Petroleum Corp — AP: $18.3M spend (6th) | Rack: "Citgo Petroleum Corp" in vRackPrice
   - Flint Hills Res — AP: $18.3M spend (7th) | Rack: "Flint Hills Res" in vRackPrice
   - Enterprise Prod Operating LLC — AP: $15.0M spend (9th) | Rack: "Enterprise Prod Operating LLC" in vRackPrice
   - Vtex LLC — AP: $51.6M spend (1st) | Rack: "Vtex LLC" in vRackPrice
4. Non-overlap vendors: Paylocity ($20.4M, 5th) is payroll only — NOT a fuel supplier
5. Match key: vPurchaseJournal.vendor_name ≈ vRackPrice.Vendor_Name (exact or near-exact match)
6. Business insight: Most top AP vendors are also rack price sources, meaning we buy fuel AND track their rack prices for margin analysis`,
  },
  // ── Cross-Domain 3: Fleet Carrier + Samsara Vehicle ────────────────
  {
    pattern: /\b(carrier\s*(?:vehicle|truck|fleet|samsara)|samsara\s*(?:carrier|billing)|fleet\s*(?:carrier|billing)|carrier\s*(?:to|vs|match)\s*(?:vehicle|truck)|which\s*(?:truck|vehicle)\s*(?:deliver|carrier)|delivery\s*(?:fleet|vehicle|truck)\s*match)\b/i,
    domains: ['cross-domain', 'fleet', 'carrier-transport'],
    endpoints: ['/ascend/query', '/samsara/vehicles', '/samsara/tags'],
    hint: `FLEET CARRIER + SAMSARA VEHICLE CONNECTION — Map billing carriers to physical trucks:
1. Ascend carriers (billing): POST /ascend/query:
   SELECT DISTINCT Carrier FROM DF_PBI_BillingChartQuery WHERE Year = 2025 AND Carrier IS NOT NULL ORDER BY Carrier
2. Samsara vehicles: GET /samsara/vehicles — 160 vehicles with name, make, model, tags[]
3. CARRIER-TO-VEHICLE MAPPING:
   Ascend carriers use profit center codes (DF XXXX), Samsara vehicles use type prefixes (TR-xxx, BF-xxx):
   - "DF 1036 Transport" / "DF 1036 Midland Transport" → TR-xxx trucks tagged "Midland" in Samsara
   - "DF 1011 Transport" / "DF 1011 Shreveport Transport" → TR-xxx trucks tagged "Shreveport"
   - "DF 1039 Transport" / "DF 1039 Corpus Christi Transport" → TR-xxx trucks tagged "Corpus Christi"
   - "DF 1019 Short Truck" / "DF 1019 Shreveport Short Truck" → BF-xxx bulk fuel trucks tagged "Shreveport"
   - "DF 1020 Short Truck" / "DF 1020 Midland Short Truck" → BF-xxx bulk fuel trucks tagged "Midland"
   - "DF 1047 Transport" / "DF 1047 Colorado Transport" → TR-xxx trucks tagged "Colorado"
4. External carriers (Dale Petroleum, Musket, etc.) do NOT have Samsara vehicles — they are 3rd-party
5. Vehicle prefixes: TR=tractor/transport, BF=bulk fuel/short truck, PU=pickup, FL=flatbed, SV=service
6. Link method: Carrier PC code (e.g., 1036) → Samsara tag region (e.g., "Midland") → vehicles[] in that tag
7. 116 distinct carriers in Ascend, 160 vehicles in Samsara. Internal DF carriers map by region tag.`,
  },
  // ── Cross-Domain 4: Site + Geofence Connection ─────────────────────
  {
    pattern: /\b(site\s*(?:geofence|samsara|gps|map)|geofence\s*(?:site|ascend|erp)|match\s*(?:site|location)\s*(?:geofence|samsara)|yard\s*(?:site|location)\s*match|geographic\s*(?:match|overlap|cross)|site\s*(?:to|vs)\s*(?:geofence|address))\b/i,
    domains: ['cross-domain', 'sites', 'fleet'],
    endpoints: ['/ascend/sites', '/samsara/addresses'],
    hint: `SITE + GEOFENCE CONNECTION — Map Ascend ERP sites to Samsara geofences:
1. Ascend sites: GET /ascend/sites — 78 sites with Code, LongDescr, Latitude, Longitude, ProfitCenter
2. Samsara geofences: GET /samsara/addresses — 326 geofences with name, formattedAddress, latitude, longitude
3. VERIFIED GEOGRAPHIC MATCHES (same physical location in both systems):
   - MIDLAND: Ascend Code=1020 (lat 31.82, lng -102.32) ↔ Samsara "MIDLAND, TX" (6600 W Hwy 80, lat 31.95, lng -102.16) + "Delta Fuel I-20 Yard" (lat 31.93, lng -102.17)
   - SHREVEPORT: Ascend Code=1019 (lat 32.53, lng -93.76) ↔ Samsara "SHREVEPORT YARD" (1000 Wells Island Rd, lat 32.54, lng -93.75) + "N Market" (1604 N Market St, lat 32.54, lng -93.77)
   - LAKE CHARLES: Ascend Code=1022 (lat 30.23, lng -93.17) ↔ Samsara "LAKE CHARLES, LA" (5625 Broad St, lat 30.23, lng -93.14)
   - CORPUS CHRISTI: Ascend Code=1039 ↔ Samsara geofences tagged "Corpus Christi"
4. Samsara has 326 geofences — includes customer well sites (CQ FRAC, DEVON ENERGY, OXY HP, etc.) that do NOT have Ascend site equivalents
5. Ascend has 78 sites — includes administrative/virtual sites (Government Contract, Contractors) without GPS
6. Match method: Compare lat/lng within ~0.2 degree radius, or match city names
7. Use case: Track which fleet vehicles are at which ERP profit center locations in real-time`,
  },
  // ── Cross-Domain 5: Product Revenue + Rack Price Margin ────────────
  {
    pattern: /\b(actual\s*margin|real\s*margin|invoice\s*(?:vs|minus|less)\s*rack|rack\s*(?:vs|minus)\s*invoice|spread|margin\s*(?:per|by)\s*gallon|fuel\s*margin|price\s*(?:vs|minus)\s*(?:rack|cost)|rack\s*spread|invoice\s*rack\s*(?:comparison|diff)|margin\s*analysis|gallon\s*margin)\b/i,
    domains: ['cross-domain', 'pricing', 'rack-pricing'],
    endpoints: ['/ascend/query'],
    hint: `PRODUCT REVENUE + RACK PRICE MARGIN — Calculate actual $/gallon margin:
1. Recent invoice prices (what we charge): POST /ascend/query:
   SELECT TOP 20 b.CustomerName, b.ShipToDescr, b.InvoiceDt, i.UnitPrice, i.Qty, i.MasterProdID
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE i.MasterProdID IN (4399, 1096) AND b.InvoiceDt >= '2026-03-01'
   ORDER BY b.InvoiceDt DESC
2. Current rack prices (our cost basis): POST /ascend/query:
   SELECT TOP 10 Vendor_Name, SupplyPoint, ProductDescr, EffDtTm, RackPrice
   FROM vRackPrice WHERE ProductDescr LIKE '%Diesel%Dyed%' ORDER BY EffDtTm DESC
3. VERIFIED MARGIN EXAMPLE (2026-03-26 to 2026-03-28):
   - Invoice price: $4.3725/gal (Dyed Short Truck, MasterProdID 4399)
   - Rack price: $4.2082 - $4.4899/gal (varies by supply point, OPIS/DTN)
   - Midland rack avg: ~$4.33/gal → margin ≈ $0.04/gal on that day
   - Spread varies by supply point and customer contract
4. MARGIN FORMULA: Invoice UnitPrice - Rack Price at nearest supply point = $/gallon margin
5. For bulk margin analysis: POST /ascend/query:
   SELECT b.CustomerName, AVG(i.UnitPrice) AS AvgInvoicePrice, COUNT(*) AS Deliveries
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE i.MasterProdID = 4399 AND b.InvoiceDt >= '2026-03-01'
   GROUP BY b.CustomerName ORDER BY AvgInvoicePrice DESC
6. Supply points: DTNRKAvgSan (San Antonio avg), OPIS UBDRAvg Midland, NM4256 (New Mexico)
7. Key: Match invoice ShipToDescr region to nearest vRackPrice.SupplyPoint for accurate margin calc`,
  },
  // ── Cross-Domain 6: Salesperson + Salesforce User Match ────────────
  {
    pattern: /\b(salesperson\s*(?:crm|salesforce|sf|user)|salesforce\s*(?:salesperson|rep|ascend)|rep\s*(?:crm|activity|match)|crm\s*(?:rep|salesperson|billing)|sales\s*(?:rep|person)\s*(?:across|both|match)|who\s*(?:owns|manages)\s*(?:account|customer))\b/i,
    domains: ['cross-domain', 'sales-performance', 'sales'],
    endpoints: ['/ascend/query', '/salesforce/users', '/salesforce/query'],
    hint: `SALESPERSON + SALESFORCE USER MATCH — Connect billing reps to CRM users:
1. Ascend salespersons (billing performance): POST /ascend/query:
   SELECT DISTINCT b.Salesperson FROM DF_PBI_BillingChartQuery b
   WHERE b.Year = 2025 AND b.Salesperson IS NOT NULL ORDER BY b.Salesperson
2. Salesforce users: GET /salesforce/users — 128 users with Name, Email, IsActive, Profile.Name
3. VERIFIED NAME MATCHES (person in BOTH Ascend billing + Salesforce CRM):
   - Adam Vegas — Ascend: Salesperson | SF: avegas@delta360.energy, Active
   - Anna Snodgrass — Ascend: Salesperson | SF: asnodgrass@delta360.energy, Active
   - Ashlee Hey — Ascend: Salesperson | SF: ahey@delta360.energy, Active
   - Ashley Hadwin — Ascend: Salesperson | SF: ahadwin@delta360.energy, Active
   - Layla McCall — Ascend: Salesperson | SF: (search by name)
   - Sam Ferguson — Ascend: Salesperson | SF: (search by name)
   - Petrus Booysen — Ascend: 'Petrus ". Booysen' | SF: (search by name)
   - Barry Iseminger — Ascend: Salesperson | SF: biseminger@delta360.energy, Active
   - Abby Marks — Ascend: Salesperson | SF: amarks@delta360.energy, Active
   - Adriana Hernandez — Ascend: Salesperson | SF: ahernandez@delta360.energy, Active
   - Alexis Deaton — Ascend: Salesperson | SF: adeaton@delta360.energy, Active
   - Brandon Thornton — Ascend: Salesperson | SF: bthornton@delta360.energy, Active
4. 36 salespersons in Ascend, 128 users in Salesforce (includes admins, API users, inactive)
5. Match key: Ascend Salesperson name ≈ Salesforce User.Name (fuzzy — Ascend has 'Petrus ". Booysen', SF has 'Petrus Booysen')
6. Cross-reference: For rep performance + CRM activity:
   a) Get revenue by salesperson from Ascend (billing)
   b) Get tasks/events by OwnerId from Salesforce (CRM activity)
   c) Match by name to see billing performance alongside CRM engagement`,
  },
  // ── Samsara Fleet — Safety Events / Coaching ─────────────────
  {
    pattern: /\b(safety.*event|harsh.*brak|speeding|distract|collision|accident|driver.*score|coaching)\b/i,
    domains: ['fleet'],
    endpoints: ['/samsara/alerts', '/api/fleet/events'],
    hint: `SAFETY EVENTS / COACHING — Samsara driver behavior and incident data:
1. All safety events: GET /samsara/alerts — returns id, driver{id, name}, vehicle{id, name}, time, maxAccelerationGForce, location{formattedLocation}, behaviorLabels[], coachingState, forwardVideoUrl, inwardVideoUrl
2. Behavior labels: harshBraking, harshAcceleration, harshTurn, speeding, distractedDriving, drowsyDriving, closeFollowing, seatbeltViolation, rollingStop, laneDeviation, collision, nearCollision
3. Severity classification: gForce > 0.5 = critical, > 0.3 = warning, else info
4. Coaching states: needsReview, reviewed, coached, dismissed
5. Video: forwardVideoUrl and inwardVideoUrl available for events with dashcam footage
6. Processed endpoint: GET /api/fleet/events?days=7&severity=critical&driver=name&vehicle=name — returns parsed events with computed severity and aggregated stats
7. Stats include: totalEvents, byDriver, byVehicle, byBehavior, criticalCount, averageGForce`,
  },
  {
    pattern: /\b(order.to.cash|otc|unbilled|open.order|pending.invoice|bol.unresolved|missing.load|rig.stamp|flash.report|dispatch.billing)\b/i,
    domains: ['financial', 'operations'],
    endpoints: ['/api/otc'],
    hint: `ORDER-TO-CASH PROGRESS — Weekly flash report tracking the billing pipeline:
1. GET /api/otc?view=latest — current week snapshot with KPIs (pending invoice, BOL unresolved, missing loads, rig stamps, open internal orders)
2. GET /api/otc?view=trends — week-over-week trend data for all metrics
3. GET /api/otc?view=report — full markdown report ready for PDF export
4. POST /api/otc with {"action":"generate"} — pull fresh data from Ascend (SalesOrder, vBOLHdrInfo, InternalOrder tables)
5. POST /api/otc with {"action":"seed"} — load baseline from 3/31/2026 flash report
6. Metrics tracked: order counts by month, unbilled orders by department (Dispatch/Billing x Contractor/Direct x Commercial/Oil&Gas), pending PO/stamp/pricing, BOL unresolved, open internal orders, pending rig stamps, missing loads
7. Week-over-week change calculated automatically from snapshot history
8. Export: use /api/reports/export with format "pdf" to generate the branded PDF`,
  },
];

export function planQuery(query: string): QueryPlan {
  const lower = query.toLowerCase();
  const matchedDomains = new Set<string>();
  const matchedEndpoints = new Set<string>();
  const hints: string[] = [];

  for (const intent of INTENT_PATTERNS) {
    if (intent.pattern.test(lower)) {
      intent.domains.forEach(d => matchedDomains.add(d));
      intent.endpoints.forEach(e => matchedEndpoints.add(e));
      hints.push(intent.hint);
    }
  }

  return {
    domains: Array.from(matchedDomains),
    suggestedEndpoints: Array.from(matchedEndpoints),
    hint: hints.length > 0
      ? `Suggested data plan:\n${hints.join('\n')}`
      : 'No specific endpoints pre-matched. Use the schema index to identify the right endpoints.',
  };
}

// ─── Layer 3: Result Compressor ────────────────────────────────────────
// Compresses large gateway responses into structured digests.
// The model works with the digest, not the raw payload.

interface CompressedResult {
  summary: string;
  rowCount: number;
  columns: string[];
  sample: unknown[];
  aggregates?: Record<string, number | string>;
}

export function compressGatewayResult(raw: unknown, maxRows: number = 25): string {
  if (!raw || typeof raw !== 'object') return JSON.stringify(raw);

  const obj = raw as Record<string, unknown>;

  // If it has a data array, compress it
  if (obj.data && Array.isArray(obj.data)) {
    const arr = obj.data as Record<string, unknown>[];
    const totalRows = arr.length;

    if (totalRows === 0) {
      return JSON.stringify({ ...obj, data: [], _note: 'No data returned' });
    }

    // Extract column names from first row
    const columns = Object.keys(arr[0]);

    // Detect numeric columns and compute aggregates
    const aggregates: Record<string, { sum: number; min: number; max: number }> = {};
    for (const col of columns) {
      const firstVal = arr[0][col];
      if (typeof firstVal === 'number' || (typeof firstVal === 'string' && !isNaN(Number(firstVal)) && firstVal.trim() !== '')) {
        aggregates[col] = { sum: 0, min: Infinity, max: -Infinity };
      }
    }

    // Single pass: compute aggregates + select sample rows
    for (const row of arr) {
      for (const [col, agg] of Object.entries(aggregates)) {
        const val = Number(row[col]) || 0;
        agg.sum += val;
        if (val < agg.min) agg.min = val;
        if (val > agg.max) agg.max = val;
      }
    }

    // Take top N rows (data is usually pre-sorted by the gateway)
    const sample = arr.slice(0, maxRows);

    // Build compact aggregate summary
    const aggSummary: Record<string, string> = {};
    for (const [col, agg] of Object.entries(aggregates)) {
      aggSummary[col] = `sum=${formatNum(agg.sum)} min=${formatNum(agg.min)} max=${formatNum(agg.max)}`;
    }

    const compressed: CompressedResult = {
      summary: `${totalRows} rows, ${columns.length} columns. Showing top ${sample.length}.`,
      rowCount: totalRows,
      columns,
      sample,
    };
    if (Object.keys(aggSummary).length > 0) {
      compressed.aggregates = aggSummary;
    }

    return JSON.stringify({
      success: obj.success,
      source: obj.source,
      ...compressed,
    });
  }

  // Not an array response — return as-is but cap size
  const str = JSON.stringify(raw);
  if (str.length > 30000) {
    return str.substring(0, 30000) + '...[TRUNCATED]';
  }
  return str;
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

// ─── Layer 4: Conversation Compactor ───────────────────────────────────
// After N message pairs, compress older turns into a summary.
// Keeps the last M turns verbatim + a summary of everything before.

interface CompactMessage {
  role: string;
  content: string;
}

export function compactConversation(
  messages: CompactMessage[],
  keepRecentTurns: number = 6
): CompactMessage[] {
  // Each "turn" is a user+assistant pair = 2 messages
  const keepMessages = keepRecentTurns * 2;

  if (messages.length <= keepMessages + 2) {
    return messages; // Not long enough to compact
  }

  // Split: older messages to summarize, recent to keep verbatim
  const older = messages.slice(0, messages.length - keepMessages);
  const recent = messages.slice(messages.length - keepMessages);

  // Build a compact summary of older turns
  const summaryParts: string[] = ['[Conversation summary — earlier messages compressed]'];
  let turnNum = 0;
  for (let i = 0; i < older.length; i += 2) {
    turnNum++;
    const userMsg = older[i];
    const assistantMsg = older[i + 1];
    if (!userMsg) break;

    // Extract first 100 chars of each message
    const userSnippet = userMsg.content.substring(0, 100).replace(/\n/g, ' ');
    const assistantSnippet = assistantMsg
      ? assistantMsg.content.substring(0, 150).replace(/\n/g, ' ')
      : '(no response)';

    summaryParts.push(`Turn ${turnNum}: User asked "${userSnippet}..." → Assistant provided: ${assistantSnippet}...`);
  }

  const summaryMessage: CompactMessage = {
    role: 'user',
    content: summaryParts.join('\n'),
  };

  const ackMessage: CompactMessage = {
    role: 'assistant',
    content: 'Understood. I have the context from our earlier conversation. Continuing from where we left off.',
  };

  return [summaryMessage, ackMessage, ...recent];
}

// ─── Build Optimized System Prompt ─────────────────────────────────────
// Uses schema index + query plan instead of full endpoint list

/**
 * Build the STATIC portion of the system prompt.
 * This does NOT change per request and can be cached by Anthropic's prompt caching.
 * Order: Identity -> Response Format (FIRST) -> Cross-Referencing -> Schema Index -> Instructions
 */
export function buildStaticSystemPrompt(): string {
  const parts = [
    '# SYSTEM IDENTITY AND CAPABILITIES',
    'You are Delta Intelligence, the AI operating system for Delta360. You are NOT a generic chatbot. You are a fully integrated enterprise assistant with LIVE connections to 8 data services and direct control over Microsoft 365, Salesforce, and fleet systems.',
    '',
    '# YOUR LIVE TOOL CONNECTIONS (USE THESE — THEY ARE REAL AND WORKING)',
    'You have 8 tools that execute real actions. These are NOT simulated. They connect to live production systems RIGHT NOW:',
    '1. query_gateway — Query live data from Ascend ERP, Salesforce CRM, Samsara Fleet, Power BI, Microsoft 365, Vroozi, DTN Rack Pricing',
    '2. generate_workbook — Create real Excel workbooks with live data',
    '3. salesforce_create — Create real records in Salesforce (Tasks, Opportunities, Contacts, etc.)',
    '4. salesforce_update — Update real Salesforce records',
    '5. create_calendar_event — Create real Microsoft Teams calendar events with meeting links',
    '6. read_email — Read real emails from ANY @delta360.energy mailbox via Microsoft Graph API',
    '7. send_email — Send real emails from ANY @delta360.energy account',
    '8. manage_email — Flag, categorize, move, create rules in ANY @delta360.energy mailbox',
    '',
    '# CLARIFYING QUESTIONS (Smart Ask)',
    'When a query is ambiguous, ask ONE short clarifying question BEFORE pulling data — but ONLY when it would materially change the result:',
    '- "Which time period? (this month, this quarter, YTD, last 12 months)"',
    '- "All salespersons or a specific one?"',
    '- "All customer types or a specific segment?"',
    'Do NOT ask if: the user specifies enough context, the default (current year, all data) is reasonable, or the question has an obvious answer.',
    'After the user answers, remember the preference for that session — do not ask again.',
    '',
    'MANDATORY BEHAVIOR:',
    '- When asked to read emails: call read_email. Do NOT say you cannot access email.',
    '- When asked to flag/categorize emails: call manage_email. Do NOT suggest Power Automate or Outlook Rules.',
    '- When asked to send email: call send_email. Do NOT say you lack access.',
    '- When asked to schedule meetings: call create_calendar_event. Do NOT offer to draft details.',
    '- When asked to create SF records: call salesforce_create. Do NOT suggest the user do it manually.',
    '- NEVER say "I don\'t have access to", "I can\'t connect to", "I\'m an analytical AI", or "loop in IT".',
    '- NEVER suggest Power Automate, Outlook Rules Wizard, or manual workarounds for things your tools can do.',
    '- If you catch yourself about to say "I cannot" — STOP and use the appropriate tool instead.',
    '',
    `# Current Date & Time`,
    `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Current time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: 'America/Chicago' })} (Central Time).`,
    `Current fiscal year: ${new Date().getFullYear()}. Current period: ${new Date().getMonth() + 1}.`,
    `When the user says "this week", "last week", "this month", etc., calculate the exact date range from today's date. Do NOT guess or use hardcoded dates.`,
    `For Salesforce SOQL date literals: THIS_WEEK, LAST_WEEK, THIS_MONTH, LAST_MONTH, THIS_QUARTER, THIS_YEAR are valid.`,
    `For Ascend SQL: use GETDATE() for current date, DATEADD(day, -7, GETDATE()) for 7 days ago, etc.`,
    '',
    // Response Format comes FIRST — models pay most attention to the beginning
    RESPONSE_SCHEMA,
    '',
    '# Follow-up Questions',
    '- ALWAYS end every response with exactly 3 numbered follow-up questions after a --- separator.',
    '- Format: **Follow up:** then 1. 2. 3. on separate lines.',
    '- Each must be unique, specific, actionable, and contain a question mark.',
    '- Number them starting at 1 for every response.',
    '',
    '# Cross-Referencing (Verified Table Joins)',
    '- PRICING: DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo — gets CustomerName + ShipToDescr + InvoiceDt + UnitPrice + Qty',
    '- PRODUCT NAMES: MasterProdID maps via DF_PBI_DS_SalesAndProfitAnalysis (has MasterProdDescr). Key diesel IDs: 4399=Dyed Short Truck, 1096=Dyed Transport, 4503=Dyed Counter Sale, 1187=variant',
    '- CUSTOMERS: DF_PBI_BillingChartQuery has CustomerName, ShipToDescr, CustType, Latitude, Longitude',
    '- EQUIPMENT: /ascend/equipment + /ascend/tanks + /ascend/tanks/assignments endpoints',
    '- LOCATIONS: DF_PBI_BillingChartQuery has Latitude/Longitude + ShipToDescr with city names. Also /ascend/sites for site-level GPS.',
    '- DATA FRESHNESS: DF_PBI_BillingChartQuery goes to current date (2026). DF_PBI_DS_SalesAndProfitAnalysis only goes to Jan 2022 (use for product ID lookups only, not pricing).',
    '- DTN RACK PRICES: vRackPrice has live daily rack prices from DTN, Sunoco, etc. Always include current rack price when quoting fuel.',
    '- MICROSOFT DOCS: GET /microsoft/search?q=terms for SharePoint/OneDrive documents (SOPs, pricing matrices, fleet docs).',
    '- LOGISTICS: LogisticsOrderTracking + LogisticsPriceTracking tables in Ascend for delivery/freight data.',
    '- Always chain queries when a single endpoint is insufficient. Use POST /ascend/query with SQL for complex joins.',
    '',
    '# Data Source Index',
    SCHEMA_INDEX,
    '',
    buildGlossaryPromptSection(),
    '',
    buildSalesKnowledgePrompt(),
    '',
    '# CRITICAL RULES',
    '- ABSOLUTELY NO EMOJIS. Never use emojis, emoticons, or decorative unicode symbols (📊📈🔑⚠️✅❌💡🎯📋 etc.) in ANY part of your output. This is non-negotiable. No exceptions. Not in headings, not in lists, not anywhere.',
    '- ALWAYS use markdown pipe tables (| col1 | col2 |) for ALL data. NEVER use tab-separated or space-aligned text.',
    '- NEVER claim data is inaccessible or suggest asking someone else. You have direct SQL access to 5,105 Ascend ERP tables via POST /ascend/query.',
    '- NEVER say "I cannot provide", "I cannot access", or "I do not have the ability to" — you have 5 tools that connect to 8 live data sources plus calendar and Salesforce write access. Use the tools.',
    '- NEVER offer to "draft" something the user asks you to create. If they say "schedule a meeting" — use the create_calendar_event tool. If they say "create a task" — use salesforce_create. Act, do not offer alternatives.',
    '- BOL data: ALWAYS use vBOLHdrInfo view (has SupplierCode, SupplierDescr, SupplyPtDescr, CarrierDescr). NEVER query BOLHdr.FromSiteID directly.',
    '- AP vendor spend is in vPurchaseJournal (vendor_name, Account_Desc, debit, credit, Year_For_Period).',
    '- AR invoice data is in DF_PBI_BillingChartQuery JOIN ARInvoiceItem.',
    '- If a specific table is not found, use /ascend/tables to search, or /ascend/schema/{table} to inspect columns.',
    '',
    '# Your Tools',
    'You have 5 tools available. Use them directly — NEVER say you cannot do something that a tool handles:',
    '',
    '1. **query_gateway** — Fetch data from any of the 8 connected services (Ascend ERP, Salesforce, Samsara, Power BI, Microsoft 365, Vroozi, Fleet Panda, DTN). Call it multiple times to cross-reference.',
    '2. **generate_workbook** — Create multi-sheet Excel workbooks from gateway data. Use when the user asks for spreadsheets, exports, or "build me an Excel".',
    '3. **salesforce_create** — Create records in Salesforce (Tasks, Events, Contacts, Opportunities, Leads, Cases, Accounts). Use when the user asks to "create a task", "add a contact", "log a follow-up", etc. Always confirm details before creating.',
    '4. **salesforce_update** — Update existing Salesforce records. Use when the user asks to "update the opportunity", "change the stage", "mark the task complete", etc. Requires the record ID.',
    '5. **create_calendar_event** — Create Microsoft Teams calendar events with meeting links. Use when the user asks to "schedule a meeting", "set up a call", "book time with", etc. Supports natural language time ("tomorrow at 2 PM", "next Monday at 10 AM for 30 minutes"). Auto-resolves Delta360 employee names to emails.',
    '6. **read_email** — Read emails from any Delta360 user\'s Microsoft 365 mailbox. Use when the user asks to "check emails", "show inbox", "search mail", "find emails about X". Provide the user\'s @delta360.energy email address. Supports search queries and unread filtering.',
    '7. **send_email** — Send emails from any Delta360 @delta360.energy account via Microsoft Graph. Use when the user asks to "send an email", "email someone", "notify by email". Always confirm content with the user before sending. Can send as any @delta360.energy user.',
    '8. **manage_email** — Full email management for any Delta360 mailbox. Actions: flag/unflag messages, markRead/markUnread, move to folder, createFolder, categorize (Red/Orange/Yellow/Green/Blue/Purple), createRule (inbox rules for auto-sorting), listFolders. Use when the user asks to "flag emails", "prioritize inbox", "create email rules", "move emails to folder", "organize mailbox", "set up auto-sort". Requires message IDs from read_email first.',
    '',
    'CRITICAL: You have FULL access to Microsoft 365 email, calendar, Salesforce, and all 8 data services. When the user asks to:',
    '  - Schedule a meeting → use create_calendar_event IMMEDIATELY',
    '  - Read/check emails → use read_email IMMEDIATELY',
    '  - Send an email → use send_email IMMEDIATELY',
    '  - Flag/move/organize emails → use manage_email IMMEDIATELY',
    '  - Create a task/record → use salesforce_create IMMEDIATELY',
    '  - Update a record → use salesforce_update IMMEDIATELY',
    'NEVER say "I don\'t have access to email", "I can\'t connect to your mailbox", "I don\'t have a live connection", or "Loop in your IT admin". You ARE connected. The tools above ARE live. USE THEM.',
    'NEVER offer to "draft an IT request" or suggest the user needs to "configure an integration". Everything is already configured and working.',
    '',
    '# Instructions',
    '- Endpoints follow the pattern: GET /service/resource or POST /service/query for raw queries.',
    '- All GET endpoints accept query params (e.g. ?year=2026&period=3).',
    '- POST /ascend/query accepts {"sql":"SELECT ..."} for raw SQL against ANY of the 5,105 Ascend ERP tables.',
    '- Format results using markdown tables. Be concise and factual.',
    '- If data is truncated, note the total count and suggest a more specific query.',
    '- Do not fabricate data. If an endpoint returns an error, try a different query approach.',
  ];

  return parts.join('\n');
}

/**
 * Build the DYNAMIC portion of the system prompt.
 * This changes per request (role, query plan) and cannot be cached.
 */
export function buildDynamicContext(
  roleName: string,
  services: string[],
  query?: string,
  role?: string
): string {
  const plan = query ? planQuery(query) : null;

  // Import role context dynamically to avoid circular deps
  let roleContext = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildRoleContext } = require('@/lib/role-prompts');
    if (role && typeof buildRoleContext === 'function') {
      roleContext = buildRoleContext(role);
    }
  } catch {
    // role-prompts not available — skip
  }

  const parts = [
    `User role: ${roleName}`,
    `Accessible services: ${services.join(', ')}`,
    '',
    ...(roleContext ? [roleContext, ''] : []),
  ];

  // If we have a query plan, inject it as a guide
  if (plan && plan.suggestedEndpoints.length > 0) {
    parts.push(
      '# Query Plan (pre-computed)',
      plan.hint,
      '',
      'Suggested endpoints: ' + plan.suggestedEndpoints.join(', '),
      'You may call other endpoints if needed — the schema index above covers all available data.',
    );
  }

  return parts.join('\n');
}

/**
 * Build the full system prompt (combined static + dynamic).
 * Kept for backward compatibility with code that passes a single string.
 */
export function buildOptimizedSystemPrompt(
  roleName: string,
  services: string[],
  query?: string,
  role?: string
): string {
  const staticPart = buildStaticSystemPrompt();
  const dynamicPart = buildDynamicContext(roleName, services, query, role);
  return staticPart + '\n\n' + dynamicPart;
}
