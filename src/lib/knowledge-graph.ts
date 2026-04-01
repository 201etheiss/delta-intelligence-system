/**
 * Delta Intelligence Knowledge Graph
 *
 * Documents entity relationships across all connected data sources.
 * Used to guide cross-domain queries and entity resolution.
 *
 * Discovery date: 2026-03-27
 * Sources verified: Ascend ERP, Salesforce CRM, Samsara Fleet, Vroozi Procurement, Power BI
 */

// ─── Entity Relationship Map ────────────────────────────────────────────

export interface EntityMapping {
  /** Field path in source system */
  readonly field: string;
  /** Match strategy for cross-system resolution */
  readonly matchType: 'exact' | 'fuzzy' | 'region-code' | 'geo-proximity' | 'manual';
  /** Notes on data quality or caveats */
  readonly notes?: string;
}

export interface EntityRelationship {
  /** How this entity appears in each system */
  readonly [system: string]: EntityMapping;
}

export const ENTITY_RELATIONSHIPS: Readonly<Record<string, EntityRelationship>> = {
  customer: {
    ascend: {
      field: 'Address.Name / DF_PBI_BillingChartQuery.CustomerName',
      matchType: 'fuzzy',
      notes: 'Ascend uses parent company name. 805 active customers in 2025.',
    },
    salesforce: {
      field: 'Account.Name',
      matchType: 'fuzzy',
      notes: 'SF has 21,311 accounts including well-site sub-accounts (e.g., "Aethon - Akita 90 Rockies 2H"). Match on parent name.',
    },
  },
  vendor: {
    ascend_ap: {
      field: 'vPurchaseJournal.vendor_name / vendor_display_id',
      matchType: 'exact',
      notes: 'AP spend data. Top 2025: Vtex ($51.6M), Calumet ($38.8M), Dale Petroleum ($32.9M).',
    },
    ascend_rack: {
      field: 'vRackPrice.Vendor_Name',
      matchType: 'fuzzy',
      notes: '71 distinct rack price vendors. Updated daily. Names may differ slightly from AP (e.g., "Gresham Petroleum Company" vs "Gresham Petroleum").',
    },
    vroozi: {
      field: 'suppliers.vendorId / externalId',
      matchType: 'exact',
      notes: 'Only 25 operational suppliers in Vroozi. vendorId cross-refs to Ascend vendor_display_id.',
    },
  },
  carrier: {
    ascend: {
      field: 'DF_PBI_BillingChartQuery.Carrier',
      matchType: 'region-code',
      notes: '116 distinct carriers. Internal carriers use "DF XXXX" format with profit center codes. External carriers use company names.',
    },
    samsara: {
      field: 'vehicles[].name + tags[].name',
      matchType: 'region-code',
      notes: '160 vehicles. Internal carriers map by region tag (e.g., DF 1036 Midland → "Midland" tag). External carriers have no Samsara vehicles.',
    },
  },
  site: {
    ascend: {
      field: 'Sites.Code / LongDescr / Latitude / Longitude',
      matchType: 'geo-proximity',
      notes: '78 sites. Some virtual (Government Contract, Contractors) with no GPS. ProfitCenter links to GL.',
    },
    samsara: {
      field: 'addresses.name / latitude / longitude',
      matchType: 'geo-proximity',
      notes: '326 geofences. Includes customer well sites not in Ascend. Match by lat/lng within ~0.2 degrees or city name.',
    },
  },
  salesperson: {
    ascend: {
      field: 'DF_PBI_BillingChartQuery.Salesperson',
      matchType: 'fuzzy',
      notes: '36 salespersons. Names may have formatting quirks (e.g., \'Petrus ". Booysen\').',
    },
    salesforce: {
      field: 'User.Name / User.Email',
      matchType: 'fuzzy',
      notes: '128 users (includes admins, API users). All @delta360.energy. Match by first+last name.',
    },
  },
  product: {
    ascend_invoice: {
      field: 'ARInvoiceItem.MasterProdID',
      matchType: 'exact',
      notes: 'Line-item product ID. Key: 4399=Dyed Short Truck, 1096=Dyed Transport, 1131=Clear Transport.',
    },
    ascend_product_names: {
      field: 'DF_PBI_DS_SalesAndProfitAnalysis.MasterProdID / MasterProdDescr',
      matchType: 'exact',
      notes: 'Historical view for ID-to-name lookup. IMPORTANT: Product.ProdID != ARInvoiceItem.MasterProdID.',
    },
    ascend_rack: {
      field: 'vRackPrice.ProductDescr',
      matchType: 'fuzzy',
      notes: 'Rack products use descriptive names like "Diesel Dyed", "Diesel Dyed TexLed". No numeric ID link.',
    },
    salesforce: {
      field: 'Product2.Name / ProductCode / Family',
      matchType: 'manual',
      notes: '1,891 SF products (Fittings & Hardware, Hoses & Reels). Different product universe than Ascend fuel products.',
    },
  },
  profit_center: {
    ascend: {
      field: 'ProfitCenters.PC / PCDesc',
      matchType: 'exact',
      notes: '43 profit centers. Code format: 0001=Corporate, 1020=Midland, 1039=Corpus Christi, 3000+=VTEX.',
    },
    samsara: {
      field: 'tags[].name',
      matchType: 'fuzzy',
      notes: '21 fleet tags. Regional tags (Shreveport, Midland, Corpus Christi, Colorado, Lake Charles) map to PCs.',
    },
    vroozi: {
      field: 'users[].userDefaults.profitCenterRef',
      matchType: 'exact',
      notes: 'User default PC assignment. Same codes as Ascend.',
    },
  },
  gl_account: {
    ascend: {
      field: 'TrialBalance.Natural / AcctDesc',
      matchType: 'exact',
      notes: '2,008+ GL rows. Types: A=Asset, L=Liability, Q=Equity, R=Revenue, X=Expense.',
    },
    vroozi: {
      field: 'gl-accounts.externalId / code / description',
      matchType: 'exact',
      notes: '889 GL accounts. externalId = Ascend GL natural account number.',
    },
  },
} as const;

// ─── Verified Cross-Domain Matches ──────────────────────────────────────

export interface CrossDomainMatch {
  readonly entity: string;
  readonly ascendValue: string;
  readonly otherSystem: string;
  readonly otherValue: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly notes?: string;
}

export const VERIFIED_CROSS_MATCHES: readonly CrossDomainMatch[] = [
  // Customer 360: Ascend + Salesforce
  {
    entity: 'customer',
    ascendValue: 'ConocoPhillips Company',
    otherSystem: 'salesforce',
    otherValue: 'ConocoPhillips Company (Account, Industry=Atlas Acquisition, Type=Customer)',
    confidence: 'high',
    notes: 'Multiple SF records: parent + well-site sub-accounts. Billing cities: MIDLAND, HOUSTON.',
  },
  {
    entity: 'customer',
    ascendValue: 'Aethon',
    otherSystem: 'salesforce',
    otherValue: 'Aethon (Account, 100+ well-site sub-accounts)',
    confidence: 'high',
    notes: 'SF has parent "Aethon" plus granular well-site accounts like "Aethon - Akita 90 Rockies 2H".',
  },
  {
    entity: 'customer',
    ascendValue: 'Baytex Energy USA Inc',
    otherSystem: 'salesforce',
    otherValue: 'Baytex Energy USA Inc (Account, Industry=Atlas Acquisition, Type=Customer, BillingState=Texas)',
    confidence: 'high',
    notes: 'Exact name match. Multiple SF records for different well sites.',
  },
  {
    entity: 'customer',
    ascendValue: 'CB&I LLC',
    otherSystem: 'salesforce',
    otherValue: 'CB&I (search via LIKE %CB%I%)',
    confidence: 'medium',
    notes: 'Top GP customer in Ascend ($10.3M). SF search may need ampersand escaping.',
  },
  // Vendor + Rack overlap
  {
    entity: 'vendor',
    ascendValue: 'Sunoco LP (AP: $14.9M)',
    otherSystem: 'ascend_rack',
    otherValue: 'Sunoco LP (vRackPrice vendor)',
    confidence: 'high',
    notes: 'Both an AP vendor we pay AND a rack price supplier we track.',
  },
  {
    entity: 'vendor',
    ascendValue: 'Dale Petroleum Company (AP: $32.9M)',
    otherSystem: 'ascend_rack',
    otherValue: 'Dale Petroleum Company (vRackPrice vendor)',
    confidence: 'high',
    notes: 'Third largest AP vendor. Also appears as billing carrier "Dale Petroleum Company".',
  },
  {
    entity: 'vendor',
    ascendValue: 'Valero Marketing & Supply Co (AP: $23.7M)',
    otherSystem: 'ascend_rack',
    otherValue: 'Valero Marketing & Supply Co (vRackPrice vendor)',
    confidence: 'high',
  },
  {
    entity: 'vendor',
    ascendValue: 'Citgo Petroleum Corp (AP: $18.3M)',
    otherSystem: 'ascend_rack',
    otherValue: 'Citgo Petroleum Corp (vRackPrice vendor)',
    confidence: 'high',
  },
  {
    entity: 'vendor',
    ascendValue: 'Flint Hills Res (AP: $18.3M)',
    otherSystem: 'ascend_rack',
    otherValue: 'Flint Hills Res (vRackPrice vendor)',
    confidence: 'high',
  },
  // Site + Geofence matches
  {
    entity: 'site',
    ascendValue: 'Midland (Code 1020, lat 31.82, lng -102.32)',
    otherSystem: 'samsara',
    otherValue: 'MIDLAND, TX (6600 W Hwy 80, lat 31.95, lng -102.16)',
    confidence: 'high',
    notes: 'Also matches "Delta Fuel I-20 Yard" geofence.',
  },
  {
    entity: 'site',
    ascendValue: 'Shreveport (Code 1019, lat 32.53, lng -93.76)',
    otherSystem: 'samsara',
    otherValue: 'SHREVEPORT YARD (1000 Wells Island Rd, lat 32.54, lng -93.75)',
    confidence: 'high',
    notes: 'Also matches "N Market" (1604 N Market St) and "Calumet Shreveport" nearby.',
  },
  {
    entity: 'site',
    ascendValue: 'Lake Charles (Code 1022, lat 30.23, lng -93.17)',
    otherSystem: 'samsara',
    otherValue: 'LAKE CHARLES, LA (5625 Broad St, lat 30.23, lng -93.14)',
    confidence: 'high',
  },
  // Salesperson matches
  {
    entity: 'salesperson',
    ascendValue: 'Adam Vegas',
    otherSystem: 'salesforce',
    otherValue: 'Adam Vegas (avegas@delta360.energy, Active)',
    confidence: 'high',
  },
  {
    entity: 'salesperson',
    ascendValue: 'Anna Snodgrass',
    otherSystem: 'salesforce',
    otherValue: 'Anna Snodgrass (asnodgrass@delta360.energy, Active)',
    confidence: 'high',
  },
  {
    entity: 'salesperson',
    ascendValue: 'Ashlee Hey',
    otherSystem: 'salesforce',
    otherValue: 'Ashlee Hey (ahey@delta360.energy, Active)',
    confidence: 'high',
  },
  {
    entity: 'salesperson',
    ascendValue: 'Ashley Hadwin',
    otherSystem: 'salesforce',
    otherValue: 'Ashley Hadwin (ahadwin@delta360.energy, Active)',
    confidence: 'high',
  },
  {
    entity: 'salesperson',
    ascendValue: 'Barry Iseminger',
    otherSystem: 'salesforce',
    otherValue: 'Barry Iseminger (biseminger@delta360.energy, Active)',
    confidence: 'high',
  },
  {
    entity: 'salesperson',
    ascendValue: 'Abby Marks',
    otherSystem: 'salesforce',
    otherValue: 'Abby Marks (amarks@delta360.energy, Active)',
    confidence: 'high',
  },
] as const;

// ─── Cross-Domain Query Templates ───────────────────────────────────────

export interface CrossDomainQueryTemplate {
  readonly name: string;
  readonly description: string;
  readonly systems: readonly string[];
  readonly steps: readonly string[];
}

export const CROSS_DOMAIN_QUERIES: readonly CrossDomainQueryTemplate[] = [
  {
    name: 'customer-360',
    description: 'Full customer view combining ERP billing + CRM account data',
    systems: ['ascend', 'salesforce'],
    steps: [
      'POST /ascend/query: SELECT CustomerName, CustType, SUM(Revenue) FROM billing WHERE Year=2025 GROUP BY CustomerName',
      'POST /salesforce/query: SELECT Name, Industry, Type, BillingState, OwnerId FROM Account WHERE Name LIKE %customer%',
      'Match on fuzzy name comparison. Ascend has billing/revenue, Salesforce has industry/type/owner.',
    ],
  },
  {
    name: 'vendor-margin-analysis',
    description: 'Compare what we pay vendors (AP) vs their rack prices vs what we charge customers',
    systems: ['ascend'],
    steps: [
      'POST /ascend/query: Top vendors from vPurchaseJournal (AP spend)',
      'POST /ascend/query: Vendor rack prices from vRackPrice',
      'POST /ascend/query: Customer invoice prices from BillingChartQuery JOIN ARInvoiceItem',
      'Calculate: Invoice price - Rack price = margin per gallon. Rack price - AP cost = supplier discount.',
    ],
  },
  {
    name: 'fleet-delivery-tracking',
    description: 'Track which physical trucks handled which billing deliveries',
    systems: ['ascend', 'samsara'],
    steps: [
      'POST /ascend/query: Carrier + ShipToDescr from BillingChartQuery (delivery records)',
      'GET /samsara/tags: Regional tags with vehicles[] (which trucks are in which region)',
      'GET /samsara/locations: Live GPS positions of all vehicles',
      'Map carrier PC code (e.g., 1036=Midland) to Samsara tag (Midland) to get vehicle list.',
    ],
  },
  {
    name: 'site-fleet-presence',
    description: 'Which fleet vehicles are currently at which ERP profit center sites',
    systems: ['ascend', 'samsara'],
    steps: [
      'GET /ascend/sites: Site GPS coordinates',
      'GET /samsara/locations: Live vehicle positions',
      'GET /samsara/addresses: Geofence boundaries',
      'Compare vehicle lat/lng to site lat/lng within radius. Or check geofence containment.',
    ],
  },
  {
    name: 'rep-performance-360',
    description: 'Sales rep billing revenue + CRM activity combined view',
    systems: ['ascend', 'salesforce'],
    steps: [
      'POST /ascend/query: Revenue + GP by Salesperson from BillingChartQuery JOIN ARInvoiceItem',
      'GET /salesforce/users: Match rep name to SF UserId',
      'POST /salesforce/query: Tasks + Events by OwnerId for matched user',
      'Combine: Billing performance (revenue, GP, customers) + CRM engagement (calls, visits, tasks).',
    ],
  },
  {
    name: 'fuel-margin-by-region',
    description: 'Compare invoice prices vs rack by supply point/region',
    systems: ['ascend'],
    steps: [
      'POST /ascend/query: Invoice prices by ShipToDescr + MasterProdID from BillingChartQuery JOIN ARInvoiceItem',
      'POST /ascend/query: Rack prices by SupplyPoint from vRackPrice',
      'Match ShipToDescr region to nearest SupplyPoint (TX→Midland rack, LA→Shreveport rack)',
      'Calculate: AvgInvoicePrice - AvgRackPrice = regional margin per gallon.',
    ],
  },
] as const;

// ─── Carrier to Samsara Region Mapping ──────────────────────────────────

export const CARRIER_REGION_MAP: Readonly<Record<string, string>> = {
  'DF 1011': 'Shreveport',
  'DF 1019': 'Shreveport',
  'DF 1020': 'Midland',
  'DF 1036': 'Midland',
  'DF 1022': 'Lake Charles',
  'DF 1037': 'Lake Charles',
  'DF 1039': 'Corpus Christi',
  'DF 1044': 'Houston',
  'DF 1047': 'Colorado',
  'DF 1002': 'St Joseph',
  'DF 1009': 'Contractors',
} as const;

// ─── Supply Point to Region Mapping ─────────────────────────────────────

export const SUPPLY_POINT_REGION_MAP: Readonly<Record<string, string>> = {
  'OPIS UBDRAvg Midland': 'Midland',
  'DTNRKAvgSan': 'San Antonio',
  'NM4256': 'New Mexico',
} as const;
