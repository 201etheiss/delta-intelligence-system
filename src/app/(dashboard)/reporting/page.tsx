import { getEntities, getAccounts } from '@/lib/db';
import { Badge } from '@/components/ui/badge';

export default async function ReportingPage() {
  const [entities, accounts] = await Promise.all([
    getEntities(),
    getAccounts(),
  ]);

  // Count accounts per entity
  const accountsByEntity = accounts.reduce(
    (acc, account) => {
      acc[account.entity_id] = (acc[account.entity_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate stats
  const totalEntities = entities.length;
  const totalAccounts = accounts.length;
  const avgAccountsPerEntity = totalEntities > 0 ? (totalAccounts / totalEntities).toFixed(1) : '0';
  const typeCounts = entities.reduce(
    (acc, entity) => {
      const type = entity.entity_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort entities by name
  const sortedEntities = [...entities].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Total Entities
          </p>
          <p className="text-3xl font-semibold text-slate-900">{totalEntities}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Total Accounts
          </p>
          <p className="text-3xl font-semibold text-slate-900">{totalAccounts}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Avg. Accounts per Entity
          </p>
          <p className="text-3xl font-semibold text-slate-900">{avgAccountsPerEntity}</p>
        </div>

        {Object.entries(typeCounts).slice(0, 2).map(([type, count]) => (
          <div key={type} className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
              {type}
            </p>
            <p className="text-3xl font-semibold text-slate-900">{count}</p>
          </div>
        ))}
      </div>

      {/* Entities Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Entity Name
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Currency
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Account Count
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedEntities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No entities found
                  </td>
                </tr>
              ) : (
                sortedEntities.map((entity) => (
                  <tr key={entity.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {entity.name}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">
                      {entity.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {entity.entity_type || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">
                      {entity.currency || 'USD'}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {accountsByEntity[entity.id] || 0}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={entity.is_active ? 'default' : 'secondary'}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          entity.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {entity.is_active ? 'Active' : 'Inactive'}
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
