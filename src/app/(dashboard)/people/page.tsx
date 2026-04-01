'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  ChevronDown,
  ChevronRight,
  Building2,
  User,
  Search,
  RefreshCw,
  AlertCircle,
  Mail,
  Phone,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

interface PersonRecord {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  mobilePhone: string | null;
  businessPhones: string[];
  managerId: string | null;
  managerName: string | null;
}

interface PeopleData {
  users: PersonRecord[];
  departments: string[];
  totalCount: number;
}

// ── Fallback static data (used when gateway is offline) ──────

const FALLBACK_PEOPLE: PersonRecord[] = [
  { id: 'adam-vegas', displayName: 'Adam Vegas', mail: 'avegas@delta360.energy', jobTitle: 'President / CEO', department: 'Executive', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: null, managerName: null },
  { id: 'mike-long', displayName: 'Mike Long', mail: 'mlong@delta360.energy', jobTitle: 'Finance Executive', department: 'Finance', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'adam-vegas', managerName: 'Adam Vegas' },
  { id: 'brad-vencil', displayName: 'Brad Vencil', mail: 'bvencil@delta360.energy', jobTitle: 'VP Technology', department: 'Operations', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'adam-vegas', managerName: 'Adam Vegas' },
  { id: 'robert-stewart', displayName: 'Robert Stewart', mail: 'rstewart@delta360.energy', jobTitle: 'VP Sales', department: 'Sales', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'adam-vegas', managerName: 'Adam Vegas' },
  { id: 'sam-taylor', displayName: 'Sam Taylor', mail: 'staylor@delta360.energy', jobTitle: 'VP Oil & Gas', department: 'Oil & Gas', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'adam-vegas', managerName: 'Adam Vegas' },
  { id: 'brian-kooy', displayName: 'Brian Kooy', mail: 'bkooy@delta360.energy', jobTitle: 'General Manager', department: 'Operations', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'adam-vegas', managerName: 'Adam Vegas' },
  { id: 'taylor-veazey', displayName: 'Taylor Veazey', mail: 'tveazey@delta360.energy', jobTitle: 'Corporate Controller', department: 'Finance', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'adam-vegas', managerName: 'Adam Vegas' },
  { id: 'david-carmichael', displayName: 'David Carmichael', mail: 'dcarmichael@delta360.energy', jobTitle: 'Director of Accounting', department: 'Finance', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'taylor-veazey', managerName: 'Taylor Veazey' },
  { id: 'lea-centanni', displayName: 'Lea Centanni', mail: 'lcentanni@delta360.energy', jobTitle: 'Controller', department: 'Finance', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'taylor-veazey', managerName: 'Taylor Veazey' },
  { id: 'bill-didsbury', displayName: 'Bill Didsbury', mail: 'bdidsbury@delta360.energy', jobTitle: 'Tax Manager', department: 'Finance', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'taylor-veazey', managerName: 'Taylor Veazey' },
  { id: 'tony-rubio', displayName: 'Tony Rubio', mail: 'trubio@delta360.energy', jobTitle: 'Operations Manager', department: 'Operations', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'brian-kooy', managerName: 'Brian Kooy' },
  { id: 'kolby-kennedy', displayName: 'Kolby Kennedy', mail: 'kkennedy@delta360.energy', jobTitle: 'Operations Manager', department: 'Operations', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'brian-kooy', managerName: 'Brian Kooy' },
  { id: 'rodney-sims', displayName: 'Rodney Sims', mail: 'rsims@delta360.energy', jobTitle: 'Lubricants Division Manager', department: 'Lubricants', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'sam-taylor', managerName: 'Sam Taylor' },
  { id: 'tim-gallaway', displayName: 'Tim Gallaway', mail: 'tgallaway@delta360.energy', jobTitle: 'Sales', department: 'Sales', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'robert-stewart', managerName: 'Robert Stewart' },
  { id: 'natalie-mcdaniel', displayName: 'Natalie McDaniel', mail: 'nmcdaniel@delta360.energy', jobTitle: 'Sales', department: 'Sales', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'robert-stewart', managerName: 'Robert Stewart' },
  { id: 'sam-ferguson', displayName: 'Sam Ferguson', mail: 'sferguson@delta360.energy', jobTitle: 'Sales', department: 'Sales', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'robert-stewart', managerName: 'Robert Stewart' },
  { id: 'russ-mason', displayName: 'Russ Mason', mail: 'rmason@delta360.energy', jobTitle: 'Sales', department: 'Sales', officeLocation: null, mobilePhone: null, businessPhones: [], managerId: 'robert-stewart', managerName: 'Robert Stewart' },
];

// ── Helpers ───────────────────────────────────────────────────

function getDirectReports(personId: string, people: PersonRecord[]): PersonRecord[] {
  return people.filter((p) => p.managerId === personId);
}

// ── Components ────────────────────────────────────────────────

function PersonCard({ person }: { person: PersonRecord }) {
  const phone = person.mobilePhone ?? (person.businessPhones.length > 0 ? person.businessPhones[0] : null);

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4 hover:border-[#3F3F46] transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[#27272A] flex items-center justify-center shrink-0">
          <User size={18} className="text-[#A1A1AA]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-white truncate">{person.displayName}</div>
          <div className="text-xs text-[#71717A] truncate">{person.jobTitle ?? '--'}</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {person.department && (
          <div className="flex items-center gap-2 text-[11px] text-[#52525B]">
            <Building2 size={11} />
            <span className="truncate">{person.department}</span>
          </div>
        )}
        {person.mail && (
          <div className="flex items-center gap-2 text-[11px] text-[#52525B]">
            <Mail size={11} />
            <span className="truncate">{person.mail}</span>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2 text-[11px] text-[#52525B]">
            <Phone size={11} />
            <span>{phone}</span>
          </div>
        )}
        {person.managerName && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-600">
            <User size={11} />
            <span className="truncate">Reports to {person.managerName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function OrgNode({ person, people, depth = 0 }: { person: PersonRecord; people: PersonRecord[]; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const reports = getDirectReports(person.id, people);

  return (
    <div className={depth > 0 ? 'ml-6 border-l border-[#27272A] pl-4' : ''}>
      <div className="flex items-center gap-2 py-1.5">
        {reports.length > 0 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[#52525B] hover:text-white transition-colors"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-[14px]" />
        )}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[#27272A] flex items-center justify-center shrink-0">
            <User size={12} className="text-[#A1A1AA]" />
          </div>
          <span className="text-sm text-white font-medium truncate">{person.displayName}</span>
          <span className="text-xs text-[#52525B] truncate hidden sm:inline">{person.jobTitle ?? ''}</span>
          {person.department && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FE5000]/10 text-[#FE5000] border border-[#FE5000]/20">
              {person.department}
            </span>
          )}
          {reports.length > 0 && (
            <span className="text-[10px] text-zinc-600">
              ({reports.length})
            </span>
          )}
        </div>
      </div>
      {expanded && reports.length > 0 && (
        <div>
          {reports.map((r) => (
            <OrgNode key={r.id} person={r} people={people} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

type ViewMode = 'org' | 'directory';

export default function PeoplePage() {
  const [view, setView] = useState<ViewMode>('org');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState<PeopleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/people');
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load people data');
        setUseFallback(true);
        return;
      }
      const responseData = json.data as PeopleData;
      if ((responseData.users ?? []).length === 0) {
        setUseFallback(true);
      } else {
        setData(responseData);
        setUseFallback(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load people data');
      setUseFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const people: PersonRecord[] = useMemo(() => {
    if (useFallback) return [...FALLBACK_PEOPLE];
    return data?.users ?? [];
  }, [data, useFallback]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    for (const p of people) {
      if (p.department) depts.add(p.department);
    }
    return Array.from(depts).sort();
  }, [people]);

  const filteredPeople = useMemo(() => {
    let result = people;
    if (filterDept !== 'All') {
      result = result.filter((p) => p.department === filterDept);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          (p.department ?? '').toLowerCase().includes(q) ||
          (p.jobTitle ?? '').toLowerCase().includes(q) ||
          (p.mail ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [people, filterDept, searchQuery]);

  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of people) {
      const dept = p.department ?? 'Unknown';
      counts[dept] = (counts[dept] ?? 0) + 1;
    }
    return counts;
  }, [people]);

  const roots = useMemo(() => {
    return people.filter((p) => !p.managerId);
  }, [people]);

  return (
    <div className="h-full overflow-y-auto bg-[#09090B]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Users size={22} className="text-[#FE5000]" />
              People Directory
            </h1>
            <p className="text-sm text-[#71717A] mt-0.5">
              {people.length} team members across {departments.length} departments
              {useFallback && (
                <span className="ml-2 text-amber-500">(offline mode)</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-[#27272A] rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setView('org')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                view === 'org'
                  ? 'bg-[#FE5000]/15 text-[#FE5000] border border-[#FE5000]/30'
                  : 'bg-[#18181B] text-[#A1A1AA] border border-[#27272A] hover:text-white'
              }`}
            >
              Org Chart
            </button>
            <button
              onClick={() => setView('directory')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                view === 'directory'
                  ? 'bg-[#FE5000]/15 text-[#FE5000] border border-[#FE5000]/30'
                  : 'bg-[#18181B] text-[#A1A1AA] border border-[#27272A] hover:text-white'
              }`}
            >
              Directory
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-3">
            <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300">
              {error} — showing cached org data.
            </p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => {
                setView('directory');
                setFilterDept(filterDept === dept ? 'All' : dept);
              }}
              className={`rounded-lg border p-3 text-left transition-colors ${
                filterDept === dept
                  ? 'bg-[#FE5000]/10 border-[#FE5000]/30'
                  : 'bg-[#18181B] border-[#27272A] hover:border-[#3F3F46]'
              }`}
            >
              <div className="text-[10px] text-[#71717A] font-medium uppercase tracking-wide truncate">
                {dept}
              </div>
              <div className="text-lg font-bold text-white mt-0.5">{deptCounts[dept] ?? 0}</div>
            </button>
          ))}
        </div>

        {/* Search bar (directory view) */}
        {view === 'directory' && (
          <div className="flex items-center gap-3 mb-2.5 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, dept, title, email..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#18181B] border border-[#27272A] rounded-md text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-[#FE5000]/50"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterDept('All')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  filterDept === 'All'
                    ? 'bg-[#FE5000]/15 text-[#FE5000] border border-[#FE5000]/30'
                    : 'bg-[#18181B] text-[#A1A1AA] border border-[#27272A] hover:text-white'
                }`}
              >
                All ({people.length})
              </button>
              {departments.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setFilterDept(dept)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    filterDept === dept
                      ? 'bg-[#FE5000]/15 text-[#FE5000] border border-[#FE5000]/30'
                      : 'bg-[#18181B] text-[#A1A1AA] border border-[#27272A] hover:text-white'
                  }`}
                >
                  {dept} ({deptCounts[dept] ?? 0})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Org Chart View */}
        {view === 'org' && (
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg px-5 py-4">
            <h2 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide mb-2.5">
              Reporting Structure
            </h2>
            {roots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Users size={24} className="text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">No org data available</p>
              </div>
            ) : (
              roots.map((root) => (
                <OrgNode key={root.id} person={root} people={people} />
              ))
            )}
          </div>
        )}

        {/* Directory View */}
        {view === 'directory' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPeople.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
            {filteredPeople.length === 0 && (
              <div className="col-span-full text-center py-12 text-zinc-600">
                <Users size={24} className="mx-auto mb-2" />
                <p className="text-sm">No people match your filters</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
