'use client';

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ActivityLog } from '@/lib/db';

interface DashboardMetrics {
  activeUsers: number;
  activeEntities: number;
  activeAccounts: number;
  activeCloseTemplates: number;
  activeJournalTemplates: number;
  activeReconRules: number;
}

interface Category {
  category: string;
  count: number;
}

interface AccountType {
  type: string;
  count: number;
}

interface DashboardContentProps {
  metrics: DashboardMetrics;
  closeCategories: Category[];
  accountTypes: AccountType[];
  activityLog: ActivityLog[];
}

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

export default function DashboardContent({
  metrics,
  closeCategories,
  accountTypes,
  activityLog,
}: DashboardContentProps) {
  const metricCards = [
    {
      label: 'Active Entities',
      value: metrics.activeEntities,
      context: 'Legal entities',
    },
    {
      label: 'Close Templates',
      value: metrics.activeCloseTemplates,
      context: 'Process templates',
    },
    {
      label: 'Chart of Accounts',
      value: metrics.activeAccounts,
      context: 'Active accounts',
    },
    {
      label: 'Journal Templates',
      value: metrics.activeJournalTemplates,
      context: 'Reusable templates',
    },
    {
      label: 'Recon Rules',
      value: metrics.activeReconRules,
      context: 'Active rules',
    },
    {
      label: 'Active Users',
      value: metrics.activeUsers,
      context: 'System users',
    },
  ];

  const formatActivityType = (type: string): string => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-8">
      {/* Metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-6 hover:shadow-sm transition-shadow"
          >
            <div className="text-xs uppercase font-medium text-slate-500 tracking-wider">
              {card.label}
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">
              {card.value.toLocaleString()}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              {card.context}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Close Categories Chart */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-6">
            Close Categories
          </h3>
          {closeCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={closeCategories}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-slate-400">
              <p className="text-sm">No close template data available</p>
            </div>
          )}
        </div>

        {/* Account Distribution Chart */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-6">
            Account Distribution
          </h3>
          {accountTypes.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={accountTypes}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ type, count }) => `${type}: ${count}`}
                >
                  {accountTypes.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-slate-400">
              <p className="text-sm">No account data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-6">
          Recent Activity
        </h3>
        {activityLog.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Entity Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {activityLog.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {formatActivityType(entry.action)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatActivityType(entry.entity_type)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {formatDate(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-slate-400">
            <p className="text-sm">No activity records found</p>
          </div>
        )}
      </div>
    </div>
  );
}
