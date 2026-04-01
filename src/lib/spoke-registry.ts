import { EVENT_TYPES, type EventType } from '@/lib/events/event-types';

export interface SpokeEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  requiresAuth: boolean;
}

export interface SpokeConfig {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  healthEndpoint: string;
  status: 'active' | 'degraded' | 'offline' | 'dev';
  authType: 'federation' | 'api-key' | 'none';
  eventSubscriptions: EventType[];
  eventEmissions: EventType[];
  endpoints: SpokeEndpoint[];
  lastHealthCheck?: string;
  lastHealthStatus?: 'healthy' | 'degraded' | 'down';
}

export interface SpokeHealthResult {
  spokeId: string;
  spokeName: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTimeMs: number;
  checkedAt: string;
  error?: string;
}

export const SPOKE_REGISTRY: readonly SpokeConfig[] = [
  {
    id: 'equipment-tracker',
    name: 'Equipment Tracker',
    description: 'Asset management, maintenance, rental operations, and fleet tracking for 7,600+ assets',
    baseUrl: 'https://equipment-tracker-tau.vercel.app',
    healthEndpoint: '/api/health',
    status: 'active',
    authType: 'federation',
    eventSubscriptions: [
      EVENT_TYPES.ORDER_CREATED,
      EVENT_TYPES.SAMSARA_SYNC,
      EVENT_TYPES.ALERT_TRIGGERED,
    ],
    eventEmissions: [
      EVENT_TYPES.EQUIPMENT_CHECKED_IN,
      EVENT_TYPES.EQUIPMENT_CHECKED_OUT,
      EVENT_TYPES.EQUIPMENT_ALERT,
      EVENT_TYPES.EQUIPMENT_MAINTENANCE,
      EVENT_TYPES.TANK_DELIVERED,
      EVENT_TYPES.TANK_LEVEL_UPDATE,
      EVENT_TYPES.GEOFENCE_BREACH,
      EVENT_TYPES.DISPATCH_ASSIGNED,
      EVENT_TYPES.DISPATCH_COMPLETED,
    ],
    endpoints: [
      { path: '/api/equipment', method: 'GET', description: 'List all equipment', requiresAuth: true },
      { path: '/api/equipment', method: 'POST', description: 'Create equipment record', requiresAuth: true },
      { path: '/api/equipment/[id]', method: 'GET', description: 'Get equipment by ID', requiresAuth: true },
      { path: '/api/equipment/[id]', method: 'PUT', description: 'Update equipment record', requiresAuth: true },
      { path: '/api/checkins', method: 'POST', description: 'Record check-in/check-out', requiresAuth: true },
      { path: '/api/alerts', method: 'GET', description: 'List active alerts', requiresAuth: true },
      { path: '/api/dispatch', method: 'GET', description: 'List dispatch assignments', requiresAuth: true },
      { path: '/api/dispatch', method: 'POST', description: 'Create dispatch assignment', requiresAuth: true },
      { path: '/api/health', method: 'GET', description: 'Health check', requiresAuth: false },
    ],
  },
  {
    id: 'signal-map',
    name: 'Signal Map (OTED)',
    description: 'Operator assessment platform measuring decision-making, building, and coordination under pressure',
    baseUrl: 'http://localhost:3000',
    healthEndpoint: '/api/health',
    status: 'active',
    authType: 'federation',
    eventSubscriptions: [
      EVENT_TYPES.NOVA_RESPONSE,
    ],
    eventEmissions: [
      EVENT_TYPES.ASSESSMENT_STARTED,
      EVENT_TYPES.ASSESSMENT_COMPLETED,
      EVENT_TYPES.PROFILE_GENERATED,
      EVENT_TYPES.ENRICHMENT_COMPLETED,
      EVENT_TYPES.REPORT_GENERATED,
    ],
    endpoints: [
      { path: '/api/assessments', method: 'GET', description: 'List assessments', requiresAuth: true },
      { path: '/api/assessments', method: 'POST', description: 'Start new assessment', requiresAuth: true },
      { path: '/api/assessments/[id]', method: 'GET', description: 'Get assessment by ID', requiresAuth: true },
      { path: '/api/scoring', method: 'POST', description: 'Score an assessment', requiresAuth: true },
      { path: '/api/profiles', method: 'GET', description: 'List operator profiles', requiresAuth: true },
      { path: '/api/profiles/[id]', method: 'GET', description: 'Get profile by ID', requiresAuth: true },
      { path: '/api/health', method: 'GET', description: 'Health check', requiresAuth: false },
    ],
  },
  {
    id: 'delta-portal',
    name: 'Delta Portal',
    description: 'Consumer-facing platform for Delta360 customers — orders, catalog, tracking, invoices',
    baseUrl: 'http://localhost:3000',
    healthEndpoint: '/api/health',
    status: 'dev',
    authType: 'federation',
    eventSubscriptions: [
      EVENT_TYPES.ORDER_UPDATED,
      EVENT_TYPES.INVOICE_CREATED,
      EVENT_TYPES.INVOICE_PAID,
      EVENT_TYPES.DELIVERY_COMPLETED,
      EVENT_TYPES.TANK_DELIVERED,
    ],
    eventEmissions: [
      EVENT_TYPES.CUSTOMER_REGISTERED,
      EVENT_TYPES.PRODUCT_VIEWED,
      EVENT_TYPES.CART_UPDATED,
      EVENT_TYPES.CHECKOUT_STARTED,
      EVENT_TYPES.PAYMENT_PROCESSED,
      EVENT_TYPES.DELIVERY_SCHEDULED,
      EVENT_TYPES.DELIVERY_COMPLETED,
      EVENT_TYPES.QUOTE_REQUESTED,
      EVENT_TYPES.QUOTE_APPROVED,
    ],
    endpoints: [
      { path: '/api/products', method: 'GET', description: 'List products', requiresAuth: false },
      { path: '/api/products/[id]', method: 'GET', description: 'Get product by ID', requiresAuth: false },
      { path: '/api/orders', method: 'GET', description: 'List customer orders', requiresAuth: true },
      { path: '/api/orders', method: 'POST', description: 'Create order', requiresAuth: true },
      { path: '/api/tracking', method: 'GET', description: 'Track deliveries', requiresAuth: true },
      { path: '/api/invoices', method: 'GET', description: 'List invoices', requiresAuth: true },
      { path: '/api/quotes', method: 'POST', description: 'Request a quote', requiresAuth: true },
      { path: '/api/quotes/[id]', method: 'GET', description: 'Get quote by ID', requiresAuth: true },
      { path: '/api/health', method: 'GET', description: 'Health check', requiresAuth: false },
    ],
  },
  {
    id: 'gateway',
    name: 'Unified Data Gateway',
    description: 'Hub gateway bridging Ascend SQL, Salesforce, Samsara, Power BI, and Fleet Panda services',
    baseUrl: 'http://127.0.0.1:3847',
    healthEndpoint: '/',
    status: 'active',
    authType: 'api-key',
    eventSubscriptions: [],
    eventEmissions: [
      EVENT_TYPES.GATEWAY_QUERY,
      EVENT_TYPES.ASCEND_SYNC,
      EVENT_TYPES.SALESFORCE_SYNC,
      EVENT_TYPES.SAMSARA_SYNC,
      EVENT_TYPES.POWERBI_SYNC,
    ],
    endpoints: [
      { path: '/ascend/query', method: 'POST', description: 'Execute Ascend SQL query', requiresAuth: true },
      { path: '/salesforce/query', method: 'POST', description: 'Execute Salesforce SOQL query', requiresAuth: true },
      { path: '/salesforce/records', method: 'POST', description: 'CRUD Salesforce records', requiresAuth: true },
      { path: '/samsara/vehicles', method: 'GET', description: 'List Samsara vehicles', requiresAuth: true },
      { path: '/samsara/locations', method: 'GET', description: 'Get GPS locations', requiresAuth: true },
      { path: '/powerbi/datasets', method: 'GET', description: 'List Power BI datasets', requiresAuth: true },
      { path: '/powerbi/refresh', method: 'POST', description: 'Trigger Power BI refresh', requiresAuth: true },
      { path: '/fleet-panda/vehicles', method: 'GET', description: 'List Fleet Panda vehicles', requiresAuth: true },
      { path: '/', method: 'GET', description: 'Gateway health and service status', requiresAuth: false },
    ],
  },
] as const;

export function getSpokeById(id: string): SpokeConfig | undefined {
  return SPOKE_REGISTRY.find((s) => s.id === id);
}

export function getSpokesForEvent(eventType: string): SpokeConfig[] {
  return SPOKE_REGISTRY.filter((s) =>
    (s.eventSubscriptions as readonly string[]).includes(eventType)
  );
}

export async function checkSpokeHealth(spoke: SpokeConfig): Promise<SpokeHealthResult> {
  const checkedAt = new Date().toISOString();
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${spoke.baseUrl}${spoke.healthEndpoint}`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;

    if (res.ok) {
      return {
        spokeId: spoke.id,
        spokeName: spoke.name,
        status: 'healthy',
        responseTimeMs,
        checkedAt,
      };
    }

    return {
      spokeId: spoke.id,
      spokeName: spoke.name,
      status: 'degraded',
      responseTimeMs,
      checkedAt,
      error: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      spokeId: spoke.id,
      spokeName: spoke.name,
      status: 'down',
      responseTimeMs: Date.now() - start,
      checkedAt,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function checkAllSpokeHealth(): Promise<SpokeHealthResult[]> {
  const results = await Promise.allSettled(
    SPOKE_REGISTRY.map((spoke) => checkSpokeHealth(spoke))
  );

  return results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          spokeId: 'unknown',
          spokeName: 'unknown',
          status: 'down' as const,
          responseTimeMs: 0,
          checkedAt: new Date().toISOString(),
          error: r.reason instanceof Error ? r.reason.message : 'Promise rejected',
        }
  );
}
