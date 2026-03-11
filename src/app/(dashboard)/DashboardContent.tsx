'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ActivityLog, Account, CloseTemplate, ReconRule, Entity, SourceSystem, User } from '@/lib/db';
import { Building2, TrendingUp, BarChart3, Zap } from 'lucide-react';

interface DashboardData {
  accounts: Account[];
  closeTemplates: CloseTemplate[];
  reconRules: ReconRule[];
  entities: Entity[];
  activityLog: ActivityLog[];
  sourceSystems: SourceSystem[];
  users: User[];
}

const BRAND_COLORS = {
  orange: '#FF5C00',
  black: '#000000',
  navy: '#0C2833',
  steel: '#8CAEC1',
  white: '#FFFFFF',
  navyLight: '#122F3D',
  steelLight: '#B5CFD9',
  steelPale: '#DDE9EE',
  orangeLight: '#FF8A40',
  orangeDark: '#E04D00',
};

const CHART_COLORS = [
  BRAND_COLORS.orange,
  BRAND_COLORS.navy,
  BRAND_COLORS.steel,
  BRAND_COLORS.navyLight,
  BRAND_COLORS.orangeLight,
  BRAND_COLORS.steelLight,
];

export default function DashboardContent({ data }: { data: DashboardData }) {
  const metricCards = [
    {
      label: 'Total Accounts',
      value: data.accounts.length,
      icon: Building2,
      color: BRAND_COLORS.orange,
      borderColor: 'border-l-4 border-[#FF5C00]',
    },
    {
      label: 'Active Close Templates',
      value: data.closeTemplates.length,
      icon: TrendingUp,
      color: BRAND_COLORS.navy,
      borderColor: 'border-l-4 border-[#0C2833]',
    },
    {
      label: 'Recon Rules',
      value: data.reconRules.length,
      icon: BarChart3,
      color: BRAND_COLORS.steel,
      borderColor: 'border-l-4 border-[#8CAEC1]',
    },
    {
      label: 'Source Systems',
      value: data.sourceSystems.length,
      icon: Zap,
      color: '#10B981',
      borderColor: 'border-l-4 border-[#10B981]',
    },
  ];

  // Prepare close progress data from templates
  const closeProgressData = data.closeTemplates.reduce((acc: Record<string, number>, template) => {
    const category = template.category || 'Other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const closeProgressChartData = Object.entries(closeProgressData).map(([name, value]) => ({
    name,
    value,
  }));

  // Prepare account distribution data
  const accountDistData = data.accounts.reduce((acc: Record<string, number>, account) => {
    const type = account.account_type || 'Other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const accountDistChartData = Object.entries(accountDistData).map(([name, value]) => ({
    name,
    value,
  }));

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

  const getTodayDate = (): string => {
    const date = new Date();
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getCurrentGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Greeting Banner */}
      <div className="bg-gradient-to-r from-[#FFF9F3] to-white border-l-4 border-[#FF5C00] rounded-lg p-6 animate-slide-up">
        <h2 className="text-2xl font-bold text-[#0C2833] mb-2">{getCurrentGreeting()}</h2>
        <p className="text-sm text-[#8CAEC1]">{getTodayDate()}</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`${card.borderColor} rounded-lg bg-white p-6 shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs uppercase font-semibold text-[#8CAEC1] tracking-wider">
                    {card.label}
                  </p>
                  <p className="text-3xl font-bold text-[#0C2833] mt-2">
                    {card.value.toLocaleString()}
                  </p>
                </div>
                <Icon className="w-6 h-6" style={{ color: card.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Close Progress Section */}
      <div className="rounded-lg bg-white border border-[#DDE9EE] p-6 animate-slide-up">
        <h3 className="text-sm font-semibold text-[#0C2833] mb-6">
          Close Progress by Category
        </h3>
        {closeProgressChartData.length > 0 ? (
          <div className="h-16 bg-[#F9FAFB] rounded-lg overflow-hidden">
            <div className="flex h-full">
              {closeProgressChartData.map((item, index) => {
                const total = closeProgressChartData.reduce((sum, d) => sum + d.value, 0);
                const percentage = (item.value / total) * 100;
                return (
                  <div
                    key={item.name}
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                    }}
                    className="transition-all hover:opacity-80"
                    title={`${item.name}: ${item.value}`}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex h-16 items-center justify-center text-[#8CAEC1]">
            <p className="text-sm">No close template data available</p>
          </div>
        )}
        {closeProgressChartData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {closeProgressChartData.map((item, index) => (
              <div key={item.name} className="text-xs">
                <div className="flex items-center mb-1">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="font-medium text-[#0C2833]">{item.name}</span>
                </div>
                <p className="text-[#8CAEC1]">{item.value} items</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
        {/* Account Distribution Donut Chart */}
        <div className="rounded-lg bg-white border border-[#DDE9EE] p-6">
          <h3 className="text-sm font-semibold text-[#0C2833] mb-6">
            Account Distribution
          </h3>
          {accountDistChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={accountDistChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={true}
                >
                  {accountDistChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: `1px solid ${BRAND_COLORS.steelPale}`,
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${value} accounts`, 'Count']}
                  labelStyle={{ color: BRAND_COLORS.navy }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-[#8CAEC1]">
              <p className="text-sm">No account data available</p>
            </div>
          )}
        </div>

        {/* Entity Overview */}
        <div className="rounded-lg bg-white border border-[#DDE9EE] p-6">
          <h3 className="text-sm font-semibold text-[#0C2833] mb-6">
            Entity Overview
          </h3>
          {data.entities.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {data.entities.map((entity) => (
                <div
                  key={entity.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#F9FAFB] border border-[#DDE9EE]"
                >
                  <div>
                    <p className="font-medium text-[#0C2833] text-sm">{entity.name}</p>
                    <p className="text-xs text-[#8CAEC1]">{entity.code}</p>
                  </div>
                  <span className="text-xs font-semibold text-[#0C2833] bg-[#DDE9EE] px-2 py-1 rounded">
                    {entity.entity_type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-[#8CAEC1]">
              <p className="text-sm">No entities available</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="rounded-lg bg-white border border-[#DDE9EE] p-6 animate-slide-up">
        <h3 className="text-sm font-semibold text-[#0C2833] mb-6">
          Recent Activity
        </h3>
        {data.activityLog.length > 0 ? (
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
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.activityLog.slice(0, 10).map((entry) => (
                  <tr key={entry.id} className="border-b border-[#DDE9EE] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-6 py-4 text-[#0C2833]">
                      {formatActivityType(entry.action)}
                    </td>
                    <td className="px-6 py-4 text-[#8CAEC1]">
                      {formatActivityType(entry.entity_type)}
                    </td>
                    <td className="px-6 py-4 text-[#8CAEC1]">
                      {formatDate(entry.created_at)}
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
