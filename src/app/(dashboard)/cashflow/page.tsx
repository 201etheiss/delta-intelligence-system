import { getAccountsByTypeFilter, getEntities } from '@/lib/db';

export default async function CashFlowPage() {
  const [accounts, entities] = await Promise.all([
    getAccountsByTypeFilter('asset'),
    getEntities(),
  ]);

  // Create entity map for lookup
  const entityMap = new Map(entities.map((e) => [e.id, e]));

  // Calculate stats
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.is_active).length;

  // Sort by entity and name
  const sortedAccounts = [...accounts].sort((a, b) => {
    const entityA = entityMap.get(a.entity_id)?.name || 'Unknown';
    const entityB = entityMap.get(b.entity_id)?.name || 'Unknown';
    if (entityA !== entityB) return entityA.localeCompare(entityB);
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] tracking-tight mb-1">Cash & Asset Accounts</h1>
        <p className="text-sm text-[#8CAEC1] mb-3">Manage asset accounts across entities</p>
        <div className="w-10 h-[2px] bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF5C00]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Total Accounts
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{totalAccounts}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#0C2833]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Active Accounts
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{activeAccounts}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8CAEC1]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Inactive Accounts
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{totalAccounts - activeAccounts}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF8A40]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Total Entities
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{entities.length}</p>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#DDE9EE]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Account Number
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Entity
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Normal Balance
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#8CAEC1] text-sm">
                    No asset accounts found
                  </td>
                </tr>
              ) : (
                sortedAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="border-b border-[#F0F4F6] hover:bg-[rgba(140,174,193,0.04)] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm font-mono text-[#0C2833]">
                      {account.account_number}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-[#0C2833]">
                      {account.name}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#0C2833]">
                      {entityMap.get(account.entity_id)?.name || 'Unknown'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#0C2833]">
                      {account.normal_balance || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                        account.is_active
                          ? 'bg-[rgba(22,163,74,0.1)] text-[#16A34A]'
                          : 'bg-[#DDE9EE] text-[#0C2833]'
                      }`}>
                        {account.is_active ? 'Active' : 'Inactive'}
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
