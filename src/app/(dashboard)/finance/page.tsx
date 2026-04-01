'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import type { Anomaly } from '@/lib/anomaly-detector';
import WelcomeModal from '@/components/common/WelcomeModal';
import HelpTooltip from '@/components/common/HelpTooltip';
import { LiveWidgetGrid } from '@/components/dashboard/LiveWidget';
import { getWidgetsForRole } from '@/lib/dashboard-configs';
import IntelligenceWidget from '@/components/dashboard/IntelligenceWidget';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';
import { useDensity } from '@/components/density/DensityProvider';
import { DensityKPI } from '@/components/density/DensityKPI';
import { DensityTable } from '@/components/density/DensityTable';
import { DensityChart } from '@/components/density/DensityChart';
import { DensityInsight } from '@/components/density/DensityInsight';
import { DensitySection } from '@/components/density/DensitySection';

// ── Types ─────────────────────────────────────────────────────
interface RecentInvoice {
  id: string;
  date: string;
  amount: number;
  customer: string;
}

interface DashboardResponse {
  success: boolean;
  recentInvoices?: RecentInvoice[];
  error?: string;
}

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface StoredConversation {
  id: string;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(s: string): string {
  if (!s) return '--';
  try {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function loadConversations(): StoredConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('di_conversations');
    return raw ? (JSON.parse(raw) as StoredConversation[]) : [];
  } catch {
    return [];
  }
}

const TOOLS = [
  { name: 'Sales Scorecard', url: 'http://localhost:3005', description: 'Salesforce pipeline, visit tracking, rep performance', status: 'running', color: '#FE5000' },
  { name: 'Equipment Tracker', url: 'https://equipment-tracker-tau.vercel.app', description: 'Tank assignments, equipment lifecycle, field service', status: 'deployed', color: '#22C55E' },
  { name: 'Signal Map (OTED)', url: 'https://oted-system.vercel.app/admin', description: 'Assessment platform, scoring rubrics, signal analysis', status: 'deployed', color: '#22C55E' },
];

// ── Session Insights Hook ─────────────────────────────────────
function useSessionInsights() {
  const [insights, setInsights] = useState<{
    recentChats: Array<{
      id: string;
      question: string;
      finding: string;
      model?: string;
      tokenCost: number;
      updatedAt: string;
    }>;
    weeklyQueries: number;
    topTopics: Array<{ topic: string; count: number }>;
  }>({ recentChats: [], weeklyQueries: 0, topTopics: [] });

  useEffect(() => {
    const convos = loadConversations();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const recentChats = convos.slice(0, 5).map((c) => {
      const msgs = c.messages ?? [];
      const firstUser = msgs.find((m) => m.role === 'user');
      const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
      const totalTokens = msgs.reduce((sum, m) => sum + (m.inputTokens ?? 0) + (m.outputTokens ?? 0), 0);
      const model = msgs.find((m) => m.model)?.model;

      return {
        id: c.id,
        question: firstUser?.content?.slice(0, 100) ?? 'Untitled',
        finding: lastAssistant?.content?.split('\n')[0]?.slice(0, 120) ?? 'No response',
        model,
        tokenCost: totalTokens,
        updatedAt: c.updatedAt,
      };
    });

    const weeklyConvos = convos.filter((c) => new Date(c.updatedAt).getTime() > weekAgo);
    const weeklyQueries = weeklyConvos.reduce(
      (sum, c) => sum + (c.messages ?? []).filter((m) => m.role === 'user').length,
      0
    );

    const topicCounts: Record<string, number> = {};
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'and', 'but', 'or', 'not', 'no', 'so', 'if',
      'then', 'than', 'too', 'very', 'just', 'that', 'this', 'it', 'its', 'my',
      'me', 'we', 'our', 'you', 'your', 'they', 'them', 'their', 'what', 'which',
      'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
      'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'show', 'get']);

    for (const c of weeklyConvos) {
      const firstUser = (c.messages ?? []).find((m) => m.role === 'user');
      if (!firstUser) continue;
      const words = firstUser.content.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
      for (const w of words) {
        if (w.length > 2 && !stopWords.has(w)) {
          topicCounts[w] = (topicCounts[w] ?? 0) + 1;
        }
      }
    }

    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));

    setInsights({ recentChats, weeklyQueries, topTopics });
  }, []);

  return insights;
}

// ── Density-aware sub-components ──────────────────────────────

function ExecutiveView({
  invoices,
  invoicesLoading,
  anomalies,
  insights,
  userRole,
  onboardingDone,
  onboardingProgress,
}: {
  invoices: RecentInvoice[];
  invoicesLoading: boolean;
  anomalies: Anomaly[];
  insights: ReturnType<typeof useSessionInsights>;
  userRole: string;
  onboardingDone: boolean;
  onboardingProgress: number;
}) {
  const invoiceTableData = invoices.map((inv) => ({
    customer: inv.customer,
    date: fmtDate(inv.date),
    amount: fmt(inv.amount),
  }));

  const activityChartData = [
    { label: 'Mon', value: Math.max(insights.weeklyQueries * 0.1, 1) },
    { label: 'Tue', value: Math.max(insights.weeklyQueries * 0.18, 1) },
    { label: 'Wed', value: Math.max(insights.weeklyQueries * 0.22, 1) },
    { label: 'Thu', value: Math.max(insights.weeklyQueries * 0.2, 1) },
    { label: 'Fri', value: Math.max(insights.weeklyQueries * 0.15, 1) },
    { label: 'Sat', value: Math.max(insights.weeklyQueries * 0.08, 1) },
    { label: 'Sun', value: Math.max(insights.weeklyQueries * 0.07, 1) },
  ];

  return (
    <div className="space-y-4">
      {!onboardingDone && (
        <Link
          href="/onboarding"
          className="flex items-center justify-between rounded-lg border border-[#FE5000]/30 bg-[#FE5000]/5 px-5 py-4 hover:bg-[#FE5000]/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FE5000]/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#FE5000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#09090B] dark:text-white">Getting Started</p>
              <p className="text-xs text-[#71717A]">Complete your setup to unlock all features</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 h-2 rounded-full bg-[#E4E4E7] dark:bg-[#27272A] overflow-hidden">
              <div className="h-full rounded-full bg-[#FE5000] transition-all" style={{ width: `${onboardingProgress}%` }} />
            </div>
            <span className="text-xs font-mono text-[#FE5000]">{onboardingProgress}%</span>
          </div>
        </Link>
      )}

      {/* KPI Cards */}
      <DensitySection title="Key Metrics">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DensityKPI label="Queries This Week" value={String(insights.weeklyQueries)} />
          <DensityKPI label="Top Topic" value={insights.topTopics[0]?.topic ?? '--'} />
          <DensityKPI label="Active Sources" value="8" delta="+0 this week" deltaDirection="neutral" />
          <DensityKPI label="Connected Tools" value={String(TOOLS.length)} delta="All systems go" deltaDirection="up" />
        </div>
      </DensitySection>

      {/* Nova Insight */}
      <DensityInsight
        text="Delta Intelligence has 8 active data sources connected. AR aging and gross profit are the most queried topics this week. Consider reviewing the cash flow summary."
        actionLabel="Open Chat"
        onAction={() => { window.location.href = '/chat'; }}
      />

      {/* Live Widgets */}
      <DensitySection title="Live Data">
        <div className="flex items-center justify-between gap-2 mb-2">
          <HelpTooltip text="Live data from the gateway — each widget refreshes independently" position="right" />
          <Link
            href="/dashboards"
            className="inline-flex items-center gap-1 rounded border border-[#3F3F46] px-2.5 py-1 text-[11px] font-medium text-[#A1A1AA] hover:border-[#FE5000]/60 hover:text-[#FE5000] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Customize
          </Link>
        </div>
        <LiveWidgetGrid widgets={getWidgetsForRole(userRole)} role={userRole} columns={4} />
      </DensitySection>

      {/* Activity Trend Chart */}
      <DensitySection title="Query Activity (This Week)">
        <DensityChart type="area" data={activityChartData} height={160} title="Daily Queries" />
      </DensitySection>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <DensitySection title="Anomalies Detected">
          <div className="space-y-2">
            {anomalies.map((a) => {
              const colors = {
                critical: 'border-red-500/30 bg-red-500/10 text-red-500',
                warning: 'border-orange-500/30 bg-orange-500/10 text-orange-500',
                info: 'border-blue-500/30 bg-blue-500/10 text-blue-500',
              };
              return (
                <div key={a.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${colors[a.severity]}`}>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{a.metric}</span>
                    <span className="text-xs ml-2 opacity-80">{a.description}</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase shrink-0">{a.severity}</span>
                </div>
              );
            })}
          </div>
        </DensitySection>
      )}

      {/* AI Intelligence */}
      <DensitySection title="Intelligence">
        <IntelligenceWidget page="/finance" />
      </DensitySection>

      {/* Recent Invoices (executive table) */}
      <DensitySection title="Recent Invoices">
        {invoicesLoading ? (
          <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded bg-[#27272A] animate-pulse" />)}</div>
        ) : invoiceTableData.length > 0 ? (
          <DensityTable
            columns={[
              { key: 'customer', label: 'Customer' },
              { key: 'date', label: 'Date' },
              { key: 'amount', label: 'Amount', align: 'right' },
            ]}
            data={invoiceTableData}
          />
        ) : (
          <p className="text-sm text-[#A1A1AA]">No recent invoices.</p>
        )}
      </DensitySection>

      {/* Ask Delta Intelligence */}
      <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-gradient-to-br from-[#09090B] to-[#18181B] px-5 py-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-semibold text-base mb-1">Ask Delta Intelligence</h3>
            <p className="text-[#71717A] text-sm max-w-md">Query any data across ERP, CRM, fleet, DTN rack pricing, SharePoint, and more.</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/delta logo mark.png" alt="" className="w-12 h-auto opacity-30 object-contain" />
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {['Top 5 customers by gross profit', 'Price dyed diesel to Plaquemine, LA', 'Show AR aging over 90 days', 'Revenue by month for 2025'].map((q) => (
            <Link key={q} href="/chat" className="text-left px-3 py-2.5 rounded-lg border border-[#27272A] text-xs text-[#A1A1AA] hover:border-[#FE5000]/40 hover:text-white hover:bg-[#27272A]/50 transition-colors">{q}</Link>
          ))}
        </div>
        <Link href="/chat" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#FE5000] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#CC4000] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Open Chat
        </Link>
      </div>

      {/* Recent Insights */}
      {insights.recentChats.length > 0 && (
        <DensitySection title="Recent Insights">
          <div className="space-y-2">
            {insights.recentChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chat?id=${chat.id}`}
                className="group flex items-start gap-3 rounded-lg border border-[#27272A] bg-[#18181B] p-4 shadow-sm hover:border-[#FE5000]/30 hover:bg-[#27272A] hover:shadow-md transition-all"
              >
                <div className="w-1 h-12 rounded-full bg-[#FE5000]/30 group-hover:bg-[#FE5000] transition-colors shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{chat.question}</p>
                  <p className="text-xs text-[#A1A1AA] mt-0.5 line-clamp-1">{chat.finding}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-[#A1A1AA] tabular-nums">{timeAgo(chat.updatedAt)}</span>
                    {chat.model && <span className="text-[10px] text-[#A1A1AA]">{chat.model}</span>}
                    {chat.tokenCost > 0 && <span className="text-[10px] text-[#A1A1AA] tabular-nums">{chat.tokenCost.toLocaleString()} tokens</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </DensitySection>
      )}

      {/* Connected Tools */}
      <DensitySection title="Connected Tools">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TOOLS.map((tool) => (
            <a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer" className="group rounded-lg border border-[#27272A] bg-[#18181B] p-4 shadow-sm hover:border-[#FE5000]/40 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-white">{tool.name}</h4>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tool.color }} />
                  <span className="text-[10px] text-[#A1A1AA]">{tool.status}</span>
                </div>
              </div>
              <p className="text-xs text-[#71717A]">{tool.description}</p>
              <span className="mt-2 inline-block text-[10px] text-[#A1A1AA] group-hover:text-[#FE5000] transition-colors font-mono">{tool.url.replace('http://', '').replace('https://', '')}</span>
            </a>
          ))}
        </div>
      </DensitySection>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QA href="/history" label="Chat History" sub="Past conversations" />
        <QA href="/documents" label="Documents" sub="Upload and analyze" />
        <QA href="/sources" label="Data Sources" sub="8 connected" />
        <QA href="/chat" label="Search SharePoint" sub="Files across M365" />
      </div>
    </div>
  );
}

function OperatorView({
  invoices,
  invoicesLoading,
  anomalies,
  insights,
  userRole,
}: {
  invoices: RecentInvoice[];
  invoicesLoading: boolean;
  anomalies: Anomaly[];
  insights: ReturnType<typeof useSessionInsights>;
  userRole: string;
}) {
  const invoiceTableData = invoices.map((inv) => ({
    customer: inv.customer,
    date: fmtDate(inv.date),
    amount: fmt(inv.amount),
  }));

  const activityChartData = [
    { label: 'Mon', value: Math.max(insights.weeklyQueries * 0.1, 1) },
    { label: 'Tue', value: Math.max(insights.weeklyQueries * 0.18, 1) },
    { label: 'Wed', value: Math.max(insights.weeklyQueries * 0.22, 1) },
    { label: 'Thu', value: Math.max(insights.weeklyQueries * 0.2, 1) },
    { label: 'Fri', value: Math.max(insights.weeklyQueries * 0.15, 1) },
    { label: 'Sat', value: Math.max(insights.weeklyQueries * 0.08, 1) },
    { label: 'Sun', value: Math.max(insights.weeklyQueries * 0.07, 1) },
  ];

  return (
    <div className="space-y-0">
      {/* Dense KPI strip */}
      <DensitySection title="Metrics">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0,
            borderBottom: '1px solid #27272a',
          }}
        >
          <DensityKPI label="Queries / Week" value={String(insights.weeklyQueries)} />
          <DensityKPI label="Top Topic" value={insights.topTopics[0]?.topic ?? '--'} />
          <DensityKPI label="Sources" value="8" delta="+0" deltaDirection="neutral" />
          <DensityKPI label="Tools" value={String(TOOLS.length)} delta="OK" deltaDirection="up" />
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px' }}>
            <DensityInsight text="8 sources active. AR aging and GP are top query categories. Review cash flow summary for recent changes." />
          </div>
        </div>
      </DensitySection>

      {/* Sparkline */}
      <DensitySection title="Activity">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <DensityChart type="area" data={activityChartData} />
          </div>
          <span style={{ fontSize: '10px', color: '#71717a', whiteSpace: 'nowrap' }}>7d queries</span>
        </div>
      </DensitySection>

      {/* Anomalies inline */}
      {anomalies.length > 0 && (
        <DensitySection title={`Anomalies (${anomalies.length})`}>
          <div>
            {anomalies.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  borderBottom: '1px solid #1a1a1e',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              >
                <span
                  style={{
                    color: a.severity === 'critical' ? '#ef4444' : a.severity === 'warning' ? '#f97316' : '#3b82f6',
                    fontWeight: 700,
                    minWidth: '50px',
                    textTransform: 'uppercase',
                    fontSize: '9px',
                  }}
                >
                  {a.severity}
                </span>
                <span style={{ color: '#e4e4e7', fontWeight: 600 }}>{a.metric}</span>
                <span style={{ color: '#71717a' }}>{a.description}</span>
              </div>
            ))}
          </div>
        </DensitySection>
      )}

      {/* Live widgets */}
      <DensitySection title="Live Data">
        <LiveWidgetGrid widgets={getWidgetsForRole(userRole)} role={userRole} columns={4} />
      </DensitySection>

      {/* Invoice table — full columns in operator mode */}
      <DensitySection title="Recent Invoices">
        {invoicesLoading ? (
          <div style={{ padding: '8px', fontSize: '11px', color: '#71717a' }}>Loading...</div>
        ) : invoiceTableData.length > 0 ? (
          <DensityTable
            columns={[
              { key: 'customer', label: 'Customer' },
              { key: 'date', label: 'Date' },
              { key: 'amount', label: 'Amount', align: 'right' },
            ]}
            data={invoiceTableData}
          />
        ) : (
          <div style={{ padding: '8px', fontSize: '11px', color: '#71717a' }}>No recent invoices.</div>
        )}
      </DensitySection>

      {/* Recent chat queries — dense list */}
      {insights.recentChats.length > 0 && (
        <DensitySection title="Recent Queries">
          <div>
            {insights.recentChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chat?id=${chat.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  borderBottom: '1px solid #1a1a1e',
                  textDecoration: 'none',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              >
                <span style={{ color: '#71717a', minWidth: '60px', fontSize: '9px' }}>{timeAgo(chat.updatedAt)}</span>
                <span style={{ color: '#e4e4e7', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.question}</span>
                {chat.tokenCost > 0 && (
                  <span style={{ color: '#52525b', fontSize: '9px' }}>{chat.tokenCost.toLocaleString()}t</span>
                )}
              </Link>
            ))}
          </div>
        </DensitySection>
      )}

      {/* Quick nav inline controls */}
      <DensitySection title="Quick Nav">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '4px 0' }}>
          {[
            { href: '/history', label: 'History' },
            { href: '/documents', label: 'Documents' },
            { href: '/sources', label: 'Sources' },
            { href: '/chat', label: 'Chat' },
            { href: '/financial-statements', label: 'Fin Stmts' },
            { href: '/journal-entries', label: 'JE' },
            { href: '/cash-flow', label: 'Cash Flow' },
            { href: '/ar/collections', label: 'AR' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '2px 8px',
                fontSize: '10px',
                fontFamily: 'monospace',
                color: '#a1a1aa',
                border: '1px solid #3f3f46',
                borderRadius: '3px',
                textDecoration: 'none',
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </DensitySection>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function FinancePage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? 'admin';
  const [invoices, setInvoices] = useState<RecentInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const insights = useSessionInsights();
  const density = useDensity();

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then((data: DashboardResponse) => {
        if (data.success) {
          setInvoices(data.recentInvoices ?? []);
        }
      })
      .catch(() => { /* silent — invoices are supplementary */ })
      .finally(() => setInvoicesLoading(false));

    fetch('/api/anomalies')
      .then(r => r.json())
      .then((data: { success: boolean; anomalies?: Anomaly[] }) => {
        if (data.success && data.anomalies) {
          setAnomalies(data.anomalies);
        }
      })
      .catch(() => { /* silent — anomalies are supplementary */ });
  }, []);

  // Onboarding check
  const [onboardingDone, setOnboardingDone] = useState(true);
  const [onboardingProgress, setOnboardingProgress] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `di_onboarding_complete_${userRole}`;
    const done = localStorage.getItem(key) === 'true';
    setOnboardingDone(done);

    if (!done) {
      let steps = 0;
      if (localStorage.getItem('di_conversations')) steps++;
      if (localStorage.getItem('di_onboarding_sources')) steps++;
      if (localStorage.getItem('di_onboarding_profile')) steps++;
      setOnboardingProgress(Math.round((steps / 4) * 100));
    }
  }, [userRole]);

  return (
    <div className="px-5 py-4 overflow-y-auto h-full bg-white dark:bg-[#09090B]">
      <WelcomeModal />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#09090B] dark:text-white">Command Center</h2>
          <p className="mt-0.5 text-sm text-[#71717A] dark:text-[#A1A1AA]">Live data across 8 connected sources</p>
        </div>
        <span className="inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold bg-[#09090B] text-[#FE5000] border border-[#27272A] uppercase tracking-wide">{userRole}</span>
      </div>

      <AIInsightsBanner module="dashboard" compact />

      <div className="mt-4">
        {density === 'executive' ? (
          <ExecutiveView
            invoices={invoices}
            invoicesLoading={invoicesLoading}
            anomalies={anomalies}
            insights={insights}
            userRole={userRole}
            onboardingDone={onboardingDone}
            onboardingProgress={onboardingProgress}
          />
        ) : (
          <OperatorView
            invoices={invoices}
            invoicesLoading={invoicesLoading}
            anomalies={anomalies}
            insights={insights}
            userRole={userRole}
          />
        )}
      </div>
    </div>
  );
}

function QA({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link href={href} className="group rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 shadow-sm hover:border-[#FE5000]/30 dark:hover:border-[#FE5000]/30 hover:shadow-md transition-all">
      <p className="text-sm font-medium text-[#09090B] dark:text-white">{label}</p>
      <p className="text-[10px] text-[#A1A1AA]">{sub}</p>
    </Link>
  );
}
