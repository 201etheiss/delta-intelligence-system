import { getSourceSystems } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle } from 'lucide-react';

function getConnectionStatusColor(status: string): { bg: string; icon: React.ComponentType<any>; textColor: string } {
  const statusLower = status?.toLowerCase() || 'disconnected';
  switch (statusLower) {
    case 'connected':
      return {
        bg: 'bg-green-100 text-green-800',
        icon: CheckCircle,
        textColor: 'text-green-800',
      };
    case 'disconnected':
      return {
        bg: 'bg-red-100 text-red-800',
        icon: AlertCircle,
        textColor: 'text-red-800',
      };
    default:
      return {
        bg: 'bg-yellow-100 text-yellow-800',
        icon: AlertCircle,
        textColor: 'text-yellow-800',
      };
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

  // Group by type
  const typeCounts = sourceSystems.reduce(
    (acc, system) => {
      const type = system.system_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort by name
  const sortedSystems = [...sourceSystems].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Total Systems
          </p>
          <p className="text-3xl font-semibold text-slate-900">{totalSystems}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Connected
          </p>
          <p className="text-3xl font-semibold text-green-600">{connectedSystems}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Disconnected
          </p>
          <p className="text-3xl font-semibold text-red-600">{disconnectedSystems}</p>
        </div>

        {Object.entries(typeCounts)
          .slice(0, 1)
          .map(([type, count]) => (
            <div key={type} className="bg-white rounded-lg border border-slate-200 p-6">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                {type}
              </p>
              <p className="text-3xl font-semibold text-slate-900">{count}</p>
            </div>
          ))}
      </div>

      {/* Source Systems Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  System Name
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Connection Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSystems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No source systems found
                  </td>
                </tr>
              ) : (
                sortedSystems.map((system) => {
                  const statusColor = getConnectionStatusColor(system.connection_status);
                  const StatusIcon = statusColor.icon;

                  return (
                    <tr key={system.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {system.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {system.system_type || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-medium ${statusColor.bg}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {system.connection_status || 'Unknown'}
                        </Badge>
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
