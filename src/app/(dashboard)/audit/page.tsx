import { getAuditItems } from '@/lib/db';
import { format, isPast } from 'date-fns';

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime()) || date.getFullYear() < 2000) return '-';
    return format(date, 'MMM dd, yyyy');
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
    const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
    const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
    return dateA - dateB;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] tracking-tight mb-1">Audit Items</h1>
        <p className="text-sm text-[#8CAEC1] mb-3">Track audit findings and remediation efforts</p>
        <div className="w-10 h-[2px] bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF5C00]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Total Audit Items
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{totalItems}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#0C2833]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Pending
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{pendingItems}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8CAEC1]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Completed
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{completedItems}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF8A40]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            In Progress
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{totalItems - pendingItems - completedItems}</p>
        </div>
      </div>

      {/* Audit Items Table */}
      <div className="bg-white rounded-xl border border-[#DDE9EE] shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#DDE9EE]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Title
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Category
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Severity
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8CAEC1] uppercase tracking-[0.06em]">
                  Due Date
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#8CAEC1] text-sm">
                    No audit items found
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => {
                  const hasDueDate = item.due_date && !isNaN(new Date(item.due_date).getTime());
                  const dueDate = hasDueDate ? new Date(item.due_date) : null;
                  const isOverdue = dueDate ? isPast(dueDate) && item.status?.toLowerCase() !== 'completed' : false;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[#F0F4F6] hover:bg-[rgba(140,174,193,0.04)] transition-colors"
                    >
                      <td className="px-5 py-3.5 text-sm font-medium text-[#0C2833]">
                        {item.title}
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        {item.category ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[rgba(255,92,0,0.08)] text-[#FF5C00]">
                            {item.category}
                          </span>
                        ) : (
                          <span className="text-[#8CAEC1]">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[rgba(217,119,6,0.1)] text-[#D97706]">
                          Medium
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                          getStatusBadgeClass(item.status)
                        }`}>
                          {item.status || 'Unknown'}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 text-sm font-medium ${
                        isOverdue ? 'text-[#DC2626]' : 'text-[#0C2833]'
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
