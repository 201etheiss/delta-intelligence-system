import { getSourceSystems } from '@/lib/db';
import { CheckCircle, AlertCircle } from 'lucide-react';

function getConnectionStatusIcon(status: string): React.ComponentType<any> {
  const statusLower = status?.toLowerCase() || 'disconnected';
  switch (statusLower) {
    case 'connected':
      return CheckCircle;
    default:
      return AlertCircle;
  }
}

function getConnectionStatusBadgeClass(status: string): string {
  const statusLower = status?.toLowerCase() || 'disconnected';
  switch (statusLower) {
    case 'connected':
      return 'bg-[rgba(16,185,129,0.1)] text-[#10B981]';
    case 'disconnected':
      return 'bg-[rgba(239,68,68,0.1)] text-[#EF4444]';
    default:
      return 'bg-[rgba(245,158,11,0.1)] text-[#F59E0B]';
  }
}

export default async function ImportsPage() {
  const sourceSystems = await getSourceSystems();

  // Calculate stats
  const totalSystems = sourceSystems.length;
  const connectedSystems = sourceSystems.filter(
    (s) => s.connection_status?.toLowerCase() === 'connected'
  ).length;
  const disconnectedSystems = totalSystems - connectedSystems;

  // Sort by name
  const sortedSystems = [...sourceSystems].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] mb-2">Source Systems</h1>
        <p className="text-sm text-[#8CAEC1] mb-4">Monitor data integrations and system connections</p>
        <div className="w-12 h-0.5 bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Total Systems
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{totalSystems}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Connected
          </p>
          <p className="text-3xl font-bold text-[#10B981]">{connectedSystems}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Disconnected
          </p>
          <p className="text-3xl font-bold text-[#EF4444]">{disconnectedSystems}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Connection Rate
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">
            {totalSystems > 0 ? Math.round((connectedSystems / totalSystems) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Source Systems Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#DDE9EE]">
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  System Name
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  System Type
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Last Sync
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Records Count
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Connection Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSystems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#8CAEC1] text-sm">
                    No source systems found
                  </td>
                </tr>
              ) : (
                sortedSystems.map((system) => {
                  const StatusIcon = getConnectionStatusIcon(system.connection_status);

                  return (
                    <tr
                      key={system.id}
                      className="border-b border-[#DDE9EE] hover:bg-[rgba(140,174,193,0.04)] transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-[#0C2833]">
                        {system.name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {system.system_type ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(255,92,0,0.1)] text-[#FF5C00]">
                            {system.system_type}
                          </span>
                        ) : (
                          <span className="text-[#8CAEC1]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#0C2833]">-</td>
                      <td className="px-6 py-4 text-sm text-[#0C2833]">-</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold ${
                          getConnectionStatusBadgeClass(system.connection_status)
                        }`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {system.connection_status || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
