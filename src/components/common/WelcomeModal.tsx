'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'di_welcome_seen';

export default function WelcomeModal() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== 'true') {
      setVisible(true);
    }
  }, []);

  // Auto-close after 15 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      handleClose();
    }, 15_000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = useCallback(() => {
    if (dontShow) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setVisible(false);
  }, [dontShow]);

  const handleAction = useCallback((path: string) => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
    router.push(path);
  }, [router]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
        <div className="bg-[#18181B] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with logo */}
          <div className="relative px-8 pt-8 pb-4 text-center">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-[#71717A] hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Delta mark */}
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#FE5000]/10 border border-[#FE5000]/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#FE5000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>

            <h2 className="text-lg font-bold text-white mb-1">
              Welcome to Delta Intelligence
            </h2>
            <p className="text-sm text-[#A1A1AA] max-w-xs mx-auto">
              Your AI-powered business assistant. Ask anything about Delta360 data.
            </p>
          </div>

          {/* Quick action cards */}
          <div className="px-6 pb-2 space-y-2">
            <button
              onClick={() => handleAction('/chat')}
              className="w-full flex items-center gap-4 rounded-xl border border-[#27272A] bg-[#09090B] hover:border-[#FE5000]/40 hover:bg-[#FE5000]/5 px-4 py-3.5 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-[#FE5000]/10 flex items-center justify-center shrink-0 group-hover:bg-[#FE5000]/20 transition-colors">
                <svg className="w-5 h-5 text-[#FE5000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Start Chatting</p>
                <p className="text-xs text-[#71717A]">Ask questions, get answers from your data</p>
              </div>
            </button>

            <button
              onClick={() => handleAction('/digest')}
              className="w-full flex items-center gap-4 rounded-xl border border-[#27272A] bg-[#09090B] hover:border-[#FE5000]/40 hover:bg-[#FE5000]/5 px-4 py-3.5 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">See Your Briefing</p>
                <p className="text-xs text-[#71717A]">Daily summary of key business metrics</p>
              </div>
            </button>

            <button
              onClick={() => handleAction('/workspaces')}
              className="w-full flex items-center gap-4 rounded-xl border border-[#27272A] bg-[#09090B] hover:border-[#FE5000]/40 hover:bg-[#FE5000]/5 px-4 py-3.5 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 group-hover:bg-green-500/20 transition-colors">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Explore Workspaces</p>
                <p className="text-xs text-[#71717A]">Pre-configured assistants for specific domains</p>
              </div>
            </button>
          </div>

          {/* Don't show again + close */}
          <div className="px-6 py-4 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#3F3F46] bg-[#27272A] text-[#FE5000] focus:ring-[#FE5000] focus:ring-offset-0"
              />
              <span className="text-xs text-[#71717A]">Don&apos;t show again</span>
            </label>
            <button
              onClick={handleClose}
              className="text-xs text-[#71717A] hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
