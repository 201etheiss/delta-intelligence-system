import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateWorkbook } from '@/lib/workbook-generator';
import { type UserRole } from '@/lib/config/roles';
import { getUserRole } from '@/lib/config/roles';

/**
 * POST /api/workbooks
 *
 * Generate pre-built workbook templates with verified queries.
 * Body: { template: string, params?: Record<string, string> }
 */

interface TemplateParams {
  year?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
}

const TEMPLATES: Record<string, (params: TemplateParams) => { title: string; sheets: Array<{ name: string; endpoint: string; method: 'GET' | 'POST'; body?: Record<string, unknown>; description?: string }> }> = {

  'bol-summary': (p) => {
    const start = p.startDate ?? `${p.year ?? '2026'}-${(p.period ?? '01').padStart(2, '0')}-01`;
    const endMonth = parseInt(p.period ?? '1') + 1;
    const end = p.endDate ?? `${p.year ?? '2026'}-${String(endMonth).padStart(2, '0')}-01`;
    return {
      title: `BOL_Summary_${start}_to_${end}`,
      sheets: [
        {
          name: 'By Supplier-SupplyPt',
          endpoint: '/ascend/query',
          method: 'POST',
          body: { sql: `SELECT h.SupplierCode, h.SupplierDescr, h.SupplyPtCode, h.SupplyPtDescr, h.CarrierDescr, COUNT(*) AS BOLCount, SUM(h.TotalItemAmt) AS TotalAmt FROM vBOLHdrInfo h JOIN BOLHdr b ON h.VSysTrxNo = b.SysTrxNo WHERE b.BOLDtTm >= '${start}' AND b.BOLDtTm < '${end}' GROUP BY h.SupplierCode, h.SupplierDescr, h.SupplyPtCode, h.SupplyPtDescr, h.CarrierDescr ORDER BY TotalAmt DESC` },
          description: 'BOL count and amount by supplier, supply point, and carrier',
        },
        {
          name: 'By Product',
          endpoint: '/ascend/query',
          method: 'POST',
          body: { sql: `SELECT d.Code, d.Descr, COUNT(*) AS Lines, SUM(d.NetQty) AS TotalGallons, SUM(d.Amt) AS TotalAmt FROM vBolItemDetails d JOIN BOLHdr b ON d.SysTrxNo = b.SysTrxNo WHERE b.BOLDtTm >= '${start}' AND b.BOLDtTm < '${end}' GROUP BY d.Code, d.Descr ORDER BY TotalAmt DESC` },
          description: 'Product breakdown with gallons and amounts',
        },
        {
          name: 'By Carrier',
          endpoint: '/ascend/query',
          method: 'POST',
          body: { sql: `SELECT h.CarrierDescr, COUNT(*) AS BOLCount, SUM(h.TotalItemAmt) AS TotalAmt, AVG(h.TotalItemAmt) AS AvgPerBOL FROM vBOLHdrInfo h JOIN BOLHdr b ON h.VSysTrxNo = b.SysTrxNo WHERE b.BOLDtTm >= '${start}' AND b.BOLDtTm < '${end}' GROUP BY h.CarrierDescr ORDER BY TotalAmt DESC` },
          description: 'Carrier utilization summary',
        },
      ],
    };
  },

  'ar-aging': () => ({
    title: 'AR_Aging_Report',
    sheets: [
      { name: 'By Customer', endpoint: '/ascend/ar/aging', method: 'GET', description: 'AR aging by customer' },
      { name: 'By Type', endpoint: '/ascend/ar/summary', method: 'GET', description: 'AR summary by customer type' },
    ],
  }),

  'revenue': (p) => ({
    title: `Revenue_${p.year ?? '2025'}`,
    sheets: [
      { name: 'By Account', endpoint: `/ascend/revenue?year=${p.year ?? '2025'}`, method: 'GET', description: 'Revenue by account and period' },
      { name: 'By Customer', endpoint: `/ascend/revenue/by-customer?year=${p.year ?? '2025'}`, method: 'GET', description: 'Revenue by customer' },
      { name: 'GP by Profit Center', endpoint: `/ascend/gp/by-pc?year=${p.year ?? '2025'}`, method: 'GET', description: 'Gross profit by profit center' },
    ],
  }),

  'vendor-spend': (p) => ({
    title: `Vendor_Spend_${p.year ?? '2025'}`,
    sheets: [
      {
        name: 'Top Vendors',
        endpoint: '/ascend/query',
        method: 'POST',
        body: { sql: `SELECT TOP 50 vendor_name, vendor_display_id, COUNT(DISTINCT invoice_no) AS InvoiceCount, SUM(debit) AS TotalSpend FROM vPurchaseJournal WHERE Year_For_Period = ${p.year ?? '2025'} GROUP BY vendor_name, vendor_display_id ORDER BY TotalSpend DESC` },
        description: 'Top vendors by total spend',
      },
      {
        name: 'By GL Category',
        endpoint: '/ascend/query',
        method: 'POST',
        body: { sql: `SELECT TOP 50 Account_Desc, SUM(debit) AS TotalSpend, COUNT(DISTINCT vendor_name) AS VendorCount FROM vPurchaseJournal WHERE Year_For_Period = ${p.year ?? '2025'} GROUP BY Account_Desc ORDER BY TotalSpend DESC` },
        description: 'Spend by GL account category',
      },
      { name: 'All Vendors', endpoint: '/ascend/vendors', method: 'GET', description: 'Complete vendor list' },
    ],
  }),

  'fleet-status': () => ({
    title: 'Fleet_Status',
    sheets: [
      { name: 'Vehicles', endpoint: '/samsara/vehicles', method: 'GET', description: 'All fleet vehicles' },
      { name: 'Drivers', endpoint: '/samsara/drivers', method: 'GET', description: 'All drivers' },
      { name: 'GPS Locations', endpoint: '/samsara/locations', method: 'GET', description: 'Current vehicle locations' },
      { name: 'Geofences', endpoint: '/samsara/addresses', method: 'GET', description: 'All geofence locations' },
    ],
  }),

  'pipeline': () => ({
    title: 'Sales_Pipeline',
    sheets: [
      { name: 'Opportunities', endpoint: '/salesforce/opportunities', method: 'GET', description: 'All opportunities' },
      { name: 'Accounts', endpoint: '/salesforce/accounts', method: 'GET', description: 'All accounts' },
      { name: 'Leads', endpoint: '/salesforce/leads', method: 'GET', description: 'All leads' },
    ],
  }),
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  let role: UserRole = 'admin';
  if (session?.user?.email) {
    role = getUserRole(session.user.email);
  } else if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json() as { template: string; params?: TemplateParams };
    const { template, params } = body;

    const templateFn = TEMPLATES[template];
    if (!templateFn) {
      return NextResponse.json({
        error: `Unknown template: ${template}`,
        available: Object.keys(TEMPLATES),
      }, { status: 400 });
    }

    const config = templateFn(params ?? {});
    const result = await generateWorkbook(config, role);

    if (result.success && result.downloadUrl) {
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: result.error ?? 'Failed to generate workbook' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    templates: Object.keys(TEMPLATES).map(id => ({
      id,
      description: TEMPLATES[id]({}).title,
    })),
  });
}
