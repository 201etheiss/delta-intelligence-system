'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Rocket, CheckCircle2, Circle, ArrowRight } from 'lucide-react';

interface OnboardingStep {
  id: string;
  text: string;
  link: string;
}

interface OnboardingGuide {
  title: string;
  steps: OnboardingStep[];
}

const STORAGE_KEY = 'di_onboarding_completed';

function getCompleted(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function setCompleted(completed: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
}

export default function OnboardingPage() {
  const { data: session } = useSession();
  const [guide, setGuide] = useState<OnboardingGuide | null>(null);
  const [completed, setCompletedState] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCompletedState(getCompleted());

    fetch('/api/onboarding')
      .then(res => res.json())
      .then(data => {
        setGuide(data.guide ?? null);
      })
      .catch(() => {
        console.error('Failed to fetch onboarding guide');
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleStep = (stepId: string) => {
    const next = { ...completed, [stepId]: !completed[stepId] };
    setCompletedState(next);
    setCompleted(next);
  };

  const completedCount = guide
    ? guide.steps.filter(s => completed[s.id]).length
    : 0;
  const totalSteps = guide?.steps.length ?? 0;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090B]">
        <p className="text-sm text-[#52525B]">Loading onboarding...</p>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090B]">
        <p className="text-sm text-[#52525B]">No onboarding guide available.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-white">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Rocket size={24} className="text-[#FE5000]" />
          <h1 className="text-lg font-semibold">{guide.title}</h1>
        </div>
        <p className="text-sm text-[#71717A] dark:text-[#A1A1AA] mb-6">
          Welcome, {session?.user?.name?.split(' ')[0] ?? 'there'}. Complete these steps to get started with Delta Intelligence.
        </p>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#71717A] dark:text-[#A1A1AA]">Progress</span>
            <span className="text-xs text-[#FE5000] font-medium">{completedCount}/{totalSteps} ({progressPct}%)</span>
          </div>
          <div className="h-2 bg-[#27272A] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FE5000] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {guide.steps.map((step, i) => {
            const isDone = !!completed[step.id];
            return (
              <div
                key={step.id}
                className={[
                  'flex items-center gap-3 p-4 rounded-lg border transition-colors',
                  isDone
                    ? 'bg-[#18181B] border-[#27272A] opacity-60'
                    : 'bg-[#18181B] border-[#27272A] hover:border-[#3F3F46]',
                ].join(' ')}
              >
                <button
                  onClick={() => toggleStep(step.id)}
                  className="shrink-0"
                  title={isDone ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isDone ? (
                    <CheckCircle2 size={20} className="text-emerald-400" />
                  ) : (
                    <Circle size={20} className="text-[#3F3F46]" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <span className="text-xs text-[#52525B] font-medium">Step {i + 1}</span>
                  <p className={`text-sm ${isDone ? 'line-through text-[#52525B]' : 'text-[#D4D4D8]'}`}>
                    {step.text}
                  </p>
                </div>

                <Link
                  href={step.link}
                  className="shrink-0 p-1.5 rounded-md text-[#52525B] hover:text-[#FE5000] hover:bg-[#FE5000]/10 transition-colors"
                  title="Go to this page"
                >
                  <ArrowRight size={16} />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Completion */}
        {completedCount === totalSteps && totalSteps > 0 && (
          <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
            <p className="text-xs font-semibold text-emerald-400">All steps complete. You are ready to go.</p>
            <Link href="/chat" className="inline-flex items-center gap-1.5 mt-2 text-sm text-[#FE5000] hover:underline">
              Start chatting <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
