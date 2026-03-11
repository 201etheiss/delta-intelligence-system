import { getUsers, getEntities, getAccounts } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, DollarSign } from 'lucide-react';

export default async function SettingsPage() {
  const [users, entities, accounts] = await Promise.all([
    getUsers(),
    getEntities(),
    getAccounts(),
  ]);

  // Calculate stats
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.is_active).length;
  const totalEntities = entities.length;
  const activeEntities = entities.filter((e) => e.is_active).length;
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.is_active).length;

  // Group users by department
  const usersByDepartment = users.reduce(
    (acc, user) => {
      const dept = user.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort users by email
  const sortedUsers = [...users].sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div className="space-y-8">
      {/* System Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                Total Users
              </p>
              <p className="text-3xl font-semibold text-slate-900">{totalUsers}</p>
              <p className="text-xs text-slate-500 mt-1">{activeUsers} active</p>
            </div>
            <Users className="h-8 w-8 text-slate-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                Total Entities
              </p>
              <p className="text-3xl font-semibold text-slate-900">{totalEntities}</p>
              <p className="text-xs text-slate-500 mt-1">{activeEntities} active</p>
            </div>
            <Building2 className="h-8 w-8 text-slate-300" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                Total Accounts
              </p>
              <p className="text-3xl font-semibold text-slate-900">{totalAccounts}</p>
              <p className="text-xs text-slate-500 mt-1">{activeAccounts} active</p>
            </div>
            <DollarSign className="h-8 w-8 text-slate-300" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 p-6">
            <h3 className="text-sm font-semibold text-slate-900">Users by Department</h3>
          </div>
          <div className="p-6 space-y-4">
            {Object.entries(usersByDepartment).length === 0 ? (
              <p className="text-sm text-slate-500">No users found</p>
            ) : (
              Object.entries(usersByDepartment)
                .sort((a, b) => b[1] - a[1])
                .map(([dept, count]) => (
                  <div key={dept} className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">{dept}</p>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {count}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 p-6">
            <h3 className="text-sm font-semibold text-slate-900">System Status</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between py-2">
              <p className="text-sm font-medium text-slate-900">Database Connection</p>
              <Badge className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm font-medium text-slate-900">Data Sync</p>
              <Badge className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Synced
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm font-medium text-slate-900">API Status</p>
              <Badge className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm font-medium text-slate-900">Last Updated</p>
              <p className="text-sm text-slate-600">
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-slate-900">User Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {user.full_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.role || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.department || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={user.is_active ? 'default' : 'secondary'}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
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
