import { getJournalTemplates, getEntities } from '@/lib/db';
import { Badge } from '@/components/ui/badge';

export default async function JournalTemplatesPage() {
  const [templates, entities] = await Promise.all([
    getJournalTemplates(),
    getEntities(),
  ]);

  // Create entity map for lookup
  const entityMap = new Map(entities.map((e) => [e.id, e.name]));

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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Total Templates
          </p>
          <p className="text-3xl font-semibold text-slate-900">{totalTemplates}</p>
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
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTemplates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No journal templates found
                  </td>
                </tr>
              ) : (
                sortedTemplates.map((template) => (
                  <tr key={template.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {template.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {template.template_type || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {template.entity_id ? (
                        entityMap.get(template.entity_id) || 'Unknown Entity'
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {template.frequency || '-'}
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
