import { getCloseTemplates } from '@/lib/db';

export default async function CloseTrackerPage() {
  const templates = await getCloseTemplates();

  // Calculate stats
  const totalTemplates = templates.length;
  const frequencyCounts = templates.reduce(
    (acc, template) => {
      const freq = template.frequency || 'Unknown';
      acc[freq] = (acc[freq] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort templates by name
  const sortedTemplates = [...templates].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] mb-2">Close Templates</h1>
        <p className="text-sm text-[#8CAEC1] mb-4">Manage financial close process templates</p>
        <div className="w-12 h-0.5 bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Total Templates
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{totalTemplates}</p>
        </div>

        {Object.entries(frequencyCounts).map(([frequency, count]) => (
          <div key={frequency} className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
            <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
              {frequency}
            </p>
            <p className="text-3xl font-bold text-[#0C2833]">{count}</p>
          </div>
        ))}
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#DDE9EE]">
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Frequency
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Est. Hours
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Owner
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTemplates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#8CAEC1] text-sm">
                    No close templates found
                  </td>
                </tr>
              ) : (
                sortedTemplates.map((template) => (
                  <tr
                    key={template.id}
                    className="border-b border-[#DDE9EE] hover:bg-[rgba(140,174,193,0.04)] transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-[#0C2833]">
                      {template.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {template.category ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(255,92,0,0.1)] text-[#FF5C00]">
                          {template.category}
                        </span>
                      ) : (
                        <span className="text-[#8CAEC1]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#0C2833]">
                      {template.frequency || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#0C2833]">
                      {template.estimated_hours || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#0C2833]">
                      {template.owner_id ? (
                        <span className="text-[#0C2833]">Owner</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${
                        template.is_active
                          ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981]'
                          : 'bg-[#B5CFD9] text-[#0C2833]'
                      }`}>
                        {template.is_active ? 'Active' : 'Inactive'}
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
