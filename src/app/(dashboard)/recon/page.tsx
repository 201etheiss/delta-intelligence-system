import { getReconRules, getAccounts } from '@/lib/db';
import { Badge } from '@/components/ui/badge';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function ReconPage() {
  const [rules, accounts] = await Promise.all([
    getReconRules(),
    getAccounts(),
  ]);

  // Create account map for lookup
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // Calculate stats
  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.is_active).length;
  const typeCounts = rules.reduce(
    (acc, rule) => {
      const type = rule.rule_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort rules by name
  const sortedRules = [...rules].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Total Rules
          </p>
          <p className="text-3xl font-semibold text-slate-900">{totalRules}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Active Rules
          </p>
          <p className="text-3xl font-semibold text-slate-900">{activeRules}</p>
        </div>

        {Object.entries(typeCounts).map(([type, count]) => (
          <div key={type} className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
              {type}
            </p>
            <p className="text-3xl font-semibold text-slate-900">{count}</p>
          </div>
        ))}
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Rule Type
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Source System
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Threshold
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No reconciliation rules found
                  </td>
                </tr>
              ) : (
                sortedRules.map((rule) => {
                  const account = rule.account_id ? accountMap.get(rule.account_id) : null;
                  return (
                    <tr key={rule.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {rule.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {account ? (
                          <div>
                            <p className="font-medium text-slate-900">{account.name}</p>
                            <p className="text-xs text-slate-500">{account.account_number}</p>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {rule.rule_type || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {rule.source_system || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                        {formatCurrency(rule.threshold_amount)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={rule.is_active ? 'default' : 'secondary'}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            rule.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {rule.is_active ? 'Active' : 'Inactive'}
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
