import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { gatewayFetch } from '@/lib/gateway';
import {
  registerTable,
  indexProducts,
  indexLocations,
  addLearning,
  loadRegistry,
  saveRegistry,
} from '@/lib/schema-registry';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';

/**
 * POST /api/registry/crawl
 *
 * Crawls Ascend ERP + other data sources, indexes their schema,
 * and builds product/location indexes for the AI to reference.
 */
export async function POST(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  // Only admins can trigger crawls
  const role = session?.user?.email ? getUserRole(session.user.email) : 'admin';
  if (role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  const results: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Get all Ascend tables
    const tablesRes = await gatewayFetch('/ascend/tables', 'admin');
    const tables = (tablesRes as { data?: Array<{ TABLE_NAME: string }> }).data ?? [];
    results.push(`Found ${tables.length} Ascend tables`);

    // 2. Index key tables' schemas (not all — just the important ones)
    const keyTables = [
      'ARInvoice', 'ARInvoiceItem', 'Address', 'Product',
      'Equipment', 'TankEquipment', 'AdHocPrices', 'AdHocPricesProduct',
      'Account', 'Site',
    ];

    for (const table of keyTables) {
      try {
        const schemaRes = await gatewayFetch(`/ascend/schema/${table}`, 'admin');
        const columns = ((schemaRes as { data?: Array<{ COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string }> }).data ?? []).map(c => ({
          name: c.COLUMN_NAME,
          type: c.DATA_TYPE,
          nullable: c.IS_NULLABLE === 'YES',
        }));
        registerTable('ascend', table, columns);
        results.push(`Indexed ${table}: ${columns.length} columns`);
      } catch (err) {
        errors.push(`Failed to index ${table}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Build product index
    try {
      const prodRes = await gatewayFetch('/ascend/query', 'admin', {
        method: 'POST',
        body: { sql: 'SELECT ProdID, Code, LongDescr, ProdType FROM Product ORDER BY ProdID' },
      });
      const prodData = (prodRes as { data?: Array<{ ProdID: string; Code: string; LongDescr: string; ProdType: string }> }).data ?? [];
      if (prodData.length > 0) {
        indexProducts(prodData.map(p => ({
          prodId: String(p.ProdID),
          code: p.Code ?? '',
          description: p.LongDescr ?? '',
          type: p.ProdType ?? 'unknown',
        })));
        results.push(`Indexed ${prodData.length} products`);
      }
    } catch (err) {
      errors.push(`Product index failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Build location/customer index
    try {
      const locRes = await gatewayFetch('/ascend/query', 'admin', {
        method: 'POST',
        body: { sql: "SELECT DISTINCT CustomerName AS Name, ShipToDescr, Latitude, Longitude FROM DF_PBI_BillingChartQuery WHERE InvoiceDt >= '2024-01-01' AND Latitude IS NOT NULL ORDER BY CustomerName" },
      });
      const locData = (locRes as { data?: Array<{ Name: string; ShipToDescr: string; Latitude: number; Longitude: number }> }).data ?? [];
      if (locData.length > 0) {
        indexLocations(locData.map(l => ({
          id: l.Name ?? '',
          name: l.Name ?? '',
          city: l.ShipToDescr ?? '',
          state: '',
          zip: '',
          isCustomer: true,
        })));
        results.push(`Indexed ${locData.length} customer locations`);
      }
    } catch (err) {
      errors.push(`Location index failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 5. Mark crawl complete
    const registry = loadRegistry();
    registry.lastFullCrawl = new Date().toISOString();
    saveRegistry(registry);

    addLearning(`Full schema crawl completed: ${results.length} operations, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined,
      tableCount: tables.length,
      lastCrawl: registry.lastFullCrawl,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Crawl failed',
      partialResults: results,
    }, { status: 500 });
  }
}

/**
 * GET /api/registry/crawl — returns current registry status
 */
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const registry = loadRegistry();
  return NextResponse.json({
    lastFullCrawl: registry.lastFullCrawl,
    tableCount: registry.tables.length,
    productCount: registry.products.length,
    locationCount: registry.locations.length,
    queryLogCount: registry.queryLog.length,
    learnings: registry.learnings.length,
  });
}
