'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Shield,
  Zap,
  AlertTriangle,
  Link2,
  MessageSquare,
  ChevronDown,
  User,
  Check,
  X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

interface TopArchetype {
  id: string;
  name: string;
  weight: number;
}

interface EnrichedProfile {
  email: string;
  name: string;
  topArchetypes: TopArchetype[];
  operatingSignature: string | null;
  confidenceOverall: number | null;
  hybridClassification: string | null;
  mbti: string | null;
  disc: string | null;
  bestRoles: string[];
}

interface ArchetypeDistEntry {
  id: string;
  name: string;
  count: number;
  averageWeight: number;
}

interface ComplementaryPair {
  memberA: string;
  memberB: string;
  archetypeA: { id: string; name: string };
  archetypeB: { id: string; name: string };
}

interface TeamComposition {
  members: EnrichedProfile[];
  archetypeDistribution: ArchetypeDistEntry[];
  gaps: ArchetypeDistEntry[];
  strengths: ArchetypeDistEntry[];
  complementaryPairs: ComplementaryPair[];
  riskFactors: string[];
}

interface HeatmapCell {
  department: string;
  archetypeId: string;
  archetypeName: string;
  averageWeight: number;
  count: number;
}

interface OrgData {
  profiles: EnrichedProfile[];
  heatmap: {
    departments: string[];
    archetypes: { id: string; name: string }[];
    cells: HeatmapCell[];
  };
  assessedCount: number;
}

// ── Helpers ───────────────────────────────────────────────────

function fmtPct(val: number | null | undefined): string {
  if (val === null || val === undefined || typeof val !== 'number') return '0';
  return val.toFixed(1);
}

function barColor(avgWeight: number): string {
  if (avgWeight > 12) return 'bg-[#FE5000]';
  if (avgWeight >= 5) return 'bg-zinc-500';
  return 'bg-red-500';
}

function badgeColor(avgWeight: number): string {
  if (avgWeight > 12) return 'text-[#FE5000] border-[#FE5000]/30 bg-[#FE5000]/10';
  if (avgWeight >= 5) return 'text-zinc-400 border-zinc-600 bg-zinc-800';
  return 'text-red-400 border-red-500/30 bg-red-500/10';
}

// ── Profile Card ─────────────────────────────────────────────

function ProfileCard({
  profile,
  selected,
  onToggle,
}: {
  profile: EnrichedProfile;
  selected: boolean;
  onToggle: (email: string) => void;
}) {
  const topArch = (profile.topArchetypes ?? [])[0];
  const confidence = profile.confidenceOverall;

  return (
    <div
      onClick={() => onToggle(profile.email)}
      className={`bg-[#18181B] border rounded-lg p-3 cursor-pointer transition-colors ${
        selected
          ? 'border-[#FE5000]/50 bg-[#FE5000]/5'
          : 'border-[#27272A] hover:border-[#3F3F46]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#27272A] flex items-center justify-center shrink-0">
            <User size={14} className="text-[#A1A1AA]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {profile.name}
            </div>
            <div className="text-[10px] text-[#52525B] truncate">
              {profile.email}
            </div>
          </div>
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-[#FE5000] flex items-center justify-center shrink-0">
            <Check size={10} className="text-white" />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {topArch && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#FE5000]/30 bg-[#FE5000]/10 text-[#FE5000]">
            {topArch.name}
          </span>
        )}
        {profile.mbti && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-600 bg-zinc-800 text-zinc-400 font-mono">
            {profile.mbti}
          </span>
        )}
      </div>

      {typeof confidence === 'number' && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-[#52525B]">
            <span>Confidence</span>
            <span className="font-mono">{fmtPct(confidence)}%</span>
          </div>
          <div className="h-1 bg-[#27272A] rounded-full mt-0.5 overflow-hidden">
            <div
              className="h-full bg-[#FE5000] rounded-full transition-all"
              style={{ width: `${Math.min(confidence, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Archetype Bar Chart ──────────────────────────────────────

function ArchetypeBarChart({
  distribution,
}: {
  distribution: ArchetypeDistEntry[];
}) {
  const maxWeight = Math.max(
    ...(distribution ?? []).map((d) => d.averageWeight),
    1,
  );

  return (
    <div className="space-y-1.5">
      {(distribution ?? []).map((entry) => (
        <div key={entry.id} className="flex items-center gap-2">
          <div className="w-44 text-[10px] text-zinc-400 truncate text-right shrink-0">
            {entry.name}
          </div>
          <div className="flex-1 h-4 bg-[#27272A] rounded overflow-hidden relative">
            <div
              className={`h-full rounded transition-all ${barColor(entry.averageWeight)}`}
              style={{
                width: `${(entry.averageWeight / maxWeight) * 100}%`,
              }}
            />
          </div>
          <div className="w-12 text-[10px] font-mono text-zinc-500 text-right shrink-0">
            {fmtPct(entry.averageWeight)}%
          </div>
          {entry.averageWeight < 5 && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30">
              Gap
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Team Analysis Results ────────────────────────────────────

function TeamAnalysisResults({
  composition,
  onAskNova,
}: {
  composition: TeamComposition;
  onAskNova: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Mini bar chart */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
        <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide mb-3">
          Team Archetype Profile
        </h4>
        <ArchetypeBarChart distribution={composition.archetypeDistribution ?? []} />
      </div>

      {/* Strengths + Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
          <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Zap size={12} />
            Strengths
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {(composition.strengths ?? []).length === 0 && (
              <span className="text-[10px] text-zinc-600">
                No strong archetypes detected
              </span>
            )}
            {(composition.strengths ?? []).map((s) => (
              <span
                key={s.id}
                className="text-[10px] px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              >
                {s.name} ({fmtPct(s.averageWeight)}%)
              </span>
            ))}
          </div>
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertCircle size={12} />
            Gaps
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {(composition.gaps ?? []).length === 0 && (
              <span className="text-[10px] text-zinc-600">
                No critical gaps
              </span>
            )}
            {(composition.gaps ?? []).map((g) => (
              <span
                key={g.id}
                className="text-[10px] px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-400"
              >
                {g.name} — {g.averageWeight < 1 ? 'Missing' : 'Weak'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      {(composition.riskFactors ?? []).length > 0 && (
        <div className="bg-[#18181B] border border-amber-500/20 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Risk Factors
          </h4>
          <ul className="space-y-1">
            {(composition.riskFactors ?? []).map((risk, i) => (
              <li
                key={i}
                className="text-[11px] text-amber-300/80 flex items-start gap-2"
              >
                <AlertTriangle
                  size={10}
                  className="mt-0.5 shrink-0 text-amber-500"
                />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Complementary Pairs */}
      {(composition.complementaryPairs ?? []).length > 0 && (
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
          <h4 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Link2 size={12} />
            Complementary Pairs
          </h4>
          <div className="space-y-1.5">
            {(composition.complementaryPairs ?? []).slice(0, 10).map((pair, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-[11px] text-zinc-400"
              >
                <span className="text-white font-medium">{pair.memberA}</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-[#27272A] text-zinc-500">
                  {pair.archetypeA.name}
                </span>
                <span className="text-zinc-600">+</span>
                <span className="text-white font-medium">{pair.memberB}</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-[#27272A] text-zinc-500">
                  {pair.archetypeB.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ask Nova */}
      <button
        onClick={onAskNova}
        className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#FE5000]/15 border border-[#FE5000]/30 text-[#FE5000] text-xs font-medium hover:bg-[#FE5000]/25 transition-colors"
      >
        <MessageSquare size={14} />
        Ask Nova about this team
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function TeamIntelligencePage() {
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [teamResult, setTeamResult] = useState<TeamComposition | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/team-intelligence');
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load data');
        return;
      }
      setOrgData(json.data as OrgData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const profiles = useMemo(() => orgData?.profiles ?? [], [orgData]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    const heatmap = orgData?.heatmap;
    for (const dept of heatmap?.departments ?? []) {
      depts.add(dept);
    }
    return Array.from(depts).sort();
  }, [orgData]);

  const filteredProfiles = useMemo(() => {
    let result = profiles;
    if (filterDept !== 'All') {
      // Filter by department using heatmap cells
      const deptEmails = new Set<string>();
      for (const cell of orgData?.heatmap?.cells ?? []) {
        if (cell.department === filterDept && cell.count > 0) {
          // We need to match profiles to departments differently
          // For now, show all if we can't filter
        }
      }
      // If we have department-email mapping, use it
      if (deptEmails.size > 0) {
        result = result.filter((p) => deptEmails.has(p.email.toLowerCase()));
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.topArchetypes ?? []).some((a) =>
            a.name.toLowerCase().includes(q),
          ) ||
          (p.mbti ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [profiles, filterDept, searchQuery, orgData]);

  const orgDistribution = useMemo((): ArchetypeDistEntry[] => {
    if (!orgData?.heatmap?.cells) return [];

    const archMap: Record<string, { sum: number; deptCount: number }> = {};
    const departments = orgData.heatmap.departments ?? [];

    for (const cell of orgData.heatmap.cells) {
      if (!archMap[cell.archetypeId]) {
        archMap[cell.archetypeId] = { sum: 0, deptCount: 0 };
      }
      archMap[cell.archetypeId] = {
        sum: archMap[cell.archetypeId].sum + cell.averageWeight,
        deptCount: archMap[cell.archetypeId].deptCount + (cell.count > 0 ? 1 : 0),
      };
    }

    const deptCount = departments.length || 1;
    return (orgData.heatmap.archetypes ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      count: archMap[a.id]?.deptCount ?? 0,
      averageWeight: (archMap[a.id]?.sum ?? 0) / deptCount,
    }));
  }, [orgData]);

  const toggleEmail = useCallback((email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
    setTeamResult(null);
  }, []);

  const analyzeTeam = useCallback(async () => {
    if (selectedEmails.size === 0) return;
    setAnalyzing(true);
    setTeamResult(null);
    try {
      const res = await fetch('/api/team-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          emails: Array.from(selectedEmails),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTeamResult(json.data as TeamComposition);
      } else {
        setError(json.error ?? 'Analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [selectedEmails]);

  const handleAskNova = useCallback(() => {
    const names = Array.from(selectedEmails)
      .map((e) => {
        const p = profiles.find((pr) => pr.email === e);
        return p?.name ?? e;
      })
      .join(', ');

    const prompt = encodeURIComponent(
      `Analyze this team for composition strengths, gaps, and recommendations: ${names}. ` +
        `Consider their Signal Map archetypes and how they complement each other. ` +
        `What roles or archetype profiles should we add to strengthen the team?`,
    );

    window.location.href = `/chat?q=${prompt}`;
  }, [selectedEmails, profiles]);

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090B]">
        <div className="flex items-center gap-3 text-zinc-500">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Loading team intelligence...</span>
        </div>
      </div>
    );
  }

  const totalEmployees = 17; // fallback total from people directory
  const assessedCount = orgData?.assessedCount ?? 0;
  const assessedPct =
    totalEmployees > 0
      ? Math.round((assessedCount / totalEmployees) * 100)
      : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 size={22} className="text-[#FE5000]" />
              Team Intelligence
            </h1>
            <p className="text-sm text-[#71717A] mt-0.5">
              Signal Map profiles, archetype distribution, and team composition
              analysis
            </p>
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

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-3">
            <AlertCircle
              size={14}
              className="text-amber-400 mt-0.5 shrink-0"
            />
            <p className="text-xs text-amber-300">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-amber-500 hover:text-white"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Assessment Progress Banner */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#A1A1AA]">
              {assessedCount} of {totalEmployees} employees assessed
            </span>
            <span className="text-xs font-mono text-zinc-500">
              {assessedPct}%
            </span>
          </div>
          <div className="h-2 bg-[#27272A] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FE5000] rounded-full transition-all"
              style={{ width: `${Math.min(assessedPct, 100)}%` }}
            />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            Section A: Org Signal Map Overview
            ══════════════════════════════════════════════════════════ */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users size={16} className="text-[#FE5000]" />
              Org Signal Map Overview
            </h2>

            {/* Department filter */}
            <div className="relative">
              <button
                onClick={() => setDeptOpen(!deptOpen)}
                className="flex items-center gap-1.5 text-xs text-zinc-400 border border-[#27272A] rounded-md px-3 py-1.5 hover:border-[#3F3F46] transition-colors"
              >
                {filterDept === 'All' ? 'All Departments' : filterDept}
                <ChevronDown size={12} />
              </button>
              {deptOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#18181B] border border-[#27272A] rounded-lg shadow-lg z-10 py-1">
                  <button
                    onClick={() => {
                      setFilterDept('All');
                      setDeptOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      filterDept === 'All'
                        ? 'text-[#FE5000] bg-[#FE5000]/5'
                        : 'text-zinc-400 hover:text-white hover:bg-[#27272A]'
                    }`}
                  >
                    All Departments
                  </button>
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => {
                        setFilterDept(dept);
                        setDeptOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        filterDept === dept
                          ? 'text-[#FE5000] bg-[#FE5000]/5'
                          : 'text-zinc-400 hover:text-white hover:bg-[#27272A]'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-xs mb-3">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, archetype..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#18181B] border border-[#27272A] rounded-md text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-[#FE5000]/50"
            />
          </div>

          {/* Profile Grid */}
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <Users size={24} className="mx-auto mb-2" />
              <p className="text-sm">
                {profiles.length === 0
                  ? 'No assessed profiles found'
                  : 'No profiles match your search'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProfiles.map((profile) => (
                <ProfileCard
                  key={profile.email}
                  profile={profile}
                  selected={selectedEmails.has(profile.email)}
                  onToggle={toggleEmail}
                />
              ))}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════
            Section B: Archetype Distribution
            ══════════════════════════════════════════════════════════ */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-[#FE5000]" />
            Org Archetype Distribution
          </h2>
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            {orgDistribution.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">
                No distribution data available
              </p>
            ) : (
              <ArchetypeBarChart distribution={orgDistribution} />
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            Section C: Team Builder
            ══════════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <Shield size={16} className="text-[#FE5000]" />
            Team Builder
          </h2>
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-zinc-400">
                {selectedEmails.size === 0
                  ? 'Select people above to build a team'
                  : `${selectedEmails.size} member${selectedEmails.size !== 1 ? 's' : ''} selected`}
              </div>
              <div className="flex items-center gap-2">
                {selectedEmails.size > 0 && (
                  <button
                    onClick={() => {
                      setSelectedEmails(new Set());
                      setTeamResult(null);
                    }}
                    className="text-xs text-zinc-500 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={analyzeTeam}
                  disabled={selectedEmails.size === 0 || analyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#FE5000] text-white text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FE5000]/90 transition-colors"
                >
                  {analyzing && (
                    <RefreshCw size={12} className="animate-spin" />
                  )}
                  Analyze Team
                </button>
              </div>
            </div>

            {/* Selected members chips */}
            {selectedEmails.size > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {Array.from(selectedEmails).map((email) => {
                  const p = profiles.find((pr) => pr.email === email);
                  return (
                    <span
                      key={email}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[#FE5000]/30 bg-[#FE5000]/5 text-[#FE5000]"
                    >
                      {p?.name ?? email}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEmail(email);
                        }}
                        className="hover:text-white transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Analysis Results */}
            {teamResult && (
              <TeamAnalysisResults
                composition={teamResult}
                onAskNova={handleAskNova}
              />
            )}

            {!teamResult && selectedEmails.size > 0 && !analyzing && (
              <p className="text-xs text-zinc-600 text-center py-6">
                Click &quot;Analyze Team&quot; to see composition analysis
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
