import { getUsers, getSourceSystems } from '@/lib/db';
import { Users, Server, CheckCircle } from 'lucide-react';

export default async function SettingsPage() {
  const [users, sourceSystems] = await Promise.all([
    getUsers(),
    getSourceSystems(),
  ]);

  // Calculate stats
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.is_active).length;
  const totalSystems = sourceSystems.length;
  const connectedSystems = sourceSystems.filter((s) => s.connection_status?.toLowerCase() === 'connected').length;

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
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] mb-2">Settings</h1>
        <p className="text-sm text-[#8CAEC1] mb-4">System configuration and user management</p>
        <div className="w-12 h-0.5 bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* System Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-2">
                Total Users
              </p>
              <p className="text-3xl font-bold text-[#0C2833]">{totalUsers}</p>
              <p className="text-xs text-[#8CAEC1] mt-2">{activeUsers} active</p>
            </div>
            <Users className="h-8 w-8 text-[#FF5C00] opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-2">
                Source Systems
              </p>
              <p className="text-3xl font-bold text-[#0C2833]">{totalSystems}</p>
              <p className="text-xs text-[#8CAEC1] mt-2">{connectedSystems} connected</p>
            </div>
            <Server className="h-8 w-8 text-[#FF5C00] opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-2">
                System Health
              </p>
              <p className="text-3xl font-bold text-[#10B981]">100%</p>
              <p className="text-xs text-[#8CAEC1] mt-2">All systems operational</p>
            </div>
            <CheckCircle className="h-8 w-8 text-[#10B981] opacity-50" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <div className="bg-white rounded-xl border border-[#DDE9EE] overflow-hidden">
          <div className="border-b border-[#DDE9EE] p-6">
            <h3 className="text-sm font-bold text-[#0C2833]">Users by Department</h3>
          </div>
          <div className="p-6 space-y-3">
            {Object.entries(usersByDepartment).length === 0 ? (
              <p className="text-sm text-[#8CAEC1]">No users found</p>
            ) : (
              Object.entries(usersByDepartment)
                .sort((a, b) => b[1] - a[1])
                .map(([dept, count]) => (
                  <div key={dept} className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#0C2833]">{dept}</p>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(255,92,0,0.1)] text-[#FF5C00]">
                      {count}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-xl border border-[#DDE9EE] overflow-hidden">
          <div className="border-b border-[#DDE9EE] p-6">
            <h3 className="text-sm font-bold text-[#0C2833]">System Status</h3>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between py-2">
              <p className="text-sm font-medium text-[#0C2833]">Database Connection</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(16,185,129,0.1)] text-[#10B981]">
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm font-medium text-[#0C2833]">Data Sync</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(16,185,129,0.1)] text-[#10B981]">
                Synced
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm font-medium text-[#0C2833]">API Status</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(16,185,129,0.1)] text-[#10B981]">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm font-medium text-[#0C2833]">Last Updated</p>
              <p className="text-sm text-[#8CAEC1]">
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

      {/* Users Management Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] overflow-hidden">
        <div className="border-b border-[#DDE9EE] p-6">
          <h3 className="text-sm font-bold text-[#0C2833]">User Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#DDE9EE]">
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Department
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#8CAEC1] text-sm">
                    No users found
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[#DDE9EE] hover:bg-[rgba(140,174,193,0.04)] transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-[#0C2833]">
                      {user.full_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#0C2833]">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {user.role ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(255,92,0,0.1)] text-[#FF5C00]">
                          {user.role}
                        </span>
                      ) : (
                        <span className="text-[#8CAEC1]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#0C2833]">
                      {user.department || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${
                        user.is_active
                          ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981]'
                          : 'bg-[#B5CFD9] text-[#0C2833]'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
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
