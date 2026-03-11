import { getCloseTemplates } from '@/lib/db';
import { Badge } from '@/components/ui/badge';

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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Total Templates
          </p>
          <p className="text-3xl font-semibold text-slate-900">{totalTemplates}</p>
        </div>

        {Object.entries(frequencyCounts).map(([frequency, count]) => (
          <div key={frequency} className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
              {frequency}
            </p>
            <p className="text-3xl font-semibold text-slate-900">{count}</p>
          </div>
        ))}
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Est. Hours
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTemplates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No close templates found
                  </td>
                </tr>
              ) : (
                sortedTemplates.map((template) => (
                  <tr key={template.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {template.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {template.category || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {template.description ? (
                        <span className="line-clamp-1">{template.description}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {template.frequency || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {template.estimated_hours || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={template.is_active ? 'default' : 'secondary'}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          template.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {template.is_active ? 'Active' : 'Inactive'}
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
