'use client';

import { Suspense } from 'react';
import { useSession } from 'next-auth/react';
import ChatInterface from '@/components/chat/ChatInterface';

function ChatContent() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin' || !session; // fallback to admin in dev
  return (
    <div className="h-full">
      <ChatInterface isAdmin={isAdmin} role={session?.user?.role ?? 'admin'} />
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
