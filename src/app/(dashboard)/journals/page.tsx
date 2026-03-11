import { getJournalTemplates } from '@/lib/db';

export default async function JournalTemplatesPage() {
  const templates = await getJournalTemplates();

  // Calculate stats
  const totalTemplates = templates.length;
  const typeCounts = templates.reduce(
    (acc, template) => {
      const type = template.template_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
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
        <h1 className="text-2xl font-bold text-[#0C2833] tracking-tight mb-1">Journal Templates</h1>
        <p className="text-sm text-[#8CAEC1] mb-3">Manage reusable journal entry templates</p>
        <div className="w-10 h-[2px] bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF5C00]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Total Templates
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{totalTemplates}</p>
        </div>

        {Object.entries(typeCounts).map(([type, count], index) => {
          const colors = ['#0C2833', '#8CAEC1', '#FF8A40', '#B5CFD9', '#122F3D'];
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

      {/* Templates Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#DDE9EE]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Entry Type
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Debit Account
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Credit Account
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Frequency
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTemplates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#8CAEC1] text-sm">
                    No journal templates found
                  </td>
                </tr>
              ) : (
                sortedTemplates.map((template) => (
                  <tr
                    key={template.id}
                    className="border-b border-[#F0F4F6] hover:bg-[rgba(140,174,193,0.04)] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-[#0C2833]">
                      {template.name}
                    </td>
                    <td className="px-5 py-3.5 text-sm">
                      {template.template_type ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[rgba(255,92,0,0.08)] text-[#FF5C00]">
                          {template.template_type}
                        </span>
                      ) : (
                        <span className="text-[#8CAEC1]">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#0C2833]">-</td>
                    <td className="px-5 py-3.5 text-sm text-[#0C2833]">-</td>
                    <td className="px-5 py-3.5 text-sm text-[#0C2833]">
                      {template.frequency || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                        template.is_active
                          ? 'bg-[rgba(22,163,74,0.1)] text-[#16A34A]'
                          : 'bg-[#DDE9EE] text-[#0C2833]'
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
