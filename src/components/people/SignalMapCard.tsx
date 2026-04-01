'use client';

import { useState, useEffect } from 'react';
import { Activity, ExternalLink } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Archetype {
  readonly id: string;
  readonly weight: number;
}

interface ProfileSummary {
  readonly email: string;
  readonly name: string;
  readonly operatingSignature: string | null;
  readonly topArchetypes: readonly Archetype[];
  readonly confidenceOverall: number | null;
  readonly hybridClassification: string | null;
  readonly mbti: string | null;
  readonly disc: string | null;
  readonly bestRoles: readonly string[];
}

interface SignalMapCardProps {
  email: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SignalMapCard({ email }: SignalMapCardProps) {
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [noAssessment, setNoAssessment] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      setLoading(true);
      setNoAssessment(false);

      try {
        const res = await fetch(
          `/api/signal-map?email=${encodeURIComponent(email)}`,
        );

        if (!res.ok) {
          setNoAssessment(true);
          return;
        }

        const json = await res.json();

        if (cancelled) return;

        if (!json.data) {
          setNoAssessment(true);
          return;
        }

        setProfile(json.data as ProfileSummary);
      } catch {
        if (!cancelled) setNoAssessment(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, [email]);

  // ── Loading skeleton ────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-[#18181B] p-4 space-y-3 animate-pulse">
        <div className="h-4 w-36 bg-zinc-700 rounded" />
        <div className="h-3 w-48 bg-zinc-800 rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-zinc-800 rounded-full" />
          <div className="h-6 w-20 bg-zinc-800 rounded-full" />
          <div className="h-6 w-20 bg-zinc-800 rounded-full" />
        </div>
        <div className="h-2 w-full bg-zinc-800 rounded" />
      </div>
    );
  }

  // ── No assessment ───────────────────────────────────────────
  if (noAssessment || !profile) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-[#18181B] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className="text-zinc-500" />
          <span className="text-xs font-medium text-zinc-400">
            Signal Map Profile
          </span>
        </div>
        <p className="text-xs text-zinc-600">No assessment on file.</p>
      </div>
    );
  }

  // ── Profile card ────────────────────────────────────────────
  const archetypes = profile.topArchetypes ?? [];
  const confidence = profile.confidenceOverall;
  const confidencePct = confidence !== null ? Math.round(confidence * 100) : null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#18181B] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[#FE5000]" />
          <span className="text-xs font-medium text-zinc-400">
            Signal Map Profile
          </span>
        </div>
        <a
          href="/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-[#FE5000] transition-colors"
        >
          View Full Report
          <ExternalLink size={10} />
        </a>
      </div>

      {/* Operating Signature */}
      {profile.operatingSignature && (
        <p className="text-xs italic text-zinc-500 leading-relaxed">
          {profile.operatingSignature}
        </p>
      )}

      {/* Archetype pills */}
      {archetypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {archetypes.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700"
            >
              {a.id}
              <span className="text-zinc-500">
                {Math.round(a.weight * 100)}%
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Confidence bar */}
      {confidencePct !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Confidence</span>
            <span className="text-[10px] text-zinc-400">{confidencePct}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-zinc-800">
            <div
              className="h-1 rounded-full bg-[#FE5000] transition-all"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
        </div>
      )}

      {/* MBTI + DISC badges */}
      {(profile.mbti || profile.disc) && (
        <div className="flex gap-2">
          {profile.mbti && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
              {profile.mbti}
            </span>
          )}
          {profile.disc && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
              DISC: {profile.disc}
            </span>
          )}
        </div>
      )}

      {/* Best-fit roles */}
      {(profile.bestRoles ?? []).length > 0 && (
        <div>
          <span className="text-[10px] text-zinc-500 block mb-0.5">
            Best-fit roles
          </span>
          <p className="text-xs text-zinc-400">
            {(profile.bestRoles ?? []).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
