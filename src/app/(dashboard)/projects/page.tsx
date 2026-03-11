import { getProjects } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

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
    case 'active':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'on-hold':
      return 'bg-yellow-100 text-yellow-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function getPriorityColor(priority: string): string {
  const priorityLower = priority?.toLowerCase() || 'medium';
  switch (priorityLower) {
    case 'high':
      return 'bg-red-50 text-red-700 border border-red-200';
    case 'medium':
      return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
    case 'low':
      return 'bg-green-50 text-green-700 border border-green-200';
    default:
      return 'bg-slate-50 text-slate-700 border border-slate-200';
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  // Calculate stats
  const totalProjects = projects.length;
  const statusCounts = projects.reduce(
    (acc, project) => {
      const status = project.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort by start date descending
  const sortedProjects = [...projects].sort((a, b) => {
    const dateA = new Date(a.start_date || '').getTime();
    const dateB = new Date(b.start_date || '').getTime();
    return dateB - dateA;
  });

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
            Total Projects
          </p>
          <p className="text-3xl font-semibold text-slate-900">{totalProjects}</p>
        </div>

        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="bg-white rounded-lg border border-slate-200 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
              {status}
            </p>
            <p className="text-3xl font-semibold text-slate-900">{count}</p>
          </div>
        ))}
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Start Date
                </th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Target Date
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No projects found
                  </td>
                </tr>
              ) : (
                sortedProjects.map((project) => (
                  <tr key={project.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {project.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {project.description ? (
                        <span className="line-clamp-1">{project.description}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                          project.status
                        )}`}
                      >
                        {project.status || 'Unknown'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(project.priority)}`}>
                        {project.priority || 'Medium'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(project.start_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(project.target_date)}
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
