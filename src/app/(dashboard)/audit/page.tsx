import { getAuditItems } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { format, isPast } from 'date-fns';

function formatDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch {
    return '-';
  }
}

function getStatusColor(status: string): string {
  const statusLower = status?.toLowerCase() || 'unknown';
  switch (statusLower) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'in-progress':
      return 'bg-blue-100 text-blue-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default async function AuditPage() {
  const auditItems = await getAuditItems();

  // Calculate stats
  const totalItems = auditItems.length;
  const statusCounts = auditItems.reduce(
    (acc, item) => {
      const status = item.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort by due date
  const sortedItems = [...auditItems].sort((a, b) => {
    const dateA = new Date(a.due_date || '').getTime();
    const dateB = new Date(b.due_date || '').getTime();
    return dateA - dateB;
  });

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Total Audit Items
          </p>
          <p className="text-3xl font-semibold text-slate-900">{totalItems}</p>
        </div>

        {Object.entries(statusCounts)
          .slice(0, 3)
          .map(([status, count]) => (
            <div key={status} className="bg-white rounded-lg border border-slate-200 p-6">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                {status}
              </p>
              <p className="text-3xl font-semibold text-slate-900">{count}</p>
            </div>
          ))}
      </div>

      {/* Audit Items Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Due Date
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No audit items found
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => {
                  const dueDate = new Date(item.due_date || '');
                  const isOverdue = isPast(dueDate) && item.status?.toLowerCase() !== 'completed';
                  const displayStatus =
                    isOverdue && item.status?.toLowerCase() !== 'overdue' ? 'overdue' : item.status;

                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {item.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {item.category || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                            displayStatus
                          )}`}
                        >
                          {displayStatus || 'Unknown'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`${
                            isOverdue ? 'text-red-600 font-semibold' : 'text-slate-600'
                          }`}
                        >
                          {formatDate(item.due_date)}
                        </span>
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
