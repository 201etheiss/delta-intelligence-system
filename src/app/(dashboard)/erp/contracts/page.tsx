'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FileText, ExternalLink, Clock, AlertTriangle } from 'lucide-react';

const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:3847';
const GATEWAY_API_KEY =
  process.env.NEXT_PUBLIC_GATEWAY_API_KEY || '';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SFContract {
  Id: string;
  ContractNumber: string;
  Account?: { Name: string } | null;
  Status: string;
  StartDate: string | null;
  EndDate: string | null;
  ContractTerm: number | null;
  Description: string | null;
}

interface SFOpportunity {
  Id: string;
  Name: string;
  Amount: number | null;
  StageName: string;
  CloseDate: string | null;
  Account?: { Name: string } | null;
}

interface QueryResult<T> {
  records?: T[];
  totalSize?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function sfQuery<T>(soql: string): Promise<{ records: T[]; totalSize: number }> {
  const res = await fetch(`${GATEWAY_BASE_URL}/salesforce/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GATEWAY_API_KEY ? { 'x-api-key': GATEWAY_API_KEY } : {}),
    },
    body: JSON.stringify({ soql }),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}`);
  const data: QueryResult<T> = await res.json();
  return {
    records: data?.records ?? [],
    totalSize: data?.totalSize ?? (data?.records ?? []).length,
  };
}

function fmtDate(iso: string | null): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

function countdownColor(days: number): string {
  if (days < 7) return '#EF4444';
  if (days < 30) return '#FE5000';
  return '#EAB308';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ContractsPage() {
  const [contracts, setContracts] = useState<readonly SFContract[]>([]);
  const [expiring, setExpiring] = useState<readonly SFContract[]>([]);
  const [pipeline, setPipeline] = useState<readonly SFOpportunity[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const errs: Record<string, string> = {};

    // 1. Active contracts
    try {
      const r = await sfQuery<SFContract>(
        "SELECT Id, ContractNumber, Account.Name, Status, StartDate, EndDate, ContractTerm, Description FROM Contract WHERE Status = 'Activated' ORDER BY EndDate ASC LIMIT 50"
      );
      setContracts(r.records);
    } catch (e: unknown) {
      errs.contracts = e instanceof Error ? e.message : 'Failed to load contracts';
    }

    // 2. Expiring within 60 days
    try {
      const r = await sfQuery<SFContract>(
        "SELECT Id, ContractNumber, Account.Name, Status, StartDate, EndDate, ContractTerm FROM Contract WHERE Status = 'Activated' AND EndDate <= NEXT_N_DAYS:60 ORDER BY EndDate ASC"
      );
      setExpiring(r.records);
    } catch (e: unknown) {
      errs.expiring = e instanceof Error ? e.message : 'Failed to load expiring contracts';
    }

    // 3. Open pipeline
    try {
      const r = await sfQuery<SFOpportunity>(
        "SELECT Id, Name, Amount, StageName, CloseDate, Account.Name FROM Opportunity WHERE IsClosed = false ORDER BY CloseDate ASC LIMIT 30"
      );
      setPipeline(r.records);
    } catch (e: unknown) {
      errs.pipeline = e instanceof Error ? e.message : 'Failed to load pipeline';
    }

    setErrors(errs);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ---- Computed KPIs ---- */
  const activeCount = contracts.length;
  const expiringIn30 = (expiring ?? []).filter((c) => {
    const d = daysUntil(c.EndDate);
    return d !== null && d <= 30;
  }).length;
  const totalContractValue = 0; // Contract object doesn't have a standard value field
  const pipelineValue = (pipeline ?? []).reduce(
    (sum, o) => sum + (typeof o.Amount === 'number' ? o.Amount : 0),
    0
  );

  /* ---- Group pipeline by stage ---- */
  const stageGroups: Record<string, readonly SFOpportunity[]> = {};
  for (const opp of pipeline ?? []) {
    const stage = opp.StageName || 'Unknown';
    stageGroups[stage] = [...(stageGroups[stage] ?? []), opp];
  }
  const stageOrder = Object.keys(stageGroups).sort();

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
        fontFamily: 'system-ui, -apple-system, sans-serif',
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
            <FileText size={18} color="#FE5000" />
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
              Contracts &amp; Pipeline
            </h1>
            <p style={{ fontSize: '11px', color: '#71717A', margin: '2px 0 0' }}>
              Active contracts, renewals, and sales pipeline
            </p>
          </div>
        </div>
        <a
          href="http://localhost:3000/account/contracts"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: '#FE5000',
            textDecoration: 'none',
          }}
        >
          Portal Contracts <ExternalLink size={12} />
        </a>
      </div>

      {/* KPI Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
        }}
        className="contracts-kpi-grid"
      >
        {[
          { label: 'Active Contracts', value: loading ? '...' : String(activeCount) },
          { label: 'Expiring in 30d', value: loading ? '...' : String(expiringIn30), warn: expiringIn30 > 0 },
          { label: 'Total Contract Value', value: loading ? '...' : (totalContractValue > 0 ? fmtCurrency(totalContractValue) : 'N/A') },
          { label: 'Pipeline Value', value: loading ? '...' : fmtCurrency(pipelineValue) },
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
            <p style={{ fontSize: '11px', color: '#71717A', margin: 0 }}>{kpi.label}</p>
            <p
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: kpi.warn ? '#FE5000' : '#E4E4E7',
                margin: '4px 0 0',
                fontFamily: 'monospace',
              }}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Errors */}
      {Object.keys(errors).length > 0 && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <AlertTriangle size={14} color="#EF4444" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: '#EF4444' }}>
            {Object.entries(errors).map(([key, msg]) => (
              <p key={key} style={{ margin: '0 0 2px' }}>
                <strong>{key}:</strong> {msg}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Contracts Table */}
      <Section title="Active Contracts" count={activeCount}>
        {loading ? (
          <LoadingRow />
        ) : contracts.length === 0 && !errors.contracts ? (
          <EmptyRow message="No active contracts found" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Contract #', 'Account', 'Status', 'Start Date', 'End Date', 'Term (mo)', 'Description'].map(
                    (h) => (
                      <th key={h} style={thStyle}>
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const days = daysUntil(c.EndDate);
                  const isExpiringSoon = days !== null && days <= 30 && days >= 0;
                  return (
                    <tr
                      key={c.Id}
                      style={{
                        background: isExpiringSoon ? 'rgba(254, 80, 0, 0.06)' : 'transparent',
                      }}
                    >
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', color: '#E4E4E7', fontWeight: 600 }}>
                          {c.ContractNumber || '\u2014'}
                        </span>
                      </td>
                      <td style={tdStyle}>{c.Account?.Name || '\u2014'}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            color: '#22C55E',
                            fontWeight: 600,
                          }}
                        >
                          {c.Status}
                        </span>
                      </td>
                      <td style={tdStyle}>{fmtDate(c.StartDate)}</td>
                      <td style={{ ...tdStyle, color: isExpiringSoon ? '#FE5000' : '#A1A1AA' }}>
                        {fmtDate(c.EndDate)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {c.ContractTerm != null ? c.ContractTerm : '\u2014'}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.Description || '\u2014'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Expiring Soon */}
      <Section title="Expiring Soon" count={expiring.length} icon={<Clock size={14} color="#EAB308" />}>
        {loading ? (
          <LoadingRow />
        ) : expiring.length === 0 && !errors.expiring ? (
          <EmptyRow message="No contracts expiring within 60 days" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {expiring.map((c) => {
              const days = daysUntil(c.EndDate);
              const daysLabel = days !== null ? `${days} day${days === 1 ? '' : 's'} left` : 'unknown';
              const badgeColor = days !== null ? countdownColor(days) : '#52525B';
              return (
                <div
                  key={c.Id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#18181B',
                    border: '1px solid #27272A',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span style={{ fontFamily: 'monospace', color: '#E4E4E7', fontWeight: 600, fontSize: '12px' }}>
                      {c.ContractNumber || '\u2014'}
                    </span>
                    <span style={{ color: '#71717A', fontSize: '12px' }}>{c.Account?.Name || '\u2014'}</span>
                    <span style={{ color: '#52525B', fontSize: '11px' }}>ends {fmtDate(c.EndDate)}</span>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '10px',
                      background: `${badgeColor}18`,
                      color: badgeColor,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {daysLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Pipeline */}
      <Section title="Pipeline" count={pipeline.length}>
        {loading ? (
          <LoadingRow />
        ) : pipeline.length === 0 && !errors.pipeline ? (
          <EmptyRow message="No open opportunities" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {stageOrder.map((stage) => {
              const opps = stageGroups[stage] ?? [];
              const subtotal = opps.reduce(
                (s, o) => s + (typeof o.Amount === 'number' ? o.Amount : 0),
                0
              );
              return (
                <div key={stage}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#A1A1AA' }}>
                      {stage} ({opps.length})
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#FE5000', fontFamily: 'monospace' }}>
                      {fmtCurrency(subtotal)}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          {['Opportunity', 'Account', 'Amount', 'Close Date'].map((h) => (
                            <th key={h} style={thStyle}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {opps.map((o) => (
                          <tr key={o.Id}>
                            <td style={tdStyle}>{o.Name}</td>
                            <td style={tdStyle}>{o.Account?.Name || '\u2014'}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>
                              {fmtCurrency(o.Amount)}
                            </td>
                            <td style={tdStyle}>{fmtDate(o.CloseDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Responsive styles */}
      <style>{`
        .contracts-kpi-grid {
          grid-template-columns: repeat(2, 1fr) !important;
        }
        @media (min-width: 768px) {
          .contracts-kpi-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components & styles                                     */
/* ------------------------------------------------------------------ */

function Section({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#0F0F12',
        border: '1px solid #27272A',
        borderRadius: '10px',
        padding: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '12px',
        }}
      >
        {icon}
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#E4E4E7', margin: 0 }}>
          {title}
        </h2>
        <span
          style={{
            fontSize: '10px',
            color: '#71717A',
            background: '#27272A',
            padding: '1px 6px',
            borderRadius: '8px',
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function LoadingRow() {
  return (
    <p style={{ fontSize: '12px', color: '#52525B', fontStyle: 'italic', margin: 0 }}>
      Loading...
    </p>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <p style={{ fontSize: '12px', color: '#52525B', margin: 0 }}>{message}</p>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  fontSize: '10px',
  fontWeight: 600,
  color: '#52525B',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #27272A',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  color: '#A1A1AA',
  borderBottom: '1px solid #1C1C1F',
  whiteSpace: 'nowrap',
};
