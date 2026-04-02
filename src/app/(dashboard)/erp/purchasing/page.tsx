'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { ShoppingCart, ExternalLink, AlertTriangle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:3847';
const GATEWAY_API_KEY =
  process.env.NEXT_PUBLIC_GATEWAY_API_KEY || '';

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyFmtShort = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

/* ---------- gateway helpers ---------- */

async function gatewayPost(
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${GATEWAY_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GATEWAY_API_KEY ? { 'x-api-key': GATEWAY_API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function gatewayGet(path: string): Promise<Response> {
  return fetch(`${GATEWAY_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      ...(GATEWAY_API_KEY ? { 'x-api-key': GATEWAY_API_KEY } : {}),
    },
  });
}

/* ---------- types ---------- */

interface VrooziSupplier {
  name?: string;
  category?: string;
  id?: string;
  [key: string]: unknown;
}

interface VrooziCatalogItem {
  name?: string;
  itemName?: string;
  supplier?: string;
  supplierName?: string;
  category?: string;
  unitPrice?: number;
  price?: number;
  [key: string]: unknown;
}

interface SpendCategory {
  Account_Desc: string;
  total: number;
}

interface TopVendor {
  vendor_name: string;
  total_spend: number;
  invoice_count: number;
}

interface DataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/* ---------- component ---------- */

export default function PurchasingPage() {
  const [suppliers, setSuppliers] = useState<DataState<VrooziSupplier[]>>({
    data: null,
    loading: true,
    error: null,
  });
  const [catalogs, setCatalogs] = useState<DataState<VrooziCatalogItem[]>>({
    data: null,
    loading: true,
    error: null,
  });
  const [categories, setCategories] = useState<DataState<SpendCategory[]>>({
    data: null,
    loading: true,
    error: null,
  });
  const [vendors, setVendors] = useState<DataState<TopVendor[]>>({
    data: null,
    loading: true,
    error: null,
  });
  const [catalogSearch, setCatalogSearch] = useState('');

  /* fetch all four sources independently */
  useEffect(() => {
    // 1. Vroozi suppliers
    gatewayGet('/vroozi/suppliers')
      .then((r) => r.json())
      .then((data: unknown) => {
        const list: VrooziSupplier[] = Array.isArray(data)
          ? data
          : (data as Record<string, unknown>)?.suppliers
            ? ((data as Record<string, unknown>).suppliers as VrooziSupplier[])
            : [];
        setSuppliers({ data: list, loading: false, error: null });
      })
      .catch((e: unknown) => {
        setSuppliers({
          data: null,
          loading: false,
          error: e instanceof Error ? e.message : 'Vroozi suppliers unavailable',
        });
      });

    // 2. Vroozi catalogs
    gatewayGet('/vroozi/catalogs')
      .then((r) => r.json())
      .then((data: unknown) => {
        const list: VrooziCatalogItem[] = Array.isArray(data)
          ? data
          : (data as Record<string, unknown>)?.items
            ? ((data as Record<string, unknown>).items as VrooziCatalogItem[])
            : (data as Record<string, unknown>)?.catalogs
              ? ((data as Record<string, unknown>).catalogs as VrooziCatalogItem[])
              : [];
        setCatalogs({ data: list, loading: false, error: null });
      })
      .catch((e: unknown) => {
        setCatalogs({
          data: null,
          loading: false,
          error: e instanceof Error ? e.message : 'Vroozi catalogs unavailable',
        });
      });

    // 3. AP by GL category
    gatewayPost('/ascend/query', {
      sql: `SELECT Account_Desc, SUM(debit) as total FROM vPurchaseJournal WHERE Year_For_Period = 2026 AND Period BETWEEN 1 AND 12 GROUP BY Account_Desc ORDER BY total DESC LIMIT 30`,
    })
      .then((r) => r.json())
      .then((data: unknown) => {
        const rows: SpendCategory[] =
          (data as Record<string, unknown>)?.results
            ? ((data as Record<string, unknown>).results as SpendCategory[])
            : Array.isArray(data)
              ? (data as SpendCategory[])
              : [];
        setCategories({ data: rows, loading: false, error: null });
      })
      .catch((e: unknown) => {
        setCategories({
          data: null,
          loading: false,
          error: e instanceof Error ? e.message : 'Ascend query failed',
        });
      });

    // 4. Top vendors
    gatewayPost('/ascend/query', {
      sql: `SELECT vendor_name, SUM(debit) as total_spend, COUNT(*) as invoice_count FROM vPurchaseJournal WHERE Year_For_Period = 2026 AND Period BETWEEN 1 AND 12 GROUP BY vendor_name ORDER BY total_spend DESC LIMIT 25`,
    })
      .then((r) => r.json())
      .then((data: unknown) => {
        const rows: TopVendor[] =
          (data as Record<string, unknown>)?.results
            ? ((data as Record<string, unknown>).results as TopVendor[])
            : Array.isArray(data)
              ? (data as TopVendor[])
              : [];
        setVendors({ data: rows, loading: false, error: null });
      })
      .catch((e: unknown) => {
        setVendors({
          data: null,
          loading: false,
          error: e instanceof Error ? e.message : 'Ascend query failed',
        });
      });
  }, []);

  /* derived KPIs */
  const supplierCount = suppliers.data?.length ?? 0;
  const catalogCount = catalogs.data?.length ?? 0;

  const spendMTD = useMemo(() => {
    if (!vendors.data) return null;
    return vendors.data.reduce(
      (sum, v) => sum + (typeof v.total_spend === 'number' ? v.total_spend : Number(v.total_spend) || 0),
      0,
    );
  }, [vendors.data]);

  const topVendorName = vendors.data?.[0]?.vendor_name ?? '\u2014';

  /* filtered catalog */
  const filteredCatalog = useMemo(() => {
    const items = catalogs.data ?? [];
    if (!catalogSearch.trim()) return items;
    const q = catalogSearch.toLowerCase();
    return items.filter(
      (item) =>
        (item.name ?? item.itemName ?? '').toLowerCase().includes(q) ||
        (item.supplier ?? item.supplierName ?? '').toLowerCase().includes(q) ||
        (item.category ?? '').toLowerCase().includes(q),
    );
  }, [catalogs.data, catalogSearch]);

  /* chart data */
  const chartData = useMemo(() => {
    return (categories.data ?? []).map((c) => ({
      name:
        c.Account_Desc.length > 28
          ? c.Account_Desc.slice(0, 26) + '...'
          : c.Account_Desc,
      total: typeof c.total === 'number' ? c.total : Number(c.total) || 0,
      fullName: c.Account_Desc,
    }));
  }, [categories.data]);

  /* error banners */
  const errorSources: string[] = [];
  if (suppliers.error) errorSources.push(`Vroozi Suppliers: ${suppliers.error}`);
  if (catalogs.error) errorSources.push(`Vroozi Catalogs: ${catalogs.error}`);
  if (categories.error) errorSources.push(`GL Categories: ${categories.error}`);
  if (vendors.error) errorSources.push(`Top Vendors: ${vendors.error}`);

  return (
    <div
      style={{
        padding: '20px 24px',
        overflowY: 'auto',
        height: '100%',
        background: '#09090B',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(254, 80, 0, 0.08)',
              border: '1px solid rgba(254, 80, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingCart size={18} color="#FE5000" />
          </div>
          <div>
            <h1
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#E4E4E7',
                margin: 0,
                fontFamily: 'Georgia, serif',
              }}
            >
              Purchasing &amp; Procurement
            </h1>
            <p style={{ fontSize: '11px', color: '#71717A', margin: '2px 0 0' }}>
              Vroozi integration, vendor spend, GL categories
            </p>
          </div>
        </div>
        <a
          href="http://localhost:3000/admin/purchasing"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '12px',
            color: '#FE5000',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Portal Purchasing <ExternalLink size={12} />
        </a>
      </div>

      {/* Error banners */}
      {errorSources.length > 0 && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.06)',
            border: '1px solid rgba(234, 179, 8, 0.2)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} color="#EAB308" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ fontSize: '12px', color: '#EAB308' }}>
            {errorSources.map((msg) => (
              <div key={msg}>{msg}</div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
        }}
        className="purchasing-kpi-grid"
      >
        {[
          {
            label: 'Active Suppliers',
            value: suppliers.loading
              ? 'Loading...'
              : suppliers.error
                ? '\u2014'
                : `${supplierCount} Vroozi`,
          },
          {
            label: 'Catalog Items',
            value: catalogs.loading
              ? 'Loading...'
              : catalogs.error
                ? '\u2014'
                : catalogCount.toLocaleString(),
          },
          {
            label: 'Spend YTD',
            value: vendors.loading
              ? 'Loading...'
              : vendors.error || spendMTD === null
                ? '\u2014'
                : currencyFmtShort(spendMTD),
          },
          {
            label: 'Top Vendor',
            value: vendors.loading ? 'Loading...' : topVendorName,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: '#18181B',
              border: '1px solid #27272A',
              borderRadius: '8px',
              padding: '14px 16px',
            }}
          >
            <p style={{ fontSize: '11px', color: '#71717A', margin: 0 }}>
              {kpi.label}
            </p>
            <p
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: kpi.value === '\u2014' || kpi.value === 'Loading...' ? '#52525B' : '#E4E4E7',
                margin: '4px 0 0',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Suppliers Table */}
      <div
        style={{
          background: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '10px',
          padding: '16px',
        }}
      >
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#E4E4E7',
            margin: '0 0 12px',
          }}
        >
          Top Vendors by Spend
        </h2>
        {vendors.loading ? (
          <p style={{ fontSize: '12px', color: '#52525B', fontStyle: 'italic' }}>
            Loading vendor data...
          </p>
        ) : vendors.error ? (
          <p style={{ fontSize: '12px', color: '#71717A' }}>
            Vendor data unavailable
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid #27272A',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '8px 10px', color: '#71717A', fontWeight: 500 }}>
                    Name
                  </th>
                  <th style={{ padding: '8px 10px', color: '#71717A', fontWeight: 500 }}>
                    Spend YTD
                  </th>
                  <th style={{ padding: '8px 10px', color: '#71717A', fontWeight: 500 }}>
                    Invoice Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {(vendors.data ?? []).map((v, i) => (
                  <tr
                    key={`${v.vendor_name}-${i}`}
                    style={{ borderBottom: '1px solid #1C1C1F' }}
                  >
                    <td style={{ padding: '8px 10px', color: '#E4E4E7' }}>
                      {v.vendor_name}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        color: '#FE5000',
                        fontFamily: 'monospace',
                      }}
                    >
                      {currencyFmt.format(
                        typeof v.total_spend === 'number'
                          ? v.total_spend
                          : Number(v.total_spend) || 0,
                      )}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        color: '#A1A1AA',
                        fontFamily: 'monospace',
                      }}
                    >
                      {typeof v.invoice_count === 'number'
                        ? v.invoice_count.toLocaleString()
                        : v.invoice_count}
                    </td>
                  </tr>
                ))}
                {(vendors.data ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: '16px 10px',
                        color: '#52525B',
                        textAlign: 'center',
                      }}
                    >
                      No vendor data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Spend Categories Chart */}
      <div
        style={{
          background: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '10px',
          padding: '16px',
        }}
      >
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#E4E4E7',
            margin: '0 0 12px',
          }}
        >
          Top Spend Categories (GL)
        </h2>
        {categories.loading ? (
          <p style={{ fontSize: '12px', color: '#52525B', fontStyle: 'italic' }}>
            Loading GL categories...
          </p>
        ) : categories.error ? (
          <p style={{ fontSize: '12px', color: '#71717A' }}>
            GL category data unavailable
          </p>
        ) : chartData.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#52525B' }}>
            No spend categories found
          </p>
        ) : (
          <div style={{ width: '100%', height: Math.max(300, chartData.length * 28) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 30, bottom: 4, left: 140 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => currencyFmtShort(v)}
                  tick={{ fill: '#71717A', fontSize: 11 }}
                  axisLine={{ stroke: '#27272A' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={136}
                />
                <Tooltip
                  contentStyle={{
                    background: '#27272A',
                    border: '1px solid #3F3F46',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#E4E4E7',
                  }}
                  formatter={(value) => [currencyFmt.format(Number(value)), 'Spend']}
                  labelFormatter={(_label, payload) => {
                    const entries = payload as unknown as Array<Record<string, unknown>> | undefined;
                    const entry = entries?.[0]?.payload as { fullName?: string } | undefined;
                    return entry?.fullName ?? String(_label);
                  }}
                />
                <Bar dataKey="total" fill="#FE5000" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Vroozi Catalog */}
      <div
        style={{
          background: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '10px',
          padding: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#E4E4E7',
              margin: 0,
            }}
          >
            Vroozi Catalog
          </h2>
          <input
            type="text"
            placeholder="Search catalog..."
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            style={{
              background: '#09090B',
              border: '1px solid #27272A',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              color: '#E4E4E7',
              width: '220px',
              outline: 'none',
            }}
          />
        </div>
        {catalogs.loading ? (
          <p style={{ fontSize: '12px', color: '#52525B', fontStyle: 'italic' }}>
            Loading catalog...
          </p>
        ) : catalogs.error ? (
          <p style={{ fontSize: '12px', color: '#71717A' }}>
            Vroozi catalog unavailable
          </p>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid #27272A',
                    textAlign: 'left',
                    position: 'sticky',
                    top: 0,
                    background: '#18181B',
                  }}
                >
                  <th style={{ padding: '8px 10px', color: '#71717A', fontWeight: 500 }}>
                    Item Name
                  </th>
                  <th style={{ padding: '8px 10px', color: '#71717A', fontWeight: 500 }}>
                    Supplier
                  </th>
                  <th style={{ padding: '8px 10px', color: '#71717A', fontWeight: 500 }}>
                    Category
                  </th>
                  <th style={{ padding: '8px 10px', color: '#71717A', fontWeight: 500 }}>
                    Unit Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCatalog.map((item, i) => {
                  const price = item.unitPrice ?? item.price;
                  return (
                    <tr
                      key={`${item.name ?? item.itemName ?? ''}-${i}`}
                      style={{ borderBottom: '1px solid #1C1C1F' }}
                    >
                      <td style={{ padding: '8px 10px', color: '#E4E4E7' }}>
                        {item.name ?? item.itemName ?? '\u2014'}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#A1A1AA' }}>
                        {item.supplier ?? item.supplierName ?? '\u2014'}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#A1A1AA' }}>
                        {item.category ?? '\u2014'}
                      </td>
                      <td
                        style={{
                          padding: '8px 10px',
                          color: '#FE5000',
                          fontFamily: 'monospace',
                        }}
                      >
                        {typeof price === 'number'
                          ? currencyFmt.format(price)
                          : '\u2014'}
                      </td>
                    </tr>
                  );
                })}
                {filteredCatalog.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: '16px 10px',
                        color: '#52525B',
                        textAlign: 'center',
                      }}
                    >
                      {catalogSearch.trim()
                        ? 'No items match your search'
                        : 'No catalog items'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Responsive KPI grid */}
      <style>{`
        .purchasing-kpi-grid {
          grid-template-columns: repeat(2, 1fr) !important;
        }
        @media (min-width: 768px) {
          .purchasing-kpi-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
