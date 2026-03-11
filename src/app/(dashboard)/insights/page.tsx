import {
  getEntities,
  getAccounts,
  getCloseTemplates,
} from '@/lib/db';
import { Network, Database, FileText } from 'lucide-react';

export default async function InsightsPage() {
  const [entities, accounts, closeTemplates] = await Promise.all([
    getEntities(),
    getAccounts(),
    getCloseTemplates(),
  ]);

  // Calculate stats
  const totalEntities = entities.length;
  const totalAccounts = accounts.length;
  const totalTemplates = closeTemplates.length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] mb-2">System Insights</h1>
        <p className="text-sm text-[#8CAEC1] mb-4">Key metrics and system health overview</p>
        <div className="w-12 h-0.5 bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-2">
                Total Entities
              </p>
              <p className="text-3xl font-bold text-[#0C2833]">{totalEntities}</p>
            </div>
            <Database className="h-8 w-8 text-[#FF5C00] opacity-50" />
          </div>
          <p className="text-xs text-[#8CAEC1]">Legal entities in system</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-2">
                Total Accounts
              </p>
              <p className="text-3xl font-bold text-[#0C2833]">{totalAccounts}</p>
            </div>
            <FileText className="h-8 w-8 text-[#FF5C00] opacity-50" />
          </div>
          <p className="text-xs text-[#8CAEC1]">Chart of accounts</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-2">
                Templates
              </p>
              <p className="text-3xl font-bold text-[#0C2833]">{totalTemplates}</p>
            </div>
            <FileText className="h-8 w-8 text-[#FF5C00] opacity-50" />
          </div>
          <p className="text-xs text-[#8CAEC1]">Close process templates</p>
        </div>
      </div>

      {/* Neo4j Graph Connections Card */}
      <div className="bg-gradient-to-br from-[#0C2833] to-[#122F3D] rounded-xl border border-[#B5CFD9] p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Network className="h-8 w-8 text-[#FF5C00]" />
              <h3 className="text-lg font-bold">Knowledge Graph</h3>
            </div>
            <p className="text-sm text-[#B5CFD9] mb-6 max-w-md">
              Delta Intelligence System leverages Neo4j graph database for real-time relationship mapping and pattern discovery across financial entities.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-[#B5CFD9]">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#B5CFD9] font-semibold mb-2">
              Graph Nodes
            </p>
            <p className="text-4xl font-bold text-[#FF5C00]">276</p>
            <p className="text-xs text-[#B5CFD9] mt-1">Entity connections</p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#B5CFD9] font-semibold mb-2">
              Relationships
            </p>
            <p className="text-4xl font-bold text-[#FF5C00]">212</p>
            <p className="text-xs text-[#B5CFD9] mt-1">Graph edges</p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#B5CFD9] font-semibold mb-2">
              Density
            </p>
            <p className="text-4xl font-bold text-[#FF5C00]">2.8%</p>
            <p className="text-xs text-[#B5CFD9] mt-1">Connection ratio</p>
          </div>
        </div>
      </div>

      {/* Entity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entities List */}
        <div className="bg-white rounded-xl border border-[#DDE9EE] overflow-hidden">
          <div className="border-b border-[#DDE9EE] p-6">
            <h3 className="text-sm font-bold text-[#0C2833]">Active Entities</h3>
          </div>
          <div className="p-6 space-y-3">
            {entities.length === 0 ? (
              <p className="text-sm text-[#8CAEC1]">No entities found</p>
            ) : (
              entities
                .slice(0, 8)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((entity) => {
                  const entityAccounts = accounts.filter((a) => a.entity_id === entity.id).length;
                  return (
                    <div key={entity.id} className="flex items-center justify-between py-2 border-b border-[#DDE9EE] last:border-b-0">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-[#FF5C00]"></div>
                        <div>
                          <p className="text-sm font-medium text-[#0C2833]">{entity.name}</p>
                          <p className="text-xs text-[#8CAEC1]">{entity.code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#0C2833]">
                          {entityAccounts}
                        </p>
                        <p className="text-xs text-[#8CAEC1]">accounts</p>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Account Types Distribution */}
        <div className="bg-white rounded-xl border border-[#DDE9EE] overflow-hidden">
          <div className="border-b border-[#DDE9EE] p-6">
            <h3 className="text-sm font-bold text-[#0C2833]">Account Type Distribution</h3>
          </div>
          <div className="p-6 space-y-4">
            {accounts.length === 0 ? (
              <p className="text-sm text-[#8CAEC1]">No accounts found</p>
            ) : (
              (() => {
                const accountsByType = accounts.reduce(
                  (acc, account) => {
                    const type = account.account_type || 'Unknown';
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>
                );

                return Object.entries(accountsByType)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#0C2833]">{type}</p>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-[#DDE9EE] rounded-full h-2">
                          <div
                            className="bg-[#FF5C00] h-2 rounded-full transition-all"
                            style={{
                              width: `${(count / totalAccounts) * 100}%`,
                            }}
                          ></div>
                        </div>
                        <p className="text-sm font-bold text-[#0C2833] w-6 text-right">{count}</p>
                      </div>
                    </div>
                  ));
              })()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
