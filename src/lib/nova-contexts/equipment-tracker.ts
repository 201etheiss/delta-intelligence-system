/**
 * Nova Context: Equipment Tracker
 *
 * Provides Nova with structured knowledge about the Delta360 Equipment Tracker
 * platform so it can answer user questions about asset tracking, fleet status,
 * alerts, maintenance, rentals, and integrations.
 *
 * Production: https://equipment-tracker-tau.vercel.app
 * Database: Supabase (uttmfowppfupdsacuhzz), PostgreSQL + PostGIS
 */

export const EQUIPMENT_TRACKER_CONTEXT = {
  name: 'Equipment Tracker',
  description:
    'Multi-tier asset tracking platform for Delta360 field equipment. Tracks tankers, generators, pumps, compressors, trailers, and industrial assets across GPS check-ins, geofenced sites, automated alerts, dispatch, compliance, and billing.',

  url: 'https://equipment-tracker-tau.vercel.app',

  vocabulary: {
    assetTag:
      'Unique identifier for each equipment record. Format: D360-{TYPE_CODE}-{NNN}. Examples: D360-TNK-001 (tanker), D360-GEN-042 (generator), D360-PMP-007 (pump).',
    trackingTier:
      'Operational tracking category. Tier 1 (TIER_1_FLEET): satellite/IoT continuous tracking via Samsara. Tier 2 (TIER_2_MOBILE): cellular GPS polling. Tier 3 (TIER_3_STATIC): RFID, BLE beacon, or manual check-in.',
    checkin:
      'A GPS position event for a piece of equipment. Can originate from manual entry, IoT device, Samsara GPS poll, RFID scan, BLE beacon, or satellite.',
    geofence:
      'A geographic boundary associated with a site. Inclusion geofences alert when equipment leaves the zone; exclusion geofences alert when equipment enters the zone. Stored as PostGIS GEOMETRY polygons.',
    site:
      'A named physical location (field site, office, yard, warehouse, remote) with a lat/lng center and radius-based geofence boundary.',
    alert:
      'An automated anomaly notification. Types: UNEXPECTED_MOVEMENT (static equipment moved >100m), GEOFENCE_BREACH, STALE_PING, LOW_BATTERY, STATUS_CHANGE, MISSED_CHECKIN, DEVICE_OFFLINE.',
    locateRequest:
      'A real-time "find this asset" request sent from dispatcher to field crew via Socket.io. Status: PENDING → FULFILLED or TIMEOUT.',
    lifecycleStage:
      'Tank lifecycle progression: PREFAB → SHOP_REPAIR → READY → IN_TRANSIT → SETUP → IN_SERVICE → MAINTENANCE → PICKUP → DECOMMISSION.',
    mobilityType:
      'Asset mobility classification: MOBILE (vehicles), SEMI_MOBILE (trailers, portable equipment), STATIC (fixed tanks, installed equipment). Drives alert severity — static equipment triggering movement alerts gets CRITICAL severity.',
    branch:
      'Operational yard location. Active branches: Shreveport (1019), Midland (1020), Lake Charles (1022), Port Allen (1038), Corpus Christi (1039).',
    ticketRule:
      'An automated rule that generates work order tickets on trigger events (low battery, missed check-in, excessive movement, etc.) with a cooldown window to prevent duplicates.',
    rentalAgreement:
      'A customer rental contract for a specific piece of equipment with daily rate and billing frequency (weekly, monthly, quarterly, etc.).',
    transfer:
      'A recorded movement of equipment between branches or sites with status tracking (PENDING → IN_TRANSIT → COMPLETED).',
  },

  dataModel: {
    Equipment: {
      description: 'Central asset record. One record per physical piece of equipment.',
      keyFields: [
        'assetTag — unique D360-{TYPE_CODE}-{NNN} identifier',
        'trackingTier — TIER_1_FLEET | TIER_2_MOBILE | TIER_3_STATIC',
        'mobilityType — MOBILE | SEMI_MOBILE | STATIC',
        'status — ACTIVE | MAINTENANCE | IDLE | RETIRED | IN_TRANSIT',
        'type — TANKER | GENERATOR | PUMP | COMPRESSOR | TRAILER | TOOL | OTHER',
        'samsaraVehicleId — links to Samsara GPS fleet data',
        'fleetpandaId — links to Fleet Panda records',
        'lifecycleStage — tank lifecycle position',
        'fuelCapacityGallons, currentFuelLevel — tank fuel state',
        'purchasePrice, depreciationMethod — financial/depreciation tracking',
      ],
      relations: [
        'Site — assigned location with geofence',
        'Branch — home yard',
        'Customer — asset owner or lessee',
        'Device[] — attached tracking hardware',
        'Checkin[] — position history',
        'Alert[] — anomaly history',
        'RentalAgreement[] — rental contracts',
        'Ticket[] — maintenance and service work orders',
        'Transfer[] — branch/site transfer history',
        'Inspection[] — field inspection records',
        'FuelTransaction[] — fuel delivery/consumption log',
        'DepreciationEntry[] — book value history',
      ],
    },
    Site: {
      description: 'Named geographic location with a radius-based geofence.',
      keyFields: ['name', 'type (FIELD_SITE | OFFICE | YARD | WAREHOUSE | REMOTE)', 'latitude', 'longitude', 'radius (meters)'],
    },
    Device: {
      description: 'Tracking hardware attached to equipment.',
      keyFields: [
        'deviceType — GPS_SATELLITE | GPS_CELLULAR | RFID | BLE_BEACON | MANUAL_ONLY',
        'trackingMethod — SATELLITE | IOT | CELLULAR | RFID | BLE | MANUAL',
        'batteryLevel, lastPingAt, status (ACTIVE | OFFLINE | LOW_BATTERY)',
        'samsaraVehicleId — Samsara integration link',
      ],
    },
    Checkin: {
      description: 'Single GPS position event for an equipment record.',
      keyFields: ['latitude, longitude, altitude, accuracy, speed, heading', 'source (MANUAL | IOT | SATELLITE | CELLULAR | RFID | BLE | SAMSARA)'],
    },
    Alert: {
      description: 'Automated anomaly triggered by check-in analysis or device monitoring.',
      keyFields: [
        'type — UNEXPECTED_MOVEMENT | GEOFENCE_BREACH | STALE_PING | LOW_BATTERY | STATUS_CHANGE | MISSED_CHECKIN | DEVICE_OFFLINE',
        'severity — INFO | WARNING | CRITICAL',
        'acknowledged, acknowledgedAt, acknowledgedById',
      ],
    },
    Ticket: {
      description: 'Work order or service request for a piece of equipment.',
      keyFields: [
        'ticketNumber, category, priority (LOW | MEDIUM | HIGH | URGENT), status (OPEN | IN_PROGRESS | ON_HOLD | RESOLVED | CLOSED)',
        'aiSummary, aiCategory, aiPriority — AI-generated triage fields',
        'isAutoGenerated — true if created by a TicketRule',
      ],
    },
    RentalAgreement: {
      description: 'Customer rental contract for equipment.',
      keyFields: ['status (DRAFT | ACTIVE | EXPIRED | CANCELLED)', 'startDate, endDate, dailyRate, billingFrequency'],
    },
    Customer: {
      description: 'End customer record with optional Salesforce CRM sync.',
      keyFields: ['accountCode, contactName, contactEmail', 'salesforceAccountId — Salesforce sync link'],
    },
  },

  capabilities: [
    'Look up equipment by asset tag (D360-TNK-001 format)',
    'Report fleet status breakdown: active, maintenance, idle, retired',
    'Explain tracking tier differences and what each tier tracks',
    'Describe the alert system: what triggers each alert type and at what severity',
    'Explain the geofence system: site-radius checks vs PostGIS polygon geofences',
    'Describe the check-in workflow for field crews',
    'Explain equipment lifecycle stages for tanks',
    'Report on rental agreement status and billing',
    'Describe the dispatch and routing workflow',
    'Explain integrations: Samsara (GPS), Fleet Panda, Salesforce, Mapbox',
    'Describe real-time locate request workflow (Locate Now)',
    'Explain automated ticket rules and how they generate work orders',
    'Describe depreciation tracking and financial fields on equipment',
    'Report on device health: ONLINE/STALE/OFFLINE status and battery levels',
    'Explain fuel tracking: capacity, current level, delivery transactions',
  ],

  queryExamples: [
    {
      question: 'How many assets does Delta360 track?',
      answer: '7,613 total assets — 6,842 active (89.9%), 412 in maintenance (5.4%), 359 rental fleet (4.7%).',
    },
    {
      question: 'What are the three tracking tiers?',
      answer:
        'Tier 1 (Fleet/IoT): satellite and IoT continuous tracking via Samsara for fleet vehicles. Tier 2 (Mobile/Cellular): cellular GPS polling for mobile equipment. Tier 3 (Static/RFID): RFID, BLE beacon, or manual check-in for fixed tanks and installed equipment.',
    },
    {
      question: 'How does the geofence alert system work?',
      answer:
        'Two layers: (1) site-radius check — haversine distance from site center vs site.radius in meters; triggers CRITICAL for static equipment, WARNING for mobile. (2) PostGIS polygon geofences — INCLUSION zones alert when equipment leaves, EXCLUSION zones alert when equipment enters. 15-minute cooldown prevents duplicate alerts.',
    },
    {
      question: 'What triggers an unexpected movement alert?',
      answer:
        'Any STATIC-classified equipment that moves more than 100 meters from its last known check-in position triggers a CRITICAL UNEXPECTED_MOVEMENT alert and emits a real-time Socket.io event to all connected dispatchers.',
    },
    {
      question: 'What branches does Delta360 operate?',
      answer:
        'Five branches: Shreveport (1019), Midland (1020), Lake Charles (1022), Port Allen (1038), Corpus Christi (1039).',
    },
    {
      question: 'How does the Locate Now feature work?',
      answer:
        'Dispatcher clicks Locate Now on an equipment detail page. A LocateRequest record is created (PENDING) and emitted via Socket.io to any field crew with that equipment. When the crew responds with their GPS position, the request is marked FULFILLED with the response coordinates.',
    },
    {
      question: 'What does the asset tag format mean?',
      answer:
        'Asset tags follow D360-{TYPE_CODE}-{NNN}. D360 = Delta360. Type codes: TNK (tanker), GEN (generator), PMP (pump), CMP (compressor), TRL (trailer). NNN is a zero-padded sequence number. Example: D360-TNK-001 is the first tanker record.',
    },
    {
      question: 'How is fuel tracked?',
      answer:
        'Equipment records carry fuelCapacityGallons, currentFuelLevel, lastFuelReadingAt, and totalGallonsDelivered. FuelTransaction records log individual DELIVERY, CONSUMPTION, TRANSFER, and ADJUSTMENT events per tank.',
    },
    {
      question: 'What integrations does the Equipment Tracker use?',
      answer:
        'Samsara (real-time GPS for Tier 1 fleet, vehicle ID linking, geofence checks after each poll cycle), Fleet Panda (fleet management data), Salesforce (customer and asset sync via JWT bearer auth), Mapbox (dark-v11 map visualization, PostGIS geofence rendering), QuickBooks (invoice sync).',
    },
    {
      question: 'How are work orders generated automatically?',
      answer:
        'TicketRule records define trigger conditions (LOW_BATTERY, DEVICE_OFFLINE, MISSED_CHECKIN, EXCESSIVE_MOVEMENT, MAINTENANCE_OVERDUE, RENTAL_EXPIRING, etc.) with title/body templates and a cooldownHours field. When a trigger fires for a specific piece of equipment, a Ticket is auto-created and linked to the rule. The AI triage layer then adds aiSummary, aiCategory, and aiPriority.',
    },
  ],

  integrations: {
    supabase: {
      projectId: 'uttmfowppfupdsacuhzz',
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 5432,
      features: ['PostgreSQL', 'PostGIS (geofences)', 'Prisma PrismaPg adapter'],
    },
    samsara: {
      purpose: 'Real-time GPS positions for Tier 1 fleet vehicles',
      linkField: 'equipment.samsaraVehicleId / device.samsaraVehicleId',
    },
    fleetpanda: {
      purpose: 'Fleet management data sync',
      linkField: 'equipment.fleetpandaId',
    },
    salesforce: {
      purpose: 'Customer account and asset record sync',
      linkFields: ['customer.salesforceAccountId', 'equipment.salesforceAssetId'],
      auth: 'JWT Bearer (SALESFORCE_JWT_PRIVATE_KEY)',
      rateLimit: '5 concurrent requests with queue',
    },
    mapbox: {
      purpose: 'Map visualization, geofence rendering, path playback',
      style: 'mapbox://styles/mapbox/dark-v11',
    },
  },
} as const;

export type EquipmentTrackerContext = typeof EQUIPMENT_TRACKER_CONTEXT;
