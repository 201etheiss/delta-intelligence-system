'use client';

import { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = ['#FF5C00', '#0C2833', '#8CAEC1', '#FF8A40', '#B5CFD9', '#122F3D'];

interface DashboardData {
  totalEntities: number;
  totalAccounts: number;
  totalCloseTemplates: number;
  totalJournalTemplates: number;
  totalReconRules: number;
  totalAuditItems: number;
  totalProjects: number;
  totalUsers: number;
  totalSourceSystems: number;
  totalProfitCenters: number;
  totalEstimatedHours: number;
  accountsByType: Record<string, number>;
  closeByCategory: Record<string, number>;
  journalsByType: Record<string, number>;
  closeByFrequency: Record<string, number>;
  recentActivity: Array<{
    id: string;
    action: string;
    entity_type: string;
    description: string;
    created_at: string;
  }>;
}

const LoadingSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl bg-white border border-[#DDE9EE]"></div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="h-80 rounded-xl bg-white border border-[#DDE9EE]"></div>
      <div className="h-80 rounded-xl bg-white border border-[#DDE9EE]"></div>
    </div>
  </div>
);

export default function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/analytics/dashboard');
        if (!response.ok) {
          throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
        }
        const result = await response.json();
        setData(result.data || result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="rounded-xl bg-white border border-red-200 p-8 text-center">
        <p className="text-[#DC2626] font-medium">{error || 'No data available'}</p>
      </div>
    );
  }

  // Transform data for charts (with safe fallbacks)
  const accountsChartData = Object.entries(data.accountsByType || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const closeChartData = Object.entries(data.closeByCategory || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const journalsChartData = Object.entries(data.journalsByType || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const frequencyChartData = Object.entries(data.closeByFrequency || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const metrics = [
    { title: 'Entities', value: data.totalEntities || 0, color: '#FF5C00' },
    { title: 'Accounts', value: data.totalAccounts || 0, color: '#0C2833' },
    { title: 'Close Templates', value: data.totalCloseTemplates || 0, color: '#8CAEC1' },
    { title: 'Journal Templates', value: data.totalJournalTemplates || 0, color: '#FF8A40' },
    { title: 'Recon Rules', value: data.totalReconRules || 0, color: '#B5CFD9' },
    { title: 'Audit Items', value: data.totalAuditItems || 0, color: '#122F3D' },
  ];

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number; payload?: { name?: string } }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0C2833] text-white rounded-lg px-4 py-2.5 text-sm shadow-elevated border border-[#122F3D]">
          <p className="text-[10px] uppercase tracking-wider text-[#8CAEC1] mb-0.5">{payload[0].payload?.name || payload[0].name}</p>
          <p className="font-bold text-base">{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {metrics.map((metric) => (
          <div
            key={metric.title}
            className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200"
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ backgroundColor: metric.color }}
            />
            <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
              {metric.title}
            </p>
            <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">
              {metric.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Accounts by Type & Close Templates by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 shadow-card">
          <h3 className="text-sm font-bold text-[#0C2833] mb-1.5">Accounts by Type</h3>
          <div className="w-8 h-[2px] bg-[#FF5C00] mb-5 rounded-full"></div>
          {accountsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={accountsChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  strokeWidth={2}
                  stroke="#F7F9FB"
                >
                  {accountsChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center">
              <p className="text-sm text-[#8CAEC1]">No account data available</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 shadow-card">
          <h3 className="text-sm font-bold text-[#0C2833] mb-1.5">Close Templates by Category</h3>
          <div className="w-8 h-[2px] bg-[#FF5C00] mb-5 rounded-full"></div>
          {closeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={closeChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#DDE9EE" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#8CAEC1' }} axisLine={{ stroke: '#DDE9EE' }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#0C2833', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#FF5C00" radius={[0, 6, 6, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center">
              <p className="text-sm text-[#8CAEC1]">No category data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2: Journal Entry Types & Close Template Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 shadow-card">
          <h3 className="text-sm font-bold text-[#0C2833] mb-1.5">Journal Entry Types</h3>
          <div className="w-8 h-[2px] bg-[#FF5C00] mb-5 rounded-full"></div>
          {journalsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={journalsChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  paddingAngle={3}
                  strokeWidth={2}
                  stroke="#F7F9FB"
                >
                  {journalsChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center">
              <p className="text-sm text-[#8CAEC1]">No journal data available</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 shadow-card">
          <h3 className="text-sm font-bold text-[#0C2833] mb-1.5">Close Template Frequency</h3>
          <div className="w-8 h-[2px] bg-[#FF5C00] mb-5 rounded-full"></div>
          {frequencyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={frequencyChartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0C2833" />
                    <stop offset="100%" stopColor="#8CAEC1" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#DDE9EE" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#0C2833', fontWeight: 500 }} axisLine={{ stroke: '#DDE9EE' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8CAEC1' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center">
              <p className="text-sm text-[#8CAEC1]">No frequency data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 shadow-card">
        <h3 className="text-sm font-bold text-[#0C2833] mb-1.5">Recent Activity</h3>
        <div className="w-8 h-[2px] bg-[#FF5C00] mb-5 rounded-full"></div>
        {data.recentActivity && data.recentActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#DDE9EE]">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                    Action
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                    Entity Type
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                    Description
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[#F0F4F6] hover:bg-[rgba(140,174,193,0.04)] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[rgba(255,92,0,0.08)] text-[#FF5C00]">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#0C2833] font-medium">{entry.entity_type}</td>
                    <td className="px-5 py-3.5 text-[#0C2833]">{entry.description}</td>
                    <td className="px-5 py-3.5 text-[#8CAEC1] text-xs font-medium">
                      {new Date(entry.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-[160px] items-center justify-center">
            <p className="text-sm text-[#8CAEC1]">No activity records found</p>
          </div>
        )}
      </div>
    </div>
  );
}
