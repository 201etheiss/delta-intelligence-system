import { getProjects } from '@/lib/db';
import { format } from 'date-fns';

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
    case 'active':
      return 'bg-[rgba(59,130,246,0.1)] text-[#3B82F6]';
    case 'completed':
      return 'bg-[rgba(16,185,129,0.1)] text-[#10B981]';
    case 'on-hold':
      return 'bg-[rgba(245,158,11,0.1)] text-[#F59E0B]';
    case 'cancelled':
      return 'bg-[rgba(239,68,68,0.1)] text-[#EF4444]';
    default:
      return 'bg-[#B5CFD9] text-[#0C2833]';
  }
}

function getPriorityBadgeClass(priority: string): string {
  const priorityLower = priority?.toLowerCase() || 'medium';
  switch (priorityLower) {
    case 'high':
      return 'bg-[rgba(239,68,68,0.1)] text-[#EF4444]';
    case 'medium':
      return 'bg-[rgba(245,158,11,0.1)] text-[#F59E0B]';
    case 'low':
      return 'bg-[rgba(16,185,129,0.1)] text-[#10B981]';
    default:
      return 'bg-[#B5CFD9] text-[#0C2833]';
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  // Calculate stats
  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status?.toLowerCase() === 'active').length;
  const completedProjects = projects.filter((p) => p.status?.toLowerCase() === 'completed').length;

  // Sort by start date descending
  const sortedProjects = [...projects].sort((a, b) => {
    const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
    const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0C2833] tracking-tight mb-1">Projects</h1>
        <p className="text-sm text-[#8CAEC1] mb-3">Track and manage strategic initiatives</p>
        <div className="w-10 h-[2px] bg-[#FF5C00] rounded-full"></div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF5C00]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Total Projects
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{totalProjects}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#0C2833]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Active Projects
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{activeProjects}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8CAEC1]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            Completed
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{completedProjects}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE9EE] p-5 relative overflow-hidden hover:shadow-card-hover transition-all duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF8A40]"></div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1] mb-3">
            In Progress
          </p>
          <p className="text-3xl font-extrabold text-[#0C2833] tracking-tight">{totalProjects - activeProjects - completedProjects}</p>
        </div>
      </div>

      {/* Projects Card Grid */}
      {sortedProjects.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#DDE9EE] p-12 text-center">
          <p className="text-[#8CAEC1] text-sm">No projects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-[#DDE9EE] p-5 hover:shadow-card-hover transition-all duration-200 flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-sm font-bold text-[#0C2833] flex-1">
                  {project.name}
                </h3>
              </div>

              {project.description && (
                <p className="text-xs text-[#8CAEC1] mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="flex gap-2 mb-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                  getStatusBadgeClass(project.status)
                }`}>
                  {project.status || 'Unknown'}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                  getPriorityBadgeClass(project.priority)
                }`}>
                  {project.priority || 'Medium'}
                </span>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#DDE9EE] mt-auto">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1]">
                    Start Date
                  </p>
                  <p className="text-sm text-[#0C2833]">{formatDate(project.start_date)}</p>
                </div>

                <div className="flex justify-between items-center">
                  <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[#8CAEC1]">
                    Target Date
                  </p>
                  <p className="text-sm text-[#0C2833]">{formatDate(project.target_date)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
