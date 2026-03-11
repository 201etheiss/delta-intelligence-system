import { getAccounts, getEntities } from '@/lib/db';
import { Badge } from '@/components/ui/badge';

export default async function CashFlowPage() {
  const [accounts, entities] = await Promise.all([
    getAccounts(),
    getEntities(),
  ]);

  // Create entity map for lookup
  const entityMap = new Map(entities.map((e) => [e.id, e]));

  // Filter cash-related accounts (Asset type typically includes cash)
  const cashAccounts = accounts.filter(
    (a) =>
      a.account_type &&
      ['asset', 'cash', 'liquid', 'current asset'].some((type) =>
        a.account_type.toLowerCase().includes(type)
      )
  );

  // Calculate stats
  const totalCashAccounts = cashAccounts.length;
  const activeCashAccounts = cashAccounts.filter((a) => a.is_active).length;
  const accountTypeCount = cashAccounts.reduce(
    (acc, account) => {
      const type = account.account_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort by entity and name
  const sortedAccounts = [...cashAccounts].sort((a, b) => {
    const entityA = entityMap.get(a.entity_id)?.name || 'Unknown';
    const entityB = entityMap.get(b.entity_id)?.name || 'Unknown';
    if (entityA !== entityB) return entityA.localeCompare(entityB);
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Total Cash Accounts
          </p>
          <p className="text-3xl font-semibold text-slate-900">{totalCashAccounts}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Active Accounts
          </p>
          <p className="text-3xl font-semibold text-slate-900">{activeCashAccounts}</p>
        </div>

        {Object.entries(accountTypeCount).map(([type, count]) => (
          <div key={type} className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
              {type}
            </p>
            <p className="text-3xl font-semibold text-slate-900">{count}</p>
          </div>
        ))}
      </div>

      {/* Cash Accounts Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Account Number
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Account Name
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No cash-related accounts found
                  </td>
                </tr>
              ) : (
                sortedAccounts.map((account) => (
                  <tr key={account.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-900">
                      {account.account_number}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {account.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {account.account_type || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {entityMap.get(account.entity_id)?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {account.normal_balance || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={account.is_active ? 'default' : 'secondary'}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          account.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {account.is_active ? 'Active' : 'Inactive'}
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
