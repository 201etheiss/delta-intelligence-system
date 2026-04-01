'use client';

import {
  Radar,
  ExternalLink,
  CheckCircle2,
  ClipboardList,
  FileText,
  BarChart3,
  Activity,
} from 'lucide-react';

const BASE_URL = 'http://localhost:3000';

interface KPICard {
  label: string;
  value: string;
  sub?: string;
}

const KPI_CARDS: KPICard[] = [
  { label: 'Active Sessions', value: '12', sub: 'In progress' },
  { label: 'Completed Assessments', value: '47', sub: 'All time' },
  { label: 'Average OTED Score', value: '72.4', sub: 'Out of 100' },
  { label: 'Profiles Generated', value: '38', sub: 'Narrative reports' },
];

interface QuickLink {
  icon: React.ElementType;
  title: string;
  description: string;
  path: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    icon: Activity,
    title: 'Admin Dashboard',
    description: 'Session management, settings, and system overview',
    path: '/admin',
  },
  {
    icon: ClipboardList,
    title: 'New Assessment',
    description: 'Start a new OTED operator assessment session',
    path: '/assess',
  },
  {
    icon: BarChart3,
    title: 'Results & Profiles',
    description: 'View scored assessments and operator profiles',
    path: '/results',
  },
  {
    icon: FileText,
    title: 'Report Generation',
    description: 'Generate narrative reports from completed assessments',
    path: '/admin',
  },
];

type AssessmentStatus = 'completed' | 'in-progress' | 'pending';

interface Assessment {
  id: number;
  name: string;
  date: string;
  score: number | null;
  status: AssessmentStatus;
}

const RECENT_ASSESSMENTS: Assessment[] = [
  { id: 1, name: 'Jordan Mercer', date: '2026-03-31', score: 78, status: 'completed' },
  { id: 2, name: 'Sam Torres', date: '2026-03-30', score: 65, status: 'completed' },
  { id: 3, name: 'Alex Nguyen', date: '2026-03-29', score: null, status: 'in-progress' },
  { id: 4, name: 'Casey Ruiz', date: '2026-03-28', score: 84, status: 'completed' },
  { id: 5, name: 'Morgan Ellis', date: '2026-03-27', score: null, status: 'pending' },
];

const STATUS_BADGE: Record<AssessmentStatus, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completed', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  'in-progress': { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  pending: { label: 'Pending', color: '#71717A', bg: 'rgba(113,113,122,0.1)' },
};

interface IntegrationStatus {
  label: string;
  detail: string;
  status: 'connected' | 'degraded' | 'offline';
}

const INTEGRATIONS: IntegrationStatus[] = [
  { label: 'Supabase', detail: 'Connected', status: 'connected' },
  { label: 'Claude API', detail: 'Connected (narrative synthesis)', status: 'connected' },
  { label: 'Resend Email', detail: 'Connected', status: 'connected' },
];

const STATUS_COLORS: Record<IntegrationStatus['status'], string> = {
  connected: '#22C55E',
  degraded: '#F59E0B',
  offline: '#EF4444',
};

const ACCENT = '#00D4AA';

export default function SignalMapHubPage() {
  function openApp(path: string = '') {
    window.open(BASE_URL + path, '_blank');
  }

  return (
    <div className="min-h-screen bg-[#0f0f11] text-[#FAFAFA] p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `${ACCENT}1A`, border: `1px solid ${ACCENT}33` }}
          >
            <Radar className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#FAFAFA]">Signal Map — OTED Assessment</h1>
            <p className="text-xs text-[#71717A]">Measures how operators decide, build, and coordinate under pressure</p>
          </div>
        </div>
        <button
          onClick={() => openApp('/admin')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
          style={{ background: ACCENT }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#00b891'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ACCENT; }}
        >
          Open Full App
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPI_CARDS.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-[#18181b] border border-[#27272a] px-5 py-4"
          >
            <p className="text-xs text-[#71717A] mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-[#FAFAFA]">{card.value}</p>
            {card.sub && <p className="text-xs text-[#52525B] mt-1">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-sm font-medium text-[#A1A1AA] mb-3 uppercase tracking-wide">Quick Links</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.title}
                onClick={() => openApp(link.path)}
                className="group text-left rounded-xl bg-[#18181b] border border-[#27272a] p-4 transition-all"
                style={{ ['--hover-border' as string]: `${ACCENT}66` }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}66`;
                  (e.currentTarget as HTMLElement).style.background = '#1a1f1d';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#27272a';
                  (e.currentTarget as HTMLElement).style.background = '#18181b';
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#27272a] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#A1A1AA]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#FAFAFA]">{link.title}</p>
                      <p className="text-xs text-[#71717A] mt-0.5 leading-relaxed">{link.description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[#52525B] whitespace-nowrap mt-0.5">Open →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Recent Assessments + Integration Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Recent Assessments */}
        <div className="lg:col-span-2 rounded-xl bg-[#18181b] border border-[#27272a] p-5">
          <h2 className="text-sm font-medium text-[#A1A1AA] mb-4 uppercase tracking-wide">Recent Assessments</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#52525B] border-b border-[#27272a]">
                  <th className="pb-2 font-medium">Operator</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">OTED Score</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f22]">
                {RECENT_ASSESSMENTS.map((a) => {
                  const badge = STATUS_BADGE[a.status];
                  return (
                    <tr key={a.id} className="text-[#D4D4D8]">
                      <td className="py-3">{a.name}</td>
                      <td className="py-3 text-[#71717A]">{a.date}</td>
                      <td className="py-3 font-mono">
                        {a.score !== null ? (
                          <span style={{ color: ACCENT }}>{a.score}</span>
                        ) : (
                          <span className="text-[#52525B]">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ color: badge.color, background: badge.bg }}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[#3F3F46] italic">
            Placeholder data — live feed from Supabase in next iteration.
          </p>
        </div>

        {/* Integration Status */}
        <div className="rounded-xl bg-[#18181b] border border-[#27272a] p-5">
          <h2 className="text-sm font-medium text-[#A1A1AA] mb-4 uppercase tracking-wide">Integration Status</h2>
          <ul className="space-y-3">
            {INTEGRATIONS.map((item) => (
              <li key={item.label} className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: STATUS_COLORS[item.status] }}
                  />
                  <div>
                    <p className="text-sm text-[#D4D4D8]">{item.label}</p>
                    <p className="text-xs text-[#71717A]">{item.detail}</p>
                  </div>
                </div>
                <span
                  className="text-xs font-medium capitalize whitespace-nowrap"
                  style={{ color: STATUS_COLORS[item.status] }}
                >
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
