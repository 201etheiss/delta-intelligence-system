'use client';

import { Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, usePathname } from 'next/navigation';
import ChatInterface from '@/components/chat/ChatInterface';

/**
 * Map pathname segments to Nova module IDs so the full-page chat route
 * can derive moduleContext from the referring page when no explicit
 * ?module= query parameter is provided.
 */
const PATH_TO_MODULE: Record<string, string> = {
  finance: 'finance',
  accounting: 'finance',
  operations: 'operations',
  compliance: 'compliance',
  organization: 'organization',
  hr: 'organization',
  'signal-map': 'signal-map',
  gl: 'gl',
  portal: 'portal',
  'equipment-tracker': 'equipment-tracker',
  erp: 'erp',
  intelligence: 'intelligence',
};

function deriveModuleFromPath(pathname: string): string | undefined {
  const segments = pathname.split('/').filter(Boolean);
  for (const seg of segments) {
    if (PATH_TO_MODULE[seg]) return PATH_TO_MODULE[seg];
  }
  return undefined;
}

function ChatContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isAdmin = session?.user?.role === 'admin' || !session; // fallback to admin in dev

  // Prefer explicit ?module= param, then try to derive from referrer path segments
  const moduleContext = searchParams.get('module') ?? deriveModuleFromPath(pathname) ?? undefined;

  return (
    <div className="h-full">
      <ChatInterface isAdmin={isAdmin} role={session?.user?.role ?? 'admin'} moduleContext={moduleContext} />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-zinc-400">Loading chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}
