'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Bot,
  Send,
  Bell,
  BellOff,
  Brain,
  Clock,
  Mail,
  FileText,
  CheckSquare,
  Trash2,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import MessageBubble from '@/components/chat/MessageBubble';

// ── Types ───────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: AssistantAction[];
  timestamp: string;
}

interface AssistantAction {
  type: string;
  description: string;
  params: Record<string, unknown>;
}

interface ReminderData {
  id: string;
  message: string;
  dueAt: string;
  recurring?: string;
  status: 'pending' | 'sent' | 'dismissed';
  createdAt: string;
}

// ── Quick Action Buttons ────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Set a reminder', icon: Bell, prompt: 'Remind me to ' },
  { label: 'Draft an email', icon: Mail, prompt: 'Draft an email to ' },
  { label: 'Schedule a report', icon: FileText, prompt: 'Schedule a recurring report for ' },
  { label: 'Create a task', icon: CheckSquare, prompt: 'Create a task to ' },
];

// ── Main Component ──────────────────────────────────────────

export default function AssistantPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? 'admin';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reminders, setReminders] = useState<ReminderData[]>([]);
  const [learnings, setLearnings] = useState<string[]>([]);
  const [assistantName, setAssistantName] = useState('Delta AI');
  const [sidebarTab, setSidebarTab] = useState<'reminders' | 'learnings'>('reminders');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load reminders + learnings
  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchLearnings = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/learn');
      if (res.ok) {
        const data = await res.json();
        setLearnings(data.learnings ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchReminders();
    fetchLearnings();
  }, [fetchReminders, fetchLearnings]);

  // Send message
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const allMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to get response');
      }

      const data = await res.json();

      if (data.assistantName) {
        setAssistantName(data.assistantName);
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.content,
        actions: data.actions,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Refresh reminders/learnings if actions were taken
      if ((data.actions ?? []).length > 0) {
        fetchReminders();
        fetchLearnings();
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const dismissReminder = async (id: string) => {
    try {
      await fetch('/api/assistant/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'dismissed' }),
      });
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch { /* ignore */ }
  };

  const deleteReminderById = async (id: string) => {
    try {
      await fetch(`/api/assistant/reminders?id=${id}`, { method: 'DELETE' });
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch { /* ignore */ }
  };

  const applyQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full bg-[#09090B]">
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#27272A]">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#FE5000]/10">
            <Bot size={20} className="text-[#FE5000]" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">{assistantName}</h2>
            <p className="text-[#71717A] dark:text-[#A1A1AA] text-xs">
              Your {role} assistant — ask anything, set reminders, draft emails
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FE5000]/10">
                <Bot size={32} className="text-[#FE5000]" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-1">
                  {assistantName}
                </h3>
                <p className="text-[#71717A] dark:text-[#A1A1AA] text-sm max-w-md">
                  I can answer questions, set reminders, draft emails, schedule reports,
                  and learn your preferences over time. How can I help?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {QUICK_ACTIONS.map(({ label, icon: Icon, prompt }) => (
                  <button
                    key={label}
                    onClick={() => applyQuickAction(prompt)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#27272A] bg-[#18181B] hover:bg-[#27272A] text-[#A1A1AA] hover:text-white text-sm transition-colors text-left"
                  >
                    <Icon size={16} className="text-[#FE5000] shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              <MessageBubble
                message={{
                  id: `asst_${i}`,
                  role: msg.role,
                  content: msg.content,
                  timestamp: new Date(),
                }}
                isStreaming={false}
                onFollowUp={(q) => { setInput(q); }}
              />
              {msg.role === 'assistant' && (msg.actions ?? []).length > 0 && (
                <div className="ml-8 mb-2 space-y-1">
                  {(msg.actions ?? []).map((action, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-1.5 text-xs text-[#FE5000]"
                    >
                      <ChevronRight size={12} />
                      <span>{action.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex items-start justify-center w-7 h-7 rounded-md bg-[#FE5000]/10 shrink-0 mt-0.5">
                <Bot size={14} className="text-[#FE5000] mt-1.5" />
              </div>
              <div className="bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2">
                <Loader2 size={16} className="text-[#FE5000] animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-[#27272A]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your assistant anything..."
              rows={1}
              className="flex-1 bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-white placeholder-[#52525B] outline-none resize-none focus:border-[#FE5000]/50 min-h-[44px] max-h-[120px]"
              style={{ height: 'auto', minHeight: '44px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#FE5000] text-white hover:bg-[#CC4000] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-72 border-l border-[#27272A] flex flex-col shrink-0 hidden lg:flex">
        {/* Sidebar tabs */}
        <div className="flex border-b border-[#27272A]">
          <button
            onClick={() => setSidebarTab('reminders')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors ${
              sidebarTab === 'reminders'
                ? 'text-[#FE5000] border-b-2 border-[#FE5000]'
                : 'text-[#71717A] dark:text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Bell size={14} />
            Reminders
            {reminders.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#FE5000]/10 text-[#FE5000] text-[10px] font-semibold">
                {reminders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setSidebarTab('learnings')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors ${
              sidebarTab === 'learnings'
                ? 'text-[#FE5000] border-b-2 border-[#FE5000]'
                : 'text-[#71717A] dark:text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Brain size={14} />
            Learnings
          </button>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sidebarTab === 'reminders' && (
            <>
              {reminders.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <BellOff size={24} className="text-[#3F3F46] mb-2" />
                  <p className="text-[#52525B] text-xs">No active reminders</p>
                  <p className="text-[#3F3F46] text-xs mt-0.5">
                    Ask your assistant to set one
                  </p>
                </div>
              )}
              {reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="rounded-lg border border-[#27272A] bg-[#18181B] p-3 space-y-2"
                >
                  <p className="text-xs text-[#E4E4E7] line-clamp-2">{rem.message}</p>
                  <div className="flex items-center gap-1 text-[10px] text-[#71717A] dark:text-[#A1A1AA]">
                    <Clock size={10} />
                    {new Date(rem.dueAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {rem.recurring && (
                      <span className="ml-1 px-1 py-0.5 rounded bg-[#27272A] text-[#A1A1AA]">
                        {rem.recurring}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => dismissReminder(rem.id)}
                      className="text-[10px] text-[#71717A] dark:text-[#A1A1AA] hover:text-[#FE5000] transition-colors"
                    >
                      Dismiss
                    </button>
                    <span className="text-[#3F3F46]">|</span>
                    <button
                      onClick={() => deleteReminderById(rem.id)}
                      className="text-[10px] text-[#71717A] dark:text-[#A1A1AA] hover:text-red-400 transition-colors flex items-center gap-0.5"
                    >
                      <Trash2 size={9} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {sidebarTab === 'learnings' && (
            <>
              {learnings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Brain size={24} className="text-[#3F3F46] mb-2" />
                  <p className="text-[#52525B] text-xs">No learnings yet</p>
                  <p className="text-[#3F3F46] text-xs mt-0.5">
                    Your assistant learns from your conversations
                  </p>
                </div>
              )}
              {learnings.map((learning, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[#27272A] bg-[#18181B] p-3"
                >
                  <p className="text-xs text-[#A1A1AA] line-clamp-3">{learning}</p>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="border-t border-[#27272A] p-3 space-y-1">
          <p className="text-[9px] text-[#52525B] uppercase tracking-widest font-semibold mb-2">
            Quick Actions
          </p>
          {QUICK_ACTIONS.map(({ label, icon: Icon, prompt }) => (
            <button
              key={label}
              onClick={() => applyQuickAction(prompt)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-[#A1A1AA] hover:text-white hover:bg-[#18181B] transition-colors"
            >
              <Icon size={12} className="text-[#52525B]" />
              {label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
