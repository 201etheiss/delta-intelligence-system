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

const CHART_COLORS = ['#FF5C00', '#0C2833', '#8CAEC1', '#FF8A40', '#B5CFD9'];

interface DashboardData {
  totalEntities: number;
  totalAccounts: number;
  closeTemplates: number;
  journalTemplates: number;
  reconRules: number;
  auditItems: number;
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-32 rounded-xl bg-gray-200"></div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-80 rounded-xl bg-gray-200"></div>
      <div className="h-80 rounded-xl bg-gray-200"></div>
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
        const dashboardData = await response.json();
        setData(dashboardData);
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
      <div className="rounded-xl bg-white border border-red-200 p-6 text-center">
        <p className="text-red-600">{error || 'No data available'}</p>
      </div>
    );
  }

  // Transform data for charts
  const accountsChartData = Object.entries(data.accountsByType).map(([name, value]) => ({
    name,
    value,
  }));

  const closeChartData = Object.entries(data.closeByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  const journalsChartData = Object.entries(data.journalsByType).map(([name, value]) => ({
    name,
    value,
  }));

  const frequencyChartData = Object.entries(data.closeByFrequency).map(([name, value]) => ({
    name,
    value,
  }));

  const MetricCard = ({
    title,
    value,
    accentColor,
  }: {
    title: string;
    value: number;
    accentColor: string;
  }) => (
    <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div
        className="absolute left-0 top-0 bottom-0 w-1 transition-all"
        style={{ backgroundColor: accentColor }}
      ></div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-[#8CAEC1]">
        {title}
      </p>
      <p className="text-3xl font-extrabold text-[#0C2833] mt-3">
        {value.toLocaleString()}
      </p>
    </div>
  );

  const ChartCard = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="bg-white rounded-xl border border-[#DDE9EE] p-6">
      <h3 className="text-sm font-bold text-[#0C2833] mb-3">{title}</h3>
      <div className="w-8 h-0.5 bg-[#FF5C00] mb-6"></div>
      {children}
    </div>
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0C2833] text-white rounded px-3 py-2 text-sm">
          <p className="font-semibold">{payload[0].name || payload[0].payload.name}</p>
          <p>{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard title="Total Entities" value={data.totalEntities} accentColor="#FF5C00" />
        <MetricCard title="Total Accounts" value={data.totalAccounts} accentColor="#0C2833" />
        <MetricCard
          title="Close Templates"
          value={data.closeTemplates}
          accentColor="#8CAEC1"
        />
        <MetricCard
          title="Journal Templates"
          value={data.journalTemplates}
          accentColor="#FF8A40"
        />
        <MetricCard title="Recon Rules" value={data.reconRules} accentColor="#B5CFD9" />
        <MetricCard title="Audit Items" value={data.auditItems} accentColor="#DDE9EE" />
      </div>

      {/* Charts Row 1: Accounts by Type & Close Templates by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Accounts by Type">
          {accountsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={accountsChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {accountsChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-[#8CAEC1]">
              <p className="text-sm">No account data available</p>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Close Templates by Category">
          {closeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={closeChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#DDE9EE" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#FF5C00" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-[#8CAEC1]">
              <p className="text-sm">No category data available</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2: Journal Entry Types & Close Template Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Journal Entry Types">
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
                  paddingAngle={2}
                >
                  {journalsChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % 4]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-[#8CAEC1]">
              <p className="text-sm">No journal data available</p>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Close Template Frequency">
          {frequencyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={frequencyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0C2833" />
                    <stop offset="100%" stopColor="#8CAEC1" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#DDE9EE" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-[#8CAEC1]">
              <p className="text-sm">No frequency data available</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] p-6">
        <h3 className="text-sm font-bold text-[#0C2833] mb-3">Recent Activity</h3>
        <div className="w-8 h-0.5 bg-[#FF5C00] mb-6"></div>
        {data.recentActivity && data.recentActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#DDE9EE]">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8CAEC1] uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8CAEC1] uppercase tracking-wider">
                    Entity Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8CAEC1] uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#8CAEC1] uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[#DDE9EE] hover:bg-[#F9FAFB] transition-colors"
                  >
                    <td className="px-6 py-4 text-[#0C2833] font-medium">{entry.action}</td>
                    <td className="px-6 py-4 text-[#8CAEC1]">{entry.entity_type}</td>
                    <td className="px-6 py-4 text-[#0C2833]">{entry.description}</td>
                    <td className="px-6 py-4 text-[#8CAEC1]">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-[#8CAEC1]">
            <p className="text-sm">No activity records found</p>
          </div>
        )}
      </div>
    </div>
  );
}
