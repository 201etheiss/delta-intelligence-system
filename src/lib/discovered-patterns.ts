/**
 * Discovered SQL Query Patterns for Ascend ERP Gateway
 *
 * All patterns verified against POST http://127.0.0.1:3847/ascend/query
 * with x-api-key: <GATEWAY_ADMIN_KEY>
 *
 * Discovery date: 2026-03-27
 * Data freshness: DF_PBI_BillingChartQuery has data through 2026 Period 3
 */

export const DISCOVERED_PATTERNS = [
  // ── 1. Salesperson Performance ───────────────────────────────────
  {
    pattern: /\b(salesperson|sales\s*rep|sales\s*team|rep\s*performance|who\s*sold|sales\s*rank|sales\s*leader)\b/i,
    domains: ['sales-performance'],
    endpoints: ['/ascend/query'],
    hint: `SALESPERSON PERFORMANCE — Revenue + GP by rep:
1. Revenue + COGS by salesperson: POST /ascend/query:
   SELECT TOP 10 b.Salesperson, SUM(i.Qty * i.UnitPrice) AS Revenue, SUM(i.Qty * ISNULL(i.Total_UnitCost,0)) AS COGS
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 AND i.Total_UnitCost > 0 GROUP BY b.Salesperson ORDER BY Revenue DESC
2. Gross profit by salesperson: replace ORDER BY Revenue DESC with ORDER BY (Revenue - COGS) DESC
3. Salesperson + customer detail: add b.CustomerName to SELECT and GROUP BY for per-account breakdown
4. Monthly performance: add b.Period to SELECT/GROUP BY, filter b.Period = N for specific month
5. Known top reps (by revenue): #1 ($449M rev), #2 ($211M), #3 ($115M), #4 ($70M), #5 ($32M), #6 ($25M), #7 ($18M) — use live query for current names`,
    verified: true,
    sampleRowCount: 10,
  },
  // ── 2. Customer Type Analysis ────────────────────────────────────
  {
    pattern: /\b(cust(?:omer)?\s*type|customer\s*segment|customer\s*category|oil\s*(?:&|and)\s*gas|construction|commercial|atlas|fleet\s*trucking)\b/i,
    domains: ['customer-segments'],
    endpoints: ['/ascend/query'],
    hint: `CUSTOMER TYPE ANALYSIS — Revenue breakdown by CustType:
1. Revenue by customer type: POST /ascend/query:
   SELECT b.CustType, COUNT(DISTINCT b.CustomerName) AS Customers, SUM(i.Qty * i.UnitPrice) AS Revenue
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 GROUP BY b.CustType ORDER BY Revenue DESC
2. 24 customer types found. Top: Atlas Acquisition ($439M, 12 customers), Oil & Gas Operator ($348M, 35), Construction ($169M, 90), Commercial ($70M, 520), Company Use ($46M, 1)
3. For GP by type: add SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost,0))) AS GrossProfit and filter i.Total_UnitCost > 0`,
    verified: true,
    sampleRowCount: 24,
  },
  // ── 3. Product Mix ───────────────────────────────────────────────
  {
    pattern: /\b(product\s*mix|top\s*product|product\s*breakdown|what\s*(?:do\s*we|products?\s*(?:do|are))\s*sell|best\s*sell|volume\s*by\s*product)\b/i,
    domains: ['product-mix'],
    endpoints: ['/ascend/query'],
    hint: `PRODUCT MIX — Top products by revenue:
1. Product revenue ranking: POST /ascend/query:
   SELECT TOP 15 i.MasterProdID, COUNT(*) AS LineItems, SUM(i.Qty) AS TotalQty, SUM(i.Qty * i.UnitPrice) AS Revenue
   FROM ARInvoiceItem i JOIN DF_PBI_BillingChartQuery b ON i.SysTrxNo = b.SysTrxNo
   WHERE b.Year = 2025 GROUP BY i.MasterProdID ORDER BY Revenue DESC
2. Product name lookup (IDs to names via historical view): POST /ascend/query:
   SELECT DISTINCT MasterProdID, MasterProdCode, MasterProdDescr FROM DF_PBI_DS_SalesAndProfitAnalysis WHERE MasterProdID IN (10283,1096,4399,4505,1131,4384,1188)
3. Known top products: 10283=$588M revenue, 1096=DDT Diesel Dyed Transport ($237M), 4399=DDB Diesel Dyed Short Truck ($55M), 4505=$45M, 1131=DCT Diesel Clear Transport ($34M), 1188=DCB Diesel Clear Short Truck ($24M)
4. IMPORTANT: Product.ProdID does NOT match ARInvoiceItem.MasterProdID — use DF_PBI_DS_SalesAndProfitAnalysis for name lookups`,
    verified: true,
    sampleRowCount: 15,
  },
  // ── 4. Carrier / Transport ───────────────────────────────────────
  {
    pattern: /\b(carrier\s*(?:performance|volume|rank)|transport\s*(?:volume|fleet)|short\s*truck|delivery\s*(?:count|volume)|who\s*deliver)\b/i,
    domains: ['carrier-transport'],
    endpoints: ['/ascend/query'],
    hint: `CARRIER / TRANSPORT ANALYSIS — Delivery volume by carrier:
1. Carrier volume ranking: POST /ascend/query:
   SELECT TOP 10 b.Carrier, COUNT(*) AS Deliveries, SUM(i.Qty) AS TotalQty
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 GROUP BY b.Carrier ORDER BY Deliveries DESC
2. Top carriers: DF 1039 Corpus Christi Transport (108M gal), DF 1036 Midland Transport (98M gal), DF 1011 Shreveport Transport (85M gal), DF 1019 Shreveport Short Truck (18M gal), Dale Petroleum (22M gal)
3. NULL carrier = ~1.2M records (billing items, counter sales, etc.)
4. Carrier + product: add i.MasterProdID to see what each carrier hauls`,
    verified: true,
    sampleRowCount: 10,
  },
  // ── 5. Geographic / Ship-To Analysis ─────────────────────────────
  {
    pattern: /\b(geographic|by\s*(?:state|region|location|city|area)|ship\s*to|where\s*(?:do\s*we|are\s*our)\s*(?:deliver|customer|operate)|footprint|territory|market\s*(?:area|coverage))\b/i,
    domains: ['geographic'],
    endpoints: ['/ascend/query'],
    hint: `GEOGRAPHIC ANALYSIS — Revenue by location:
1. Revenue by ship-to (job site level): POST /ascend/query:
   SELECT TOP 10 b.ShipToDescr, SUM(i.Qty * i.UnitPrice) AS Revenue, COUNT(*) AS LineItems
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 GROUP BY b.ShipToDescr ORDER BY Revenue DESC
2. Top sites: ConocoPhillips Flaming Snail ($106M), CB&I Golden Pass LNG Sabine Pass TX ($60M), ConocoPhillips Griffin-Krueger ($53M), KZJV Braithwaite LA ($50M)
3. Customer count by state: POST /ascend/query:
   SELECT TOP 15 a.Phys_State, COUNT(DISTINCT a.Name) AS Customers FROM Address a
   WHERE a.Phys_State IS NOT NULL GROUP BY a.Phys_State ORDER BY Customers DESC
4. Key states: LA (113 customers), TX (112), MS (48), OK (13), FL (13), GA (10), OH (10)
5. GPS: DF_PBI_BillingChartQuery has Latitude, Longitude fields`,
    verified: true,
    sampleRowCount: 10,
  },
  // ── 6. Monthly Trends ────────────────────────────────────────────
  {
    pattern: /\b(monthly|trend|yoy|year\s*over\s*year|growth|seasonal|month\s*over\s*month|mom|period|quarterly|by\s*month)\b/i,
    domains: ['trends'],
    endpoints: ['/ascend/query'],
    hint: `MONTHLY TREND ANALYSIS — Revenue and customer counts over time:
1. Revenue by month: POST /ascend/query:
   SELECT b.Year, b.Period, SUM(i.Qty * i.UnitPrice) AS Revenue, COUNT(DISTINCT b.CustomerName) AS ActiveCustomers
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year >= 2024 GROUP BY b.Year, b.Period ORDER BY b.Year, b.Period
2. Returns 27 months: 2024-P1 through 2026-P3. Active customers per month: ~323-425 range
3. Revenue range: $30M-$304M per month (high variance due to large project invoicing)
4. For GP trend: add SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost,0))) AS GrossProfit and filter i.Total_UnitCost > 0
5. For salesperson trend: add b.Salesperson to SELECT/GROUP BY`,
    verified: true,
    sampleRowCount: 27,
  },
  // ── 7. Top Customers ─────────────────────────────────────────────
  {
    pattern: /\b(top\s*customer|biggest\s*client|revenue\s*by\s*customer|customer\s*rank|largest\s*account|key\s*account)\b/i,
    domains: ['customers'],
    endpoints: ['/ascend/query'],
    hint: `TOP CUSTOMERS — Revenue ranking:
1. Top customers by revenue: POST /ascend/query:
   SELECT TOP 10 b.CustomerName, SUM(i.Qty * i.UnitPrice) AS Revenue, SUM(i.Qty) AS TotalQty, COUNT(DISTINCT b.SysTrxNo) AS Invoices
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 GROUP BY b.CustomerName ORDER BY Revenue DESC
2. Top 10 (2025): ConocoPhillips ($354M), Aethon Energy ($111M), TGNR East Texas ($76M), CB&I ($62M), Baytex Energy ($60M), KZJV ($50M), Delta Fuel Company Use ($46M), Ageron Energy ($29M), Sponte Operating ($26M), Valero Energy ($22M)
3. For profitability: add SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost,0))) AS GrossProfit WHERE i.Total_UnitCost > 0`,
    verified: true,
    sampleRowCount: 10,
  },
  // ── 8. Customer Profitability ────────────────────────────────────
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
2. Top profitable (2025): CB&I LLC ($10.3M GP on $61M rev), KZJV LLC ($3.8M GP), Ageron Energy ($3.1M GP), MPG Pipeline ($2.7M GP), Aethon Energy ($2.2M GP), TGNR East Texas ($2.2M GP)
3. For margin %: wrap with (GrossProfit / Revenue * 100) AS MarginPct
4. Salesperson + customer GP: add b.Salesperson to GROUP BY`,
    verified: true,
    sampleRowCount: 10,
  },
  // ── 9. AR / Collections ──────────────────────────────────────────
  {
    pattern: /\b(open\s*invoice|outstanding\s*balance|still\s*due|unpaid|collection|receivable\s*status|ar\s*status|payment\s*status|disputed)\b/i,
    domains: ['ar-collections'],
    endpoints: ['/ascend/query', '/ascend/ar/aging'],
    hint: `AR / COLLECTIONS — Invoice status and outstanding balances:
1. AR status summary: POST /ascend/query:
   SELECT Status, COUNT(*) AS Cnt, SUM(ADOTotalStillDue) AS TotalDue
   FROM ARInvoice WHERE Year >= 2025 GROUP BY Status ORDER BY TotalDue DESC
2. Status codes: O=Open (4,975 invoices, $42.8M due), A=Active (7,326, $17.7M), C=Closed (45,995, $1.2M residual), P=Partial (152, $547K), D=Disputed (21, $2.2K)
3. Open invoices detail: POST /ascend/query:
   SELECT TOP 20 InvoiceNo, InvoiceDt, DueDt1, ADOTotalStillDue, ShipToID FROM ARInvoice
   WHERE Status = 'O' AND Year >= 2025 AND ADOTotalStillDue > 0 ORDER BY ADOTotalStillDue DESC
4. Key fields: ADOTotalStillDue, ADOAmtApplied, DueDt1, Disputed flag, PaymentMethod
5. NOTE: ARInvoice does NOT have a 'Status' column name directly — actual column returns O/A/C/P/D/E values`,
    verified: true,
    sampleRowCount: 6,
  },
  // ── 10. Rack Price Comparison ────────────────────────────────────
  {
    pattern: /\b(rack\s*comparison|vendor\s*(?:price|comparison|pricing)|cheapest\s*(?:fuel|diesel|rack)|best\s*(?:price|rack)|supplier\s*comparison|fuel\s*cost\s*comparison)\b/i,
    domains: ['rack-comparison'],
    endpoints: ['/ascend/query'],
    hint: `RACK PRICE COMPARISON — Compare vendor pricing:
1. Latest rack prices by vendor: POST /ascend/query:
   SELECT TOP 10 Vendor_Name, ProductDescr, RackPrice, DiscountPrice, EffDtTm
   FROM vRackPrice ORDER BY EffDtTm DESC
2. Sample prices (2026-03-27): DTN Diesel Dyed TexLed $4.23, Sunoco Diesel Clear TexLed $4.38, ExxonMobil Diesel Dyed $4.12, Fuel Masters Diesel Dyed $4.38
3. Key vendors: DTN LLC, Sunoco LP, ExxonMobil, Fuel Masters LLC, Dale Petroleum, Delek
4. Prices updated daily — always show EffDtTm for freshness
5. Filter by supply point: WHERE SupplyPoint LIKE 'TX%' for Texas terminals`,
    verified: true,
    sampleRowCount: 10,
  },
  // ── 11. Revenue by Site ──────────────────────────────────────────
  {
    pattern: /\b(site\s*(?:revenue|performance|rank)|by\s*site|master\s*site|site\s*id|location\s*revenue)\b/i,
    domains: ['site-analysis'],
    endpoints: ['/ascend/query'],
    hint: `REVENUE BY SITE — MasterSiteID-level analysis:
1. Revenue by site: POST /ascend/query:
   SELECT TOP 10 i.MasterSiteID, COUNT(DISTINCT b.CustomerName) AS Customers, SUM(i.Qty) AS TotalQty, SUM(i.Qty * i.UnitPrice) AS Revenue
   FROM ARInvoiceItem i JOIN DF_PBI_BillingChartQuery b ON i.SysTrxNo = b.SysTrxNo
   WHERE b.Year = 2025 GROUP BY i.MasterSiteID ORDER BY Revenue DESC
2. Top sites have single large customers (ConocoPhillips, etc.). Site 1010 serves 220 customers ($42M).
3. Cross-reference site IDs with GET /ascend/sites for site names and addresses`,
    verified: true,
    sampleRowCount: 10,
  },
  // ── 12. Salesperson + Customer GP ────────────────────────────────
  {
    pattern: /\b(salesperson\s*(?:margin|gp|profit)|rep\s*(?:margin|profitab|gp)|who\s*(?:makes|earns)\s*(?:the\s*)?most|sales\s*(?:margin|profitab))\b/i,
    domains: ['sales-profitability'],
    endpoints: ['/ascend/query'],
    hint: `SALESPERSON PROFITABILITY — GP by rep + customer:
1. GP by salesperson + customer: POST /ascend/query:
   SELECT TOP 10 b.Salesperson, b.CustomerName, SUM(i.Qty * i.UnitPrice) AS Revenue,
   SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost,0))) AS GrossProfit
   FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
   WHERE b.Year = 2025 AND i.Total_UnitCost > 0 GROUP BY b.Salesperson, b.CustomerName ORDER BY GrossProfit DESC
2. Top combos by GP: #1 rep/customer ($10.3M GP), #2 ($3.8M GP), #3 ($3.1M GP), #4 ($2.7M GP), #5 ($2.2M GP) — use live query for current rep+customer names
3. For monthly salesperson GP: add b.Period to GROUP BY`,
    verified: true,
    sampleRowCount: 10,
  },
] as const;

export type DiscoveredPattern = (typeof DISCOVERED_PATTERNS)[number];
