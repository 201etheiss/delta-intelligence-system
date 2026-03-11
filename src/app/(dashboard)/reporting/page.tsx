import { getEntities, getAccounts } from '@/lib/db';

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

  // Sort entities by name
  const sortedEntities = [...entities].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] mb-2">Entities</h1>
        <p className="text-sm text-[#8CAEC1] mb-4">Manage legal entities and reporting structures</p>
        <div className="w-12 h-0.5 bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Total Entities
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{totalEntities}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Total Accounts
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{totalAccounts}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Avg. Accounts per Entity
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{avgAccountsPerEntity}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Active Entities
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{entities.filter(e => e.is_active).length}</p>
        </div>
      </div>

      {/* Entities Card Grid */}
      {sortedEntities.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-12 text-center">
          <p className="text-[#8CAEC1] text-sm">No entities found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedEntities.map((entity) => (
            <div
              key={entity.id}
              className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-[#0C2833] mb-1">
                    {entity.name}
                  </h3>
                  {entity.code && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(255,92,0,0.1)] text-[#FF5C00]">
                      {entity.code}
                    </span>
                  )}
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${
                  entity.is_active
                    ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981]'
                    : 'bg-[#B5CFD9] text-[#0C2833]'
                }`}>
                  {entity.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#DDE9EE]">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-1">
                    Entity Type
                  </p>
                  <p className="text-sm text-[#0C2833]">{entity.entity_type || '-'}</p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-1">
                    Currency
                  </p>
                  <p className="text-sm text-[#0C2833] font-mono">{entity.currency || 'USD'}</p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-1">
                    Associated Accounts
                  </p>
                  <p className="text-2xl font-bold text-[#FF5C00]">
                    {accountsByEntity[entity.id] || 0}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
