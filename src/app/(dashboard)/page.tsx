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
  { name: 'Sales Scorecard', url: 'http://localhost:3005', description: 'Salesforce pipeline, visit tracking, rep performance', status: 'running', color: '#FF5C00' },
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

// ── Main ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? 'admin';
  const [invoices, setInvoices] = useState<RecentInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const insights = useSessionInsights();

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
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-white dark:bg-[#09090B]">
      <WelcomeModal />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#09090B] dark:text-white">Command Center</h2>
          <p className="mt-0.5 text-sm text-[#71717A] dark:text-[#A1A1AA]">Live data across 8 connected sources</p>
        </div>
        <span className="inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold bg-[#09090B] text-[#FF5C00] border border-[#27272A] uppercase tracking-wide">{userRole}</span>
      </div>

      <AIInsightsBanner module="dashboard" compact />

      {/* Onboarding Banner */}
      {!onboardingDone && (
        <Link
          href="/onboarding"
          className="flex items-center justify-between rounded-lg border border-[#FF5C00]/30 bg-[#FF5C00]/5 px-5 py-4 hover:bg-[#FF5C00]/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FF5C00]/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#FF5C00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              <div
                className="h-full rounded-full bg-[#FF5C00] transition-all"
                style={{ width: `${onboardingProgress}%` }}
              />
            </div>
            <span className="text-xs font-mono text-[#FF5C00]">{onboardingProgress}%</span>
          </div>
        </Link>
      )}

      {/* Live Widgets — role-based, per-widget offline resilience */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide font-medium">Key Metrics</span>
            <HelpTooltip text="Live data from the gateway — each widget refreshes independently" position="right" />
          </div>
          <Link
            href="/dashboards"
            className="inline-flex items-center gap-1 rounded border border-[#3F3F46] px-2.5 py-1 text-[11px] font-medium text-[#A1A1AA] hover:border-[#FF5C00]/60 hover:text-[#FF5C00] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Customize
          </Link>
        </div>
        <LiveWidgetGrid widgets={getWidgetsForRole(userRole)} role={userRole} columns={4} />
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#09090B] dark:text-white uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Anomalies Detected
          </h3>
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
        </div>
      )}

      {/* AI Intelligence Widget */}
      <div>
        <h3 className="text-xs font-semibold text-[#09090B] dark:text-white uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-[#FF5C00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Intelligence
        </h3>
        <IntelligenceWidget page="/" />
      </div>

      {/* Activity Insights (session-local — not gateway-dependent) */}
      <div>
        <h3 className="text-xs font-semibold text-[#09090B] dark:text-white uppercase tracking-wide mb-2">Activity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <ActivityCard
            label="Queries This Week"
            value={String(insights.weeklyQueries)}
            sub="Across all chats"
            color="#3B82F6"
          />
          <ActivityCard
            label="Top Topic"
            value={insights.topTopics[0]?.topic ?? '--'}
            sub={insights.topTopics[0] ? `${insights.topTopics[0].count} queries` : 'No data yet'}
            color="#8B5CF6"
          />
          <ActivityCard
            label="Active Sources"
            value="8"
            sub="All connected"
            color="#22C55E"
          />
        </div>
      </div>

      {/* Chat + Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-gradient-to-br from-[#09090B] to-[#18181B] px-5 py-4 shadow-sm">
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
              <Link key={q} href="/chat" className="text-left px-3 py-2.5 rounded-lg border border-[#27272A] text-xs text-[#A1A1AA] hover:border-[#FF5C00]/40 hover:text-white hover:bg-[#27272A]/50 transition-colors">{q}</Link>
            ))}
          </div>
          <Link href="/chat" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#FF5C00] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#E54800] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Open Chat
          </Link>
        </div>

        <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-3.5 shadow-sm">
          <h3 className="text-xs font-semibold text-[#09090B] dark:text-white uppercase tracking-wide mb-2">Recent Invoices</h3>
          {invoicesLoading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded bg-[#F4F4F5] dark:bg-[#27272A] animate-pulse" />)}</div>
          ) : invoices.length > 0 ? (
            <div className="space-y-1.5">
              {invoices.map((inv) => (
                <div key={inv.id || inv.date} className="flex items-center justify-between py-2 border-b border-[#F4F4F5] dark:border-[#27272A] last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-[#09090B] dark:text-white truncate">{inv.customer}</p>
                    <p className="text-[10px] text-[#A1A1AA]">{fmtDate(inv.date)}</p>
                  </div>
                  <span className="text-sm font-mono font-semibold text-[#09090B] dark:text-white shrink-0 ml-3">{fmt(inv.amount)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[#A1A1AA]">No recent invoices.</p>}
        </div>
      </div>

      {/* Recent Insights */}
      {insights.recentChats.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#09090B] dark:text-white uppercase tracking-wide mb-2">Recent Insights</h3>
          <div className="space-y-2 max-w-4xl">
            {insights.recentChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chat?id=${chat.id}`}
                className="group flex items-start gap-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 shadow-sm hover:border-[#FF5C00]/30 hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] hover:shadow-md transition-all"
              >
                <div className="w-1 h-12 rounded-full bg-[#FF5C00]/30 group-hover:bg-[#FF5C00] transition-colors shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#09090B] dark:text-white truncate">{chat.question}</p>
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-0.5 line-clamp-1">{chat.finding}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-[#A1A1AA] tabular-nums">{timeAgo(chat.updatedAt)}</span>
                    {chat.model && (
                      <span className="text-[10px] text-[#A1A1AA]">{chat.model}</span>
                    )}
                    {chat.tokenCost > 0 && (
                      <span className="text-[10px] text-[#A1A1AA] tabular-nums">{chat.tokenCost.toLocaleString()} tokens</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Connected Tools */}
      <div>
        <h3 className="text-xs font-semibold text-[#09090B] dark:text-white uppercase tracking-wide mb-2">Connected Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TOOLS.map((tool) => (
            <a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer" className="group rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 shadow-sm hover:border-[#FF5C00]/40 dark:hover:border-[#FF5C00]/30 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-[#09090B] dark:text-white">{tool.name}</h4>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tool.color }} />
                  <span className="text-[10px] text-[#A1A1AA]">{tool.status}</span>
                </div>
              </div>
              <p className="text-xs text-[#71717A]">{tool.description}</p>
              <span className="mt-2 inline-block text-[10px] text-[#A1A1AA] group-hover:text-[#FF5C00] transition-colors font-mono">{tool.url.replace('http://', '').replace('https://', '')}</span>
            </a>
          ))}
        </div>
      </div>

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

function ActivityCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 shadow-sm hover:shadow-md hover:border-[#FF5C00]/20 dark:hover:border-[#FF5C00]/30 transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-[10px] font-medium text-[#A1A1AA] uppercase tracking-wide">{label}</p>
      </div>
      <span className="text-lg font-bold text-[#09090B] dark:text-white font-mono">{value}</span>
      <p className="mt-0.5 text-[10px] text-[#A1A1AA]">{sub}</p>
    </div>
  );
}

function QA({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link href={href} className="group rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 shadow-sm hover:border-[#FF5C00]/30 dark:hover:border-[#FF5C00]/30 hover:shadow-md transition-all">
      <p className="text-sm font-medium text-[#09090B] dark:text-white">{label}</p>
      <p className="text-[10px] text-[#A1A1AA]">{sub}</p>
    </Link>
  );
}
