import {
  getEntities,
  getAccounts,
  getProfitCenters,
  getUsers,
} from '@/lib/db';
import { BarChart3, Users, DollarSign, Target } from 'lucide-react';

export default async function InsightsPage() {
  const [entities, accounts, profitCenters, users] = await Promise.all([
    getEntities(),
    getAccounts(),
    getProfitCenters(),
    getUsers(),
  ]);

  // Calculate stats
  const totalEntities = entities.length;
  const totalAccounts = accounts.length;
  const totalProfitCenters = profitCenters.length;
  const totalUsers = users.length;

  // Group accounts by entity
  const accountsByEntity = accounts.reduce(
    (acc, account) => {
      const entityId = account.entity_id;
      if (!acc[entityId]) {
        acc[entityId] = [];
      }
      acc[entityId].push(account);
      return acc;
    },
    {} as Record<string, typeof accounts>
  );

  // Count users by role
  const usersByRole = users.reduce(
    (acc, user) => {
      const role = user.role || 'Unassigned';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Count accounts by type
  const accountsByType = accounts.reduce(
    (acc, account) => {
      const type = account.account_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                Total Entities
              </p>
              <p className="text-3xl font-semibold text-slate-900">{totalEntities}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-slate-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                Total Accounts
              </p>
              <p className="text-3xl font-semibold text-slate-900">{totalAccounts}</p>
            </div>
            <DollarSign className="h-8 w-8 text-slate-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                Profit Centers
              </p>
              <p className="text-3xl font-semibold text-slate-900">{totalProfitCenters}</p>
            </div>
            <Target className="h-8 w-8 text-slate-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                Total Users
              </p>
              <p className="text-3xl font-semibold text-slate-900">{totalUsers}</p>
            </div>
            <Users className="h-8 w-8 text-slate-300" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entity Summary */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 p-6">
            <h3 className="text-sm font-semibold text-slate-900">Entity Overview</h3>
          </div>
          <div className="p-6 space-y-4">
            {entities.length === 0 ? (
              <p className="text-sm text-slate-500">No entities found</p>
            ) : (
              entities
                .slice(0, 10)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((entity) => (
                  <div key={entity.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{entity.name}</p>
                        <p className="text-xs text-slate-500">{entity.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {accountsByEntity[entity.id]?.length || 0}
                      </p>
                      <p className="text-xs text-slate-500">accounts</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Account Types Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 p-6">
            <h3 className="text-sm font-semibold text-slate-900">Account Types</h3>
          </div>
          <div className="p-6 space-y-4">
            {Object.entries(accountsByType).length === 0 ? (
              <p className="text-sm text-slate-500">No accounts found</p>
            ) : (
              Object.entries(accountsByType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between py-2">
                    <p className="text-sm font-medium text-slate-900">{type}</p>
                    <div className="flex items-center gap-3">
                      <div className="w-20 bg-slate-100 rounded h-2">
                        <div
                          className="bg-blue-500 h-2 rounded"
                          style={{
                            width: `${(count / totalAccounts) * 100}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 w-8 text-right">{count}</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* User Roles Distribution */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-slate-900">Users by Role</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Count
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(usersByRole).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                Object.entries(usersByRole)
                  .sort((a, b) => b[1] - a[1])
                  .map(([role, count]) => (
                    <tr key={role} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{role}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">{count}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {((count / totalUsers) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
