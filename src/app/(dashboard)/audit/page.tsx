import { getAuditItems } from '@/lib/db';
import { format, isPast } from 'date-fns';

function formatDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch {
    return '-';
  }
}

function getStatusBadgeClass(status: string): string {
  const statusLower = status?.toLowerCase() || 'unknown';
  switch (statusLower) {
    case 'completed':
      return 'bg-[rgba(16,185,129,0.1)] text-[#10B981]';
    case 'in-progress':
      return 'bg-[rgba(59,130,246,0.1)] text-[#3B82F6]';
    case 'pending':
      return 'bg-[rgba(245,158,11,0.1)] text-[#F59E0B]';
    case 'overdue':
      return 'bg-[rgba(239,68,68,0.1)] text-[#EF4444]';
    default:
      return 'bg-[#B5CFD9] text-[#0C2833]';
  }
}

export default async function AuditPage() {
  const auditItems = await getAuditItems();

  // Calculate stats
  const totalItems = auditItems.length;
  const pendingItems = auditItems.filter((i) => i.status?.toLowerCase() === 'pending').length;
  const completedItems = auditItems.filter((i) => i.status?.toLowerCase() === 'completed').length;

  // Sort by due date
  const sortedItems = [...auditItems].sort((a, b) => {
    const dateA = new Date(a.due_date || '').getTime();
    const dateB = new Date(b.due_date || '').getTime();
    return dateA - dateB;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] mb-2">Audit Items</h1>
        <p className="text-sm text-[#8CAEC1] mb-4">Track audit findings and remediation efforts</p>
        <div className="w-12 h-0.5 bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Total Audit Items
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{totalItems}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Pending
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{pendingItems}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            Completed
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{completedItems}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-6 hover:shadow-card transition-shadow">
          <p className="text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold mb-3">
            In Progress
          </p>
          <p className="text-3xl font-bold text-[#0C2833]">{totalItems - pendingItems - completedItems}</p>
        </div>
      </div>

      {/* Audit Items Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#DDE9EE]">
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Title
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Severity
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-[11px] uppercase tracking-wider text-[#8CAEC1] font-semibold">
                  Due Date
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#8CAEC1] text-sm">
                    No audit items found
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => {
                  const dueDate = new Date(item.due_date || '');
                  const isOverdue = isPast(dueDate) && item.status?.toLowerCase() !== 'completed';

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[#DDE9EE] hover:bg-[rgba(140,174,193,0.04)] transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-[#0C2833]">
                        {item.title}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {item.category ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(255,92,0,0.1)] text-[#FF5C00]">
                            {item.category}
                          </span>
                        ) : (
                          <span className="text-[#8CAEC1]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[rgba(245,158,11,0.1)] text-[#F59E0B]">
                          Medium
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${
                          getStatusBadgeClass(item.status)
                        }`}>
                          {item.status || 'Unknown'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm font-medium ${
                        isOverdue ? 'text-[#EF4444]' : 'text-[#0C2833]'
                      }`}>
                        {formatDate(item.due_date)}
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
