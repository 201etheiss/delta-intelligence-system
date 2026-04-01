'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Building2,
  Clock,
  Briefcase,
  Search,
  RefreshCw,
  AlertCircle,
  UserPlus,
  UserMinus,
  Shield,
  CalendarDays,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ── Types ────────────────────────────────────────────────────

interface DeptBreakdown {
  department: string;
  count: number;
}

interface EmployeeRow {
  displayName: string;
  mail: string;
  jobTitle: string | null;
  department: string | null;
  employeeType: string | null;
  hireDate: string | null;
  status: string | null;
  manager: string | null;
  phone: string | null;
}

interface NewHireRow {
  displayName: string;
  department: string | null;
  jobTitle: string | null;
  hireDate: string | null;
}

interface TerminationRow {
  displayName: string;
  department: string | null;
  terminationDate: string | null;
}

interface HrSummary {
  totalEmployees: number;
  activeCount: number;
  contractorCount: number;
  fullTimeCount: number;
  newHiresThisMonth: number;
  terminationsThisMonth: number;
  byDepartment: DeptBreakdown[];
  employees: EmployeeRow[];
  newHires: NewHireRow[];
  recentTerminations: TerminationRow[];
}

interface HrKpi {
  label: string;
  value: string | number;
  icon: typeof Users;
  color: string;
  subLabel?: string;
}

// ── Page ─────────────────────────────────────────────────────

export default function HrDashboardPage() {
  const [data, setData] = useState<HrSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'directory' | 'hires' | 'pto' | 'benefits'>('directory');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/summary');
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load HR data');
        return;
      }
      setData(json.data as HrSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load HR data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const departments = data?.byDepartment ?? [];
  const employees = data?.employees ?? [];
  const maxDeptCount = Math.max(...(departments.length > 0 ? departments.map((d) => d.count) : [1]), 1);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.displayName.toLowerCase().includes(q) ||
        (e.department ?? '').toLowerCase().includes(q) ||
        (e.jobTitle ?? '').toLowerCase().includes(q) ||
        (e.mail ?? '').toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const kpis: HrKpi[] = [
    {
      label: 'Total Headcount',
      value: data?.totalEmployees ?? 0,
      icon: Users,
      color: 'text-[#FF5C00]',
      subLabel: `${data?.activeCount ?? 0} active`,
    },
    {
      label: 'Full-Time',
      value: data?.fullTimeCount ?? 0,
      icon: Briefcase,
      color: 'text-blue-400',
    },
    {
      label: 'Contractors',
      value: data?.contractorCount ?? 0,
      icon: Shield,
      color: 'text-purple-400',
    },
    {
      label: 'Departments',
      value: departments.length,
      icon: Building2,
      color: 'text-emerald-400',
    },
    {
      label: 'New Hires (Mo)',
      value: data?.newHiresThisMonth ?? 0,
      icon: UserPlus,
      color: 'text-green-400',
    },
    {
      label: 'Terminations (Mo)',
      value: data?.terminationsThisMonth ?? 0,
      icon: UserMinus,
      color: 'text-red-400',
    },
  ];

  const tabs = [
    { id: 'directory' as const, label: 'Employee Directory' },
    { id: 'hires' as const, label: 'New Hires / Terms' },
    { id: 'pto' as const, label: 'PTO / Time-Off' },
    { id: 'benefits' as const, label: 'Benefits' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-white">HR Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Paylocity + MS365 Integration</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-[#27272A] rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <AIInsightsBanner module="hr" compact />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">
                  {kpi.label}
                </span>
                <Icon size={14} className="text-zinc-600" />
              </div>
              <div className={`text-lg font-bold tabular-nums ${kpi.color}`}>
                {kpi.value}
              </div>
              {kpi.subLabel && (
                <div className="text-[10px] text-zinc-600 mt-0.5">{kpi.subLabel}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-amber-300">{error}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Ensure the Paylocity gateway is running on port 3847.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Main Content Area */}
        <div className="lg:col-span-2 rounded-lg border border-[#27272A] bg-[#18181B]">
          {/* Tabs */}
          <div className="flex border-b border-[#27272A] px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-3 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-[#FF5C00] border-[#FF5C00]'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* Directory Tab */}
            {activeTab === 'directory' && (
              <>
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-xs font-semibold text-white">All Employees</h2>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, dept, title..."
                      className="w-48 pl-8 pr-3 py-1.5 text-xs bg-[#09090B] border border-[#27272A] rounded-md text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF5C00]/50"
                    />
                  </div>
                </div>

                {loading && employees.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-zinc-600">
                    Loading employee data...
                  </div>
                ) : employees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Users size={24} className="text-zinc-700 mb-2" />
                    <p className="text-sm text-zinc-500">No employee data available</p>
                    <p className="text-xs text-zinc-600 mt-0.5">Connect Paylocity gateway for HR data</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#27272A]">
                          <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Name</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Email</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Title</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Dept</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Type</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployees.map((emp, i) => (
                          <tr
                            key={`${emp.displayName}-${i}`}
                            className="border-b border-[#27272A]/50 hover:bg-[#27272A]/30 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-white">{emp.displayName}</td>
                            <td className="py-2.5 px-3 text-zinc-400 text-xs">{emp.mail || '--'}</td>
                            <td className="py-2.5 px-3 text-zinc-400">{emp.jobTitle ?? '--'}</td>
                            <td className="py-2.5 px-3 text-zinc-400">{emp.department ?? '--'}</td>
                            <td className="py-2.5 px-3">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                (emp.employeeType ?? '').toLowerCase() === 'contractor'
                                  ? 'bg-purple-500/15 text-purple-400'
                                  : 'bg-blue-500/15 text-blue-400'
                              }`}>
                                {emp.employeeType ?? 'FT'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                (emp.status ?? '').toLowerCase() === 'terminated'
                                  ? 'bg-red-500/15 text-red-400'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              }`}>
                                {emp.status ?? 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredEmployees.length === 0 && searchQuery && (
                      <div className="text-center py-6 text-xs text-zinc-600">
                        No employees match &quot;{searchQuery}&quot;
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* New Hires / Terminations Tab */}
            {activeTab === 'hires' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                    <UserPlus size={14} className="text-green-400" />
                    New Hires This Month
                  </h3>
                  {(data?.newHires ?? []).length === 0 ? (
                    <p className="text-xs text-zinc-600">No new hires this month</p>
                  ) : (
                    <div className="space-y-2">
                      {(data?.newHires ?? []).map((h, i) => (
                        <div key={`hire-${i}`} className="flex items-center justify-between p-3 rounded-md bg-[#09090B] border border-[#27272A]">
                          <div>
                            <div className="text-sm text-white font-medium">{h.displayName}</div>
                            <div className="text-xs text-zinc-500">{h.jobTitle ?? '--'} | {h.department ?? '--'}</div>
                          </div>
                          <div className="text-xs text-zinc-500 flex items-center gap-1">
                            <CalendarDays size={10} />
                            {h.hireDate ?? '--'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                    <UserMinus size={14} className="text-red-400" />
                    Terminations This Month
                  </h3>
                  {(data?.recentTerminations ?? []).length === 0 ? (
                    <p className="text-xs text-zinc-600">No terminations this month</p>
                  ) : (
                    <div className="space-y-2">
                      {(data?.recentTerminations ?? []).map((t, i) => (
                        <div key={`term-${i}`} className="flex items-center justify-between p-3 rounded-md bg-[#09090B] border border-[#27272A]">
                          <div>
                            <div className="text-sm text-white font-medium">{t.displayName}</div>
                            <div className="text-xs text-zinc-500">{t.department ?? '--'}</div>
                          </div>
                          <div className="text-xs text-zinc-500 flex items-center gap-1">
                            <CalendarDays size={10} />
                            {t.terminationDate ?? '--'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PTO Tab */}
            {activeTab === 'pto' && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Clock size={28} className="text-zinc-700 mb-2" />
                <h3 className="text-sm font-medium text-zinc-400">PTO / Time-Off Summary</h3>
                <p className="text-xs text-zinc-600 mt-0.5 max-w-sm">
                  Requires Paylocity Time & Attendance module integration.
                  Data will populate when the /paylocity/timeoff endpoint is configured.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3 w-full max-w-xs">
                  <div className="rounded-md bg-[#09090B] border border-[#27272A] p-3 text-center">
                    <div className="text-lg font-bold text-zinc-600">--</div>
                    <div className="text-[10px] text-zinc-600 uppercase">On PTO Today</div>
                  </div>
                  <div className="rounded-md bg-[#09090B] border border-[#27272A] p-3 text-center">
                    <div className="text-lg font-bold text-zinc-600">--</div>
                    <div className="text-[10px] text-zinc-600 uppercase">Pending Requests</div>
                  </div>
                  <div className="rounded-md bg-[#09090B] border border-[#27272A] p-3 text-center">
                    <div className="text-lg font-bold text-zinc-600">--</div>
                    <div className="text-[10px] text-zinc-600 uppercase">Avg Balance (hrs)</div>
                  </div>
                </div>
              </div>
            )}

            {/* Benefits Tab */}
            {activeTab === 'benefits' && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Shield size={28} className="text-zinc-700 mb-2" />
                <h3 className="text-sm font-medium text-zinc-400">Benefits Enrollment Status</h3>
                <p className="text-xs text-zinc-600 mt-0.5 max-w-sm">
                  Requires Paylocity Benefits module integration.
                  Data will populate when the /paylocity/benefits endpoint is configured.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3 w-full max-w-xs">
                  <div className="rounded-md bg-[#09090B] border border-[#27272A] p-3 text-center">
                    <div className="text-lg font-bold text-zinc-600">--</div>
                    <div className="text-[10px] text-zinc-600 uppercase">Enrolled</div>
                  </div>
                  <div className="rounded-md bg-[#09090B] border border-[#27272A] p-3 text-center">
                    <div className="text-lg font-bold text-zinc-600">--</div>
                    <div className="text-[10px] text-zinc-600 uppercase">Pending</div>
                  </div>
                  <div className="rounded-md bg-[#09090B] border border-[#27272A] p-3 text-center">
                    <div className="text-lg font-bold text-zinc-600">--</div>
                    <div className="text-[10px] text-zinc-600 uppercase">Waived</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Department Breakdown Sidebar */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
          <h2 className="text-xs font-semibold text-white mb-2.5">Headcount by Department</h2>
          {departments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Building2 size={20} className="text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500">No department data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {departments.map((dept) => {
                const pct = (dept.count / maxDeptCount) * 100;
                return (
                  <div key={dept.department}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-300 truncate mr-2">
                        {dept.department}
                      </span>
                      <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                        {dept.count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#27272A] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FF5C00]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Employee vs Contractor Ratio */}
          <div className="mt-6 pt-4 border-t border-[#27272A]">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
              Workforce Composition
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Full-Time Employees</span>
                <span className="text-xs text-blue-400 font-medium tabular-nums">
                  {data?.fullTimeCount ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Contractors</span>
                <span className="text-xs text-purple-400 font-medium tabular-nums">
                  {data?.contractorCount ?? 0}
                </span>
              </div>
              {(data?.totalEmployees ?? 0) > 0 && (
                <div className="h-2 rounded-full bg-[#27272A] overflow-hidden flex mt-0.5">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${((data?.fullTimeCount ?? 0) / (data?.totalEmployees ?? 1)) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-purple-500"
                    style={{
                      width: `${((data?.contractorCount ?? 0) / (data?.totalEmployees ?? 1)) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
