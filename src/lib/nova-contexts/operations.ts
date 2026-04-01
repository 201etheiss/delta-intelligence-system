/**
 * Nova Context: Operations
 * Vocabulary, schema, and query capabilities for the Operations domain.
 * Covers: fleet, dispatch, telematics, equipment, fuel delivery.
 */

import type { NovaContext } from './finance';

export const OPERATIONS_CONTEXT: NovaContext = {
  domain: 'operations',

  vocabulary: [
    'Fleet — 160 active vehicles tracked via Samsara GPS telematics',
    'Driver — 237 drivers registered in Samsara with HOS compliance tracking',
    'Dispatch — assignment of drivers and trucks to delivery routes',
    'BOL (Bill of Lading) — delivery document confirming fuel quantity transferred',
    'Samsara — primary telematics platform; provides live GPS, engine hours, odometer, fuel level',
    'Fleet Panda — asset management platform for trucks and bulk storage tanks',
    'Telemetry — real-time vehicle data: speed, location, engine status, fuel level',
    'Geofence — defined geographic boundary used to trigger arrival/departure events',
    'HOS (Hours of Service) — DOT-mandated driver hours limits tracked in Samsara',
    'ELD (Electronic Logging Device) — onboard device that logs HOS automatically',
    'Asset — any tracked physical unit: truck, trailer, or tank in Fleet Panda',
    'Tank — bulk fuel storage tank assigned to a customer site or depot',
    'Site — customer delivery location with GPS coordinates from Ascend',
    'Utilization rate — active vehicle hours / available hours for a time window',
    'Idle time — engine-on time with no movement; key fuel waste metric',
    'Profit center — operational unit; fleet assignments map to profit centers in Ascend',
    'Order — fuel delivery order generated from customer demand or schedule',
  ],

  keyTables: [],

  queryPatterns: [
    'Where is truck 42 right now?',
    'How many deliveries were completed today?',
    'What is fleet utilization this week?',
    'Which drivers are currently on-duty?',
    'Show vehicles in maintenance status',
    'List trucks with low fuel levels',
    'Which vehicles are idle for more than 30 minutes?',
    'Show all geofence arrivals in the last 24 hours',
    'What is the odometer reading for truck 17?',
    'Which tanks are assigned to customer X?',
    'Show engine hours for all trucks this month',
    'List drivers with HOS violations',
    'How many assets are in Fleet Panda?',
  ],

  availableActions: [
    'track-vehicle — get live GPS position and status for a specific vehicle',
    'view-fleet-map — open live map view of all active vehicles',
    'export-driver-hours — pull HOS summary for compliance reporting',
    'view-asset-detail — get full profile for a truck or tank from Fleet Panda',
    'check-tank-assignments — list customer sites with assigned bulk tanks',
    'pull-delivery-summary — aggregate completed deliveries for a date range',
    'flag-idle-vehicles — identify vehicles with excessive idle time',
    'view-fuel-levels — current fuel percentages across all tracked vehicles',
  ],

  gatewayEndpoints: [
    'GET /samsara/vehicles',
    'GET /samsara/drivers',
    'GET /samsara/locations',
    'GET /samsara/stats',
    'GET /samsara/fuel',
    'GET /samsara/addresses',
    'GET /samsara/tags',
    'GET /fleetpanda/assets',
    'GET /fleetpanda/assets/trucks',
    'GET /fleetpanda/assets/tanks',
    'GET /fleetpanda/customers',
    'GET /ascend/sites',
    'GET /ascend/tanks',
    'GET /ascend/tanks/assignments',
    'GET /ascend/equipment',
  ],
};
