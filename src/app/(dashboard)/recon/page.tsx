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
        <h1 className="text-2xl font-bold text-[#0C2833] tracking-tight mb-1">Reconciliation Rules</h1>
        <p className="text-sm text-[#8CAEC1] mb-3">Configure and manage account matching rules</p>
        <div className="w-10 h-[2px] bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF5C00]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Total Rules
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{totalRules}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#0C2833]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Active Rules
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{activeRules}</p>
        </div>

        {Object.entries(typeCounts).slice(0, 2).map(([type, count], index) => {
          const colors = ['#8CAEC1', '#FF8A40'];
          const color = colors[index % colors.length];
          return (
            <div key={type} className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: color }}></div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
                {type}
              </p>
              <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#DDE9EE]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Rule Type
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Source System
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Match Field
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Tolerance
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#8CAEC1] text-sm">
                    No reconciliation rules found
                  </td>
                </tr>
              ) : (
                sortedRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-b border-[#F0F4F6] hover:bg-[rgba(140,174,193,0.04)] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-[#0C2833]">
                      {rule.name}
                    </td>
                    <td className="px-5 py-3.5 text-sm">
                      {rule.rule_type ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[rgba(255,92,0,0.08)] text-[#FF5C00]">
                          {rule.rule_type}
                        </span>
                      ) : (
                        <span className="text-[#8CAEC1]">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#0C2833]">
                      {rule.source_system || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#0C2833]">-</td>
                    <td className="px-5 py-3.5 text-sm text-[#0C2833] font-medium">
                      {formatCurrency(rule.threshold_amount)}
                    </td>
                    <td className="px-5 py-3.5 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                        rule.is_active
                          ? 'bg-[rgba(22,163,74,0.1)] text-[#16A34A]'
                          : 'bg-[#DDE9EE] text-[#0C2833]'
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
