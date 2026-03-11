import { getReconRules } from '@/lib/db';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function ReconPage() {
  const rules = await getReconRules();

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
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] mb-2">Reconciliation Rules</h1>
        <p className="text-sm text-[#8CAEC1] mb-4">Configure and manage account matching rules</p>
        <div className="w-12 h-0.5 bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Total Rules
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{totalRules}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Active Rules
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{activeRules}</p>
        </div>

        {Object.entries(typeCounts).slice(0, 2).map(([type, count]) => (
          <div key={type} className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
            <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
              {type}
            </p>
            <p className="text-3xl font-bold text-[#0C2833]">{count}</p>
          </div>
        ))}
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#DDE9EE]">
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Rule Type
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Source System
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Match Field
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Tolerance
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#8CAEC1] text-sm">
                    No reconciliation rules found
                  </td>
                </tr>
              ) : (
                sortedRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-b border-[#DDE9EE] hover:bg-[rgba(140,174,193,0.04)] transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-[#0C2833]">
                      {rule.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {rule.rule_type ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(255,92,0,0.1)] text-[#FF5C00]">
                          {rule.rule_type}
                        </span>
                      ) : (
                        <span className="text-[#8CAEC1]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#0C2833]">
                      {rule.source_system || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#0C2833]">-</td>
                    <td className="px-6 py-4 text-sm text-[#0C2833] font-medium">
                      {formatCurrency(rule.threshold_amount)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${
                        rule.is_active
                          ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981]'
                          : 'bg-[#B5CFD9] text-[#0C2833]'
                      }`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
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
