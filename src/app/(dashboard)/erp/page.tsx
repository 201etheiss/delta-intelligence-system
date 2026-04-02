'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useDensity } from '@/components/density/DensityProvider';
import { MockDataBanner } from '@/components/common/MockDataBanner';
import {
  Receipt,
  Banknote,
  Package,
  FileText,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';

const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_GATEWAY_BASE_URL ?? 'http://127.0.0.1:3847';
const GATEWAY_API_KEY =
  process.env.NEXT_PUBLIC_GATEWAY_API_KEY ?? '';

interface ModuleTile {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  href: string;
  kpiLabel: string;
  fetchKpi: () => Promise<string>;
}

async function gatewayPost(path: string, body: Record<string, unknown>): Promise<Response> {
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

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

const ERP_MODULES: readonly ModuleTile[] = [
  {
    id: 'ap',
    name: 'Accounts Payable',
    description: 'Vendor invoices, payments, aging',
    icon: Receipt,
    href: '/erp/ap',
    kpiLabel: 'AP spend YTD',
    fetchKpi: async () => {
      const res = await gatewayPost('/ascend/query', {
        sql: "SELECT SUM(debit) as total FROM vPurchaseJournal WHERE Year_For_Period = 2026 AND Period BETWEEN 1 AND 12",
      });
      const data = await res.json();
      const total = data?.results?.[0]?.total ?? data?.[0]?.total ?? null;
      if (total == null) return '\u2014';
      return formatCurrency(Number(total));
    },
  },
  {
    id: 'ar',
    name: 'Accounts Receivable',
    description: 'Customer invoices, collections, aging',
    icon: Banknote,
    href: '/erp/ar',
    kpiLabel: 'AR outstanding',
    fetchKpi: async () => {
      const res = await gatewayGet('/ascend/ar/aging');
      const data = await res.json();
      const total =
        data?.totalOutstanding ??
        data?.total ??
        data?.results?.[0]?.total ??
        null;
      if (total == null) return '\u2014';
      return formatCurrency(Number(total));
    },
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Stock levels, pricing, product catalog',
    icon: Package,
    href: '/erp/inventory',
    kpiLabel: 'products',
    fetchKpi: async () => {
      const res = await gatewayPost('/ascend/query', {
        sql: "SELECT COUNT(DISTINCT MasterProdID) as count FROM DF_PBI_DS_SalesAndProfitAnalysis",
      });
      const data = await res.json();
      const count = data?.results?.[0]?.count ?? data?.[0]?.count ?? null;
      if (count == null) return '\u2014';
      return `${Number(count).toLocaleString()} products`;
    },
  },
  {
    id: 'contracts',
    name: 'Contracts',
    description: 'Vendor & customer contracts, renewals',
    icon: FileText,
    href: '/erp/contracts',
    kpiLabel: 'active',
    fetchKpi: async () => {
      const res = await gatewayPost('/salesforce/query', {
        soql: "SELECT COUNT() FROM Contract WHERE Status = 'Activated'",
      });
      const data = await res.json();
      const count =
        data?.totalSize ?? data?.results?.[0]?.expr0 ?? data?.count ?? null;
      if (count == null) return '\u2014';
      return `${Number(count).toLocaleString()} active`;
    },
  },
  {
    id: 'purchasing',
    name: 'Purchasing',
    description: 'Purchase orders, Vroozi, procurement',
    icon: ShoppingCart,
    href: '/erp/purchasing',
    kpiLabel: 'suppliers',
    fetchKpi: async () => {
      const res = await gatewayGet('/vroozi/suppliers');
      const data = await res.json();
      const count = Array.isArray(data)
        ? data.length
        : data?.suppliers?.length ?? data?.totalSize ?? data?.count ?? null;
      if (count == null) return '\u2014';
      return `${Number(count).toLocaleString()} suppliers`;
    },
  },
] as const;

export default function ERPHubPage() {
  const density = useDensity();
  const [kpis, setKpis] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasAnyError = useMemo(() => Object.keys(errors).length > 0, [errors]);

  useEffect(() => {
    const initialLoading: Record<string, boolean> = {};
    for (const m of ERP_MODULES) {
      initialLoading[m.id] = true;
    }
    setLoading(initialLoading);

    for (const mod of ERP_MODULES) {
      mod
        .fetchKpi()
        .then((value) => {
          setKpis((prev) => ({ ...prev, [mod.id]: value }));
          setLoading((prev) => ({ ...prev, [mod.id]: false }));
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Gateway offline';
          setErrors((prev) => ({ ...prev, [mod.id]: message }));
          setKpis((prev) => ({ ...prev, [mod.id]: '\u2014' }));
          setLoading((prev) => ({ ...prev, [mod.id]: false }));
        });
    }
  }, []);

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
          ERP Hub
        </h1>
        <p style={{ fontSize: '12px', color: '#71717A', margin: '3px 0 0' }}>
          Accounts payable, receivable, inventory, contracts, and procurement
        </p>
      </div>

      {/* Gateway offline banner */}
      {hasAnyError && <MockDataBanner />}

      {/* Operator mode: compact module summary bar */}
      {density === 'operator' && (
        <div className="flex items-center gap-6 text-xs px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg mb-3 flex-wrap">
          {ERP_MODULES.map((mod, i) => (
            <Link key={mod.id} href={mod.href} className="flex items-center gap-1.5 hover:text-[#FE5000] transition-colors text-zinc-300 no-underline">
              {i > 0 && <span className="text-zinc-700 mr-1.5">|</span>}
              <span className="text-zinc-500">{mod.name}:</span>
              <span className="font-mono font-semibold text-white">{kpis[mod.id] ?? '...'}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Module Tiles Grid */}
      <div
        style={{
          display: density === 'operator' ? 'none' : 'grid',
          gridTemplateColumns: 'repeat(1, 1fr)',
          gap: '12px',
        }}
        className="erp-grid"
      >
        {ERP_MODULES.map((mod) => {
          const Icon = mod.icon;
          const kpi = kpis[mod.id];
          const isLoading = loading[mod.id] ?? true;
          const error = errors[mod.id];

          return (
            <Link
              key={mod.id}
              href={mod.href}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  background: '#18181B',
                  border: '1px solid #27272A',
                  borderRadius: '10px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                className="erp-tile"
              >
                {/* Icon */}
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'rgba(254, 80, 0, 0.08)',
                    border: '1px solid rgba(254, 80, 0, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} color="#FE5000" />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#E4E4E7',
                      margin: 0,
                    }}
                  >
                    {mod.name}
                  </p>
                  <p
                    style={{
                      fontSize: '11px',
                      color: '#71717A',
                      margin: '3px 0 0',
                    }}
                  >
                    {mod.description}
                  </p>

                  {/* KPI */}
                  <div style={{ marginTop: '10px' }}>
                    {isLoading ? (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#52525B',
                          fontStyle: 'italic',
                        }}
                      >
                        Loading...
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: kpi === '\u2014' ? '#52525B' : '#FE5000',
                          fontFamily: 'monospace',
                        }}
                        title={error ?? mod.kpiLabel}
                      >
                        {kpi}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Responsive grid + hover styles */}
      <style>{`
        .erp-grid {
          grid-template-columns: 1fr !important;
        }
        @media (min-width: 768px) {
          .erp-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (min-width: 1024px) {
          .erp-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        .erp-tile:hover {
          border-color: rgba(254, 80, 0, 0.4) !important;
          background: #1C1C1F !important;
        }
      `}</style>
    </div>
  );
}
