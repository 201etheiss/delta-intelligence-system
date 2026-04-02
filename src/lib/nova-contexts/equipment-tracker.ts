/**
 * Nova Context: Equipment Tracker
 * Vocabulary, schema, and query capabilities for the Equipment Tracker domain.
 * Covers: asset tracking, fleet status, alerts, maintenance, rentals, integrations.
 *
 * Production: https://equipment-tracker-tau.vercel.app
 * Database: Supabase (uttmfowppfupdsacuhzz), PostgreSQL + PostGIS
 */

import type { NovaContext } from './finance';

export const EQUIPMENT_TRACKER_CONTEXT: NovaContext = {
  domain: 'equipment-tracker',

  vocabulary: [
    'Asset tag — unique identifier format D360-{TYPE_CODE}-{NNN}; type codes: TNK (tanker), GEN (generator), PMP (pump), CMP (compressor), TRL (trailer)',
    'Tracking tiers — Tier 1 (Fleet/IoT via Samsara satellite+IoT continuous), Tier 2 (Mobile/Cellular GPS polling), Tier 3 (Static/RFID, BLE beacon, or manual check-in)',
    'Lifecycle stages — PREFAB → SHOP_REPAIR → READY → IN_TRANSIT → SETUP → IN_SERVICE → MAINTENANCE → PICKUP → DECOMMISSION',
    'Equipment types — TANKER | GENERATOR | PUMP | COMPRESSOR | TRAILER | TOOL | OTHER',
    'Mobility types — MOBILE (vehicles), SEMI_MOBILE (trailers, portable), STATIC (fixed tanks, installed); drives alert severity',
    'Equipment status — ACTIVE | MAINTENANCE | IDLE | RETIRED | IN_TRANSIT',
    'Containment types — tank subtypes: horizontal, vertical, transcube',
    'Geofence — geographic boundary on a site; inclusion zones alert on exit, exclusion zones alert on entry; stored as PostGIS GEOMETRY polygons or radius-based',
    'Alert types — UNEXPECTED_MOVEMENT, GEOFENCE_BREACH, STALE_PING, LOW_BATTERY, STATUS_CHANGE, MISSED_CHECKIN, DEVICE_OFFLINE',
    'Alert severity — INFO | WARNING | CRITICAL; static equipment movement triggers CRITICAL',
    'Checkin — GPS position event from multiple sources: MANUAL, IOT, SATELLITE, CELLULAR, RFID, BLE, SAMSARA',
    'Locate request — real-time find-this-asset via Socket.io; status: PENDING → FULFILLED or TIMEOUT',
    'Branches — Shreveport (1019), Midland (1020), Lake Charles (1022), Port Allen (1038), Corpus Christi (1039)',
    'Ticket rule — automated work order generation on trigger events (low battery, missed check-in, excessive movement) with cooldown window',
    'Rental agreement — customer contract for equipment with daily rate, billing frequency (weekly, monthly, quarterly)',
    'Transfer — equipment movement between branches or sites; status: PENDING → IN_TRANSIT → COMPLETED',
    'Fuel tracking — fuelCapacityGallons, currentFuelLevel, lastFuelReadingAt, totalGallonsDelivered per tank',
    'Fuel transaction types — DELIVERY, CONSUMPTION, TRANSFER, ADJUSTMENT',
    'Depreciation — purchasePrice, usefulLife, salvageValue; methods: straight-line, declining balance',
    'Device types — GPS_SATELLITE, GPS_CELLULAR, RFID, BLE_BEACON, MANUAL_ONLY with battery and ping monitoring',
    'Site types — FIELD_SITE | OFFICE | YARD | WAREHOUSE | REMOTE with lat/lng center and radius',
    'Fleet stats — 7,613 total assets: 6,842 active (89.9%), 412 maintenance (5.4%), 359 rental fleet (4.7%)',
  ],

  keyTables: [
    'Equipment — 7,613 assets; central record with assetTag, trackingTier, status, type, cross-system links (samsaraVehicleId, fleetpandaId, salesforceAssetId)',
    'Device — GPS/RFID/BLE tracking hardware; deviceType, batteryLevel, lastPingAt, status (ACTIVE | OFFLINE | LOW_BATTERY)',
    'Checkin — position history; latitude, longitude, altitude, accuracy, speed, heading, source',
    'Alert — anomaly notifications; type, severity, acknowledged status',
    'Site — geofenced locations; name, type, latitude, longitude, radius in meters',
    'Branch — operational yards; Shreveport, Midland, Lake Charles, Port Allen, Corpus Christi',
    'Ticket — work orders; ticketNumber, category, priority, status, AI triage fields (aiSummary, aiCategory, aiPriority)',
    'RentalAgreement — customer contracts; status (DRAFT | ACTIVE | EXPIRED | CANCELLED), dailyRate, billingFrequency',
    'Transfer — branch-to-branch movement; status tracking (PENDING → IN_TRANSIT → COMPLETED)',
    'FuelTransaction — delivery/consumption log; type (DELIVERY | CONSUMPTION | TRANSFER | ADJUSTMENT)',
    'Customer — end customer with accountCode, contactName, salesforceAccountId link',
  ],

  queryPatterns: [
    'Where is tank D360-TNK-042?',
    'How many assets does Delta360 track?',
    'Which assets are idle over 30 days?',
    'Show maintenance schedule for fleet vehicles',
    "What's the fuel level on site 12 tanks?",
    'What triggers an unexpected movement alert?',
    'What branches does Delta360 operate?',
    'Show all CRITICAL alerts this week',
    'Which Tier 1 devices are offline?',
    'How does the Locate Now feature work?',
    'What does the asset tag format mean?',
    'How are work orders generated automatically?',
    'What integrations does the Equipment Tracker use?',
    'Show rental agreements expiring this month',
  ],

  availableActions: [
    'Look up equipment by asset tag (D360-TNK-001 format)',
    'Report fleet status breakdown (active, maintenance, idle, retired)',
    'View alert history and acknowledge alerts',
    'Track equipment lifecycle stage transitions',
    'View rental agreement status and billing',
    'Check device health and battery levels',
    'Monitor fuel levels and deliveries',
    'View dispatch assignments and routing',
  ],

  gatewayEndpoints: [
    'GET /ascend/equipment',
    'GET /ascend/tanks',
    'GET /ascend/tanks/assignments',
    'GET /samsara/vehicles',
    'GET /samsara/locations',
    'GET /fleetpanda/assets',
    'GET /salesforce/query — Asset, Account objects',
  ],
} as const;
