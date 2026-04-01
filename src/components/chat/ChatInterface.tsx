'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MessageBubble, { type Message } from './MessageBubble';
import ArtifactPanel from '../artifacts/ArtifactPanel';
import type { Artifact } from '../artifacts/ArtifactViewer';
import HelpTooltip from '../common/HelpTooltip';
import { getSmartSuggestions, getWorkflowsForRole } from '@/lib/smart-suggestions';
import type { UserRole } from '@/lib/config/roles';

interface UploadedDocument {
  name: string;
  content: string;
  type: string;
}

type ModelOption = 'auto' | 'haiku' | 'sonnet' | 'opus' | 'gpt4o' | 'gemini-flash';

interface ModelChoice {
  id: ModelOption;
  label: string;
  description: string;
}

const MODEL_CHOICES: ModelChoice[] = [
  { id: 'auto', label: 'Auto', description: 'Routed by complexity' },
  { id: 'haiku', label: 'Haiku', description: 'Fast + cheap' },
  { id: 'sonnet', label: 'Sonnet', description: 'Analysis + multi-step' },
  { id: 'opus', label: 'Opus', description: 'Deep strategy + synthesis' },
  { id: 'gpt4o', label: 'GPT-4o', description: 'OpenAI' },
  { id: 'gemini-flash', label: 'Gemini Flash', description: 'Bulk / long context' },
];

const SAMPLE_PROMPTS = [
  'Price dyed diesel and a 3K DW tank to Plaquemine, LA',
  'Show me current DTN rack prices for Louisiana',
  'Which customers have outstanding invoices over 90 days?',
  'How many vehicles do we have and where are they?',
  'What does our sales pipeline look like?',
  'Show me the balance sheet for this period',
];

const STORAGE_KEY = 'di_conversations';
const ACTIVE_KEY = 'di_active_conversation';

interface StoredConversation {
  id: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

function loadConversations(): StoredConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredConversation[]) : [];
  } catch {
    return [];
  }
}

function saveConversations(convos: StoredConversation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

function getActiveId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_KEY);
}

function setActiveId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_KEY, id);
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateConvoId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function serializeMessages(messages: Message[]): StoredConversation['messages'] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
    model: m.model,
    inputTokens: m.inputTokens,
    outputTokens: m.outputTokens,
  }));
}

function deserializeMessages(stored: StoredConversation['messages']): Message[] {
  return (stored ?? []).map((m) => ({
    ...m,
    timestamp: new Date(m.timestamp),
  }));
}

interface TokenMeta {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface ChatInterfaceProps {
  isAdmin?: boolean;
  role?: string;
  /** Compact mode for embedding in the 380px side panel. Hides artifact panel, help tooltip, workspace features, and adjusts layout. */
  compact?: boolean;
  /** Active module ID (e.g. 'finance', 'operations'). When provided, Nova receives domain-specific context. When absent, Nova gets full cross-domain context. */
  moduleContext?: string;
}

interface WorkspaceConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  dataSources: string[];
  systemPrompt: string;
  preferredModel?: string;
  temperature?: number;
  usageCount?: number;
  samplePrompts?: string[];
}

export default function ChatInterface({ isAdmin = false, role = 'readonly', compact = false, moduleContext }: ChatInterfaceProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [conversationId, setConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>('auto');
  const [error, setError] = useState<string | null>(null);
  const [lastTokenMeta, setLastTokenMeta] = useState<TokenMeta | null>(null);
  const [mounted, setMounted] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load workspace config if workspace param is present
  useEffect(() => {
    const wsId = searchParams.get('workspace');
    if (!wsId) { setWorkspace(null); return; }
    fetch('/api/workspaces')
      .then((r) => r.json())
      .then((data: { success: boolean; workspaces?: WorkspaceConfig[] }) => {
        if (data.success) {
          const found = (data.workspaces ?? []).find((w) => w.id === wsId);
          if (found) setWorkspace(found);
        }
      })
      .catch(() => { /* silent */ });
  }, [searchParams]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // On mount: load conversation from URL param or last active
  useEffect(() => {
    const urlId = searchParams.get('id');
    const convos = loadConversations();

    if (urlId) {
      const found = convos.find((c) => c.id === urlId);
      if (found) {
        setConversationId(found.id);
        setMessages(deserializeMessages(found.messages));
        setActiveId(found.id);
        setMounted(true);
        return;
      }
    }

    const activeId = getActiveId();
    if (activeId) {
      const found = convos.find((c) => c.id === activeId);
      if (found) {
        setConversationId(found.id);
        setMessages(deserializeMessages(found.messages));
        setMounted(true);
        return;
      }
    }

    // No existing conversation — start fresh
    const newId = generateConvoId();
    setConversationId(newId);
    setActiveId(newId);
    setMounted(true);
  }, [searchParams]);

  // Auto-save conversation after messages change (skip initial empty mount)
  useEffect(() => {
    if (!mounted || !conversationId) return;
    if (messages.length === 0) return;

    const convos = loadConversations();
    const idx = convos.findIndex((c) => c.id === conversationId);
    const now = new Date().toISOString();
    const entry: StoredConversation = {
      id: conversationId,
      messages: serializeMessages(messages),
      createdAt: idx >= 0 ? convos[idx].createdAt : now,
      updatedAt: now,
    };

    if (idx >= 0) {
      convos[idx] = entry;
    } else {
      convos.unshift(entry);
    }

    saveConversations(convos);
  }, [messages, conversationId, mounted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [input]);

  const startNewChat = useCallback(() => {
    // Abort any in-flight stream
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    const newId = generateConvoId();
    setConversationId(newId);
    setMessages([]);
    setError(null);
    setLastTokenMeta(null);
    setStreamStatus(null);
    setStreamingMessageId(null);
    setActiveId(newId);
    if (!compact) {
      router.replace('/chat');
    }
  }, [router, compact]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    setStreamStatus(null);

    const apiMessages = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const assistantId = generateId();
    setStreamingMessageId(assistantId);

    // Create placeholder assistant message for streaming
    const placeholderMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, placeholderMessage]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const requestBody = {
        messages: apiMessages,
        model: selectedModel === 'auto' ? undefined : selectedModel,
        ...(workspace?.systemPrompt ? { workspacePrompt: workspace.systemPrompt } : {}),
        ...(workspace?.preferredModel && selectedModel === 'auto' ? { preferredModel: workspace.preferredModel } : {}),
        ...(workspace?.dataSources && workspace.dataSources.length > 0 ? { dataSources: workspace.dataSources } : {}),
        ...(uploadedDocuments.length > 0 ? { documents: uploadedDocuments.map((d) => ({ name: d.name, content: d.content })) } : {}),
        ...(moduleContext ? { moduleContext } : {}),
      };

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Fallback to non-streaming endpoint
        const fallbackRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!fallbackRes.ok) {
          const text = await fallbackRes.text().catch(() => 'Unknown error');
          throw new Error(`API error ${fallbackRes.status}: ${text}`);
        }

        const data = await fallbackRes.json() as {
          content: string;
          model?: string;
          inputTokens?: number;
          outputTokens?: number;
          error?: string;
        };

        if (data.error) throw new Error(data.error);

        const resolvedModel = data.model ?? (selectedModel === 'auto' ? undefined : selectedModel);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: data.content, model: resolvedModel, inputTokens: data.inputTokens, outputTokens: data.outputTokens }
              : m
          )
        );

        if (data.inputTokens != null || data.outputTokens != null) {
          setLastTokenMeta({
            model: resolvedModel ?? 'auto',
            inputTokens: data.inputTokens ?? 0,
            outputTokens: data.outputTokens ?? 0,
          });
        }

        setStreamingMessageId(null);
        setIsLoading(false);
        return;
      }

      // Parse SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let finalModel: string | undefined;
      let finalInputTokens: number | undefined;
      let finalOutputTokens: number | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events from buffer
        const lines = buffer.split('\n');
        buffer = '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;

              if (currentEvent === 'delta') {
                const text = data.text as string;
                accumulatedContent += text;
                setStreamStatus(null);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: accumulatedContent }
                      : m
                  )
                );
              } else if (currentEvent === 'status') {
                setStreamStatus(data.text as string);
              } else if (currentEvent === 'done') {
                finalModel = data.model as string | undefined;
                finalInputTokens = data.inputTokens as number | undefined;
                finalOutputTokens = data.outputTokens as number | undefined;
              } else if (currentEvent === 'error') {
                throw new Error(data.message as string);
              }
            } catch (parseErr) {
              // If it's a thrown Error from above, re-throw
              if (parseErr instanceof Error && !dataStr.includes(parseErr.message)) {
                // JSON parse error — skip malformed event
              } else {
                throw parseErr;
              }
            }
            currentEvent = '';
          } else if (line === '') {
            // Empty line is event separator — skip
          } else {
            // Incomplete line — put back in buffer
            buffer += line + '\n';
          }
        }
      }

      // Finalize the streamed message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: accumulatedContent,
                model: finalModel,
                inputTokens: finalInputTokens,
                outputTokens: finalOutputTokens,
              }
            : m
        )
      );

      if (finalInputTokens != null || finalOutputTokens != null) {
        setLastTokenMeta({
          model: finalModel ?? 'auto',
          inputTokens: finalInputTokens ?? 0,
          outputTokens: finalOutputTokens ?? 0,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled — remove empty placeholder if no content
        setMessages((prev) => {
          const msg = prev.find((m) => m.id === assistantId);
          if (msg && !msg.content) {
            return prev.filter((m) => m.id !== assistantId);
          }
          return prev;
        });
      } else {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        setError(message);
        // Remove empty placeholder on error
        setMessages((prev) => {
          const msg = prev.find((m) => m.id === assistantId);
          if (msg && !msg.content) {
            return prev.filter((m) => m.id !== assistantId);
          }
          return prev;
        });
      }
    } finally {
      setIsLoading(false);
      setStreamStatus(null);
      setStreamingMessageId(null);
      abortRef.current = null;

      // Increment workspace usage count (fire and forget)
      if (workspace) {
        fetch('/api/workspaces', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: workspace.id, usageCount: (workspace.usageCount ?? 0) + 1 }),
        }).catch(() => {});
      }
    }
  }, [input, isLoading, messages, selectedModel, workspace, uploadedDocuments]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Cmd+K shortcut to focus input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Check for documents passed from UploadZone via sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem('di_chat_documents');
      if (raw) {
        const docs = JSON.parse(raw) as UploadedDocument[];
        if (Array.isArray(docs) && docs.length > 0) {
          setUploadedDocuments(docs);
        }
        sessionStorage.removeItem('di_chat_documents');
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleFileUpload = useCallback(async (fileList: FileList) => {
    if (isUploadingFile) return;
    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < fileList.length; i++) {
        formData.append('files', fileList[i]);
      }
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json() as { success: boolean; files?: Array<{ name: string; content: string; type: string }>; error?: string };
      if (data.success && data.files) {
        setUploadedDocuments((prev) => [
          ...prev,
          ...data.files!.map((f) => ({ name: f.name, content: f.content, type: f.type })),
        ]);
      }
    } catch {
      // upload failed silently — user can retry
    } finally {
      setIsUploadingFile(false);
    }
  }, [isUploadingFile]);

  const removeDocument = useCallback((name: string) => {
    setUploadedDocuments((prev) => prev.filter((d) => d.name !== name));
  }, []);

  const selectedModelChoice = MODEL_CHOICES.find((m) => m.id === selectedModel) ?? MODEL_CHOICES[0];

  const modelDisplayName = (raw: string): string => {
    const map: Record<string, string> = {
      'claude-haiku-4-5-20251001': 'Haiku',
      'claude-sonnet-4-6': 'Sonnet',
      'claude-opus-4-6': 'Opus',
      haiku: 'Haiku',
      sonnet: 'Sonnet',
      opus: 'Opus',
      gpt4o: 'GPT-4o',
      'gpt-4o': 'GPT-4o',
      'gemini-flash': 'Gemini Flash',
      'gemini-2.0-flash': 'Gemini Flash',
      auto: 'Auto',
    };
    return map[raw] ?? raw;
  };

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
      }}
    >
      {/* Full-window drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#FE5000]/5 dark:bg-[#FE5000]/10 border-2 border-dashed border-[#FE5000]/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <svg className="w-10 h-10 text-[#FE5000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm font-semibold text-[#FE5000]">Drop files to analyze</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">PDF, DOCX, XLSX, CSV, PPTX, images</p>
          </div>
        </div>
      )}
      {/* Header bar */}
      <div className={`flex items-center justify-between border-b border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] shrink-0 ${compact ? 'px-3 py-2' : 'px-6 py-3'}`}>
        <div className="flex items-center gap-2">
          {!compact && (
            <h2 className="text-sm font-semibold text-[#09090B] dark:text-white">
              {workspace ? workspace.name : 'Chat'}
            </h2>
          )}
          {!compact && workspace && (
            <span
              className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: workspace.color }}
            >
              Workspace
            </span>
          )}
          {messages.length > 0 && (
            <span className="text-[10px] text-[#A1A1AA] tabular-nums">
              {messages.length} msg{messages.length !== 1 ? 's' : ''}
            </span>
          )}
          {uploadedDocuments.length > 0 && (
            <span className="text-[10px] text-[#FE5000] tabular-nums">
              {uploadedDocuments.length} doc{uploadedDocuments.length !== 1 ? 's' : ''} attached
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* New chat */}
          <button
            onClick={startNewChat}
            className="text-xs text-[#A1A1AA] hover:text-[#09090B] dark:hover:text-white transition-colors"
          >
            + New
          </button>

          {/* Generate Report from conversation (hide in compact) */}
          {!compact && messages.length >= 2 && (
            <button
              onClick={() => {
                const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                if (lastAssistant?.content) {
                  sessionStorage.setItem('di_report_content', lastAssistant.content);
                  sessionStorage.setItem('di_report_prompt', messages.find(m => m.role === 'user')?.content ?? '');
                  window.location.href = '/reports';
                }
              }}
              className="text-xs text-[#A1A1AA] hover:text-[#FE5000] transition-colors"
            >
              Generate Report
            </button>
          )}

          {/* Model selector */}
          {isAdmin && (
            <div className="flex items-center gap-1">
              {!compact && <HelpTooltip text="Auto routes to the best model based on query complexity" position="bottom" />}
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
                className={`appearance-none bg-[#FAFAFA] dark:bg-[#27272A] border border-[#E4E4E7] dark:border-[#3F3F46] text-[#09090B] dark:text-white rounded-lg focus:outline-none focus:border-[#FE5000] focus:ring-1 focus:ring-[#FE5000]/30 cursor-pointer ${compact ? 'text-[10px] pl-2 pr-5 py-1' : 'text-xs pl-3 pr-8 py-1.5'}`}
              >
                {MODEL_CHOICES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {compact ? m.label : `${m.label} — ${m.description}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Messages area + Artifact panel row */}
      <div className="flex-1 flex overflow-hidden">
      <div
        className="flex-1 overflow-y-auto bg-[#FAFAFA] dark:bg-[#09090B] relative"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files);
          }
        }}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#FE5000]/5 dark:bg-[#FE5000]/10 border-2 border-dashed border-[#FE5000]/40 rounded-lg backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-[#FE5000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm font-medium text-[#FE5000]">Drop files to analyze</p>
              <p className="text-[10px] text-zinc-500">PDF, DOCX, XLSX, CSV, PPTX, images</p>
            </div>
          </div>
        )}
        {messages.length === 0 && !isLoading ? (
          <EmptyState onSelect={(text) => { setInput(text); }} role={role} compact={compact} />
        ) : (
          <div className={compact ? 'px-3 py-4' : 'max-w-3xl mx-auto px-4 py-6'}>
            {messages.map((message, idx) => {
              // Find the preceding user query for pin button on assistant messages
              let precedingUserQuery: string | undefined;
              if (message.role === 'assistant') {
                for (let j = idx - 1; j >= 0; j--) {
                  if (messages[j].role === 'user') {
                    precedingUserQuery = messages[j].content;
                    break;
                  }
                }
              }
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={message.id === streamingMessageId}
                  onFollowUp={(q) => { setInput(q); setTimeout(() => textareaRef.current?.focus(), 50); }}
                  precedingUserQuery={precedingUserQuery}
                  onOpenArtifact={setActiveArtifact}
                />
              );
            })}

            {isLoading && !streamingMessageId && <TypingIndicator />}

            {streamStatus && (
              <div className="flex justify-start mb-4 animate-fade-in">
                <div className="flex items-center gap-2 text-xs text-[#71717A] bg-white border border-[#E4E4E7] rounded-xl px-3 py-2">
                  <svg className="w-3.5 h-3.5 animate-spin text-[#FE5000]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {streamStatus}
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-xl">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="ml-1 text-red-500 hover:text-red-700">
                    &times;
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Artifact Panel (slide-out sidebar) — hidden in compact panel mode */}
      {!compact && activeArtifact && (
        <ArtifactPanel
          artifact={activeArtifact}
          onClose={() => setActiveArtifact(null)}
        />
      )}
      </div>

      {/* Input */}
      <div className={`border-t border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] shrink-0 ${compact ? 'px-2 py-2' : 'px-4 py-3'}`}>
        <div className={compact ? '' : 'max-w-3xl mx-auto'}>
          {/* Attached document pills */}
          {uploadedDocuments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {uploadedDocuments.map((doc) => (
                <span
                  key={doc.name}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#FE5000]/10 dark:bg-[#FE5000]/15 text-[#FE5000] text-xs px-3 py-1 border border-[#FE5000]/20"
                >
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="truncate max-w-[200px]">{doc.name}</span>
                  <button
                    onClick={() => removeDocument(doc.name)}
                    className="ml-0.5 text-[#FE5000]/60 hover:text-[#FE5000] transition-colors"
                    aria-label={`Remove ${doc.name}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.tsv,.txt,.md,.json,.pptx,.ppt,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip,.gz,.7z,.rar,.html,.xml,.yaml,.yml,.sql,.py,.js,.ts,.log,.rtf"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files && e.target.files.length) {
                handleFileUpload(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <div className="flex items-end gap-3 bg-white dark:bg-[#27272A] border border-[#D4D4D8] dark:border-[#3F3F46] rounded-xl px-3 py-2.5 focus-within:border-[#FE5000] focus-within:ring-1 focus-within:ring-[#FE5000]/20 transition-colors shadow-sm">
            {/* Paperclip / attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingFile}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[#71717A] hover:text-[#FE5000] hover:bg-[#FE5000]/10 dark:hover:bg-[#FE5000]/15 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Attach file"
            >
              {isUploadingFile ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>

            {/* Voice input button */}
            <VoiceMicButton onTranscript={(text) => setInput((prev) => prev ? prev + ' ' + text : text)} />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Delta Intelligence anything..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none bg-transparent text-sm text-[#09090B] dark:text-white placeholder-[#A1A1AA] outline-none leading-relaxed disabled:opacity-60 min-h-[24px] max-h-[320px]"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#FE5000] hover:bg-[#e04600] active:bg-[#c73f00] text-white"
              aria-label="Send message"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>

          {/* Footer: token usage + hints */}
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-[#A1A1AA] text-center flex-1">
              Enter to send — Shift+Enter for new line
              {isAdmin && selectedModel !== 'auto' && (
                <span className="ml-2 text-[#FE5000]/70">
                  Using {selectedModelChoice.label}
                </span>
              )}
            </p>
            {lastTokenMeta && (
              <span className="text-[10px] text-[#A1A1AA] tabular-nums shrink-0 ml-3">
                {modelDisplayName(lastTokenMeta.model)}
                {' '}
                &middot; {lastTokenMeta.inputTokens.toLocaleString()} in / {lastTokenMeta.outputTokens.toLocaleString()} out
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Voice Mic Button ──────────────────────────────────────────

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
}

function VoiceMicButton({ onTranscript }: VoiceMicButtonProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Web Speech API — vendor-prefixed in most browsers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) onTranscript(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
  }, [onTranscript]);

  const toggle = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  if (!supported) {
    return (
      <button
        disabled
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#52525B] opacity-40 cursor-not-allowed"
        title="Voice input not supported in this browser"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={[
        'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all',
        listening
          ? 'bg-red-500/20 text-red-500 animate-pulse'
          : 'text-[#71717A] hover:text-[#09090B] hover:bg-[#F4F4F5]',
      ].join(' ')}
      aria-label={listening ? 'Stop listening' : 'Voice input'}
      title={listening ? 'Listening... click to stop' : 'Voice input'}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}

// ── Empty State ───────────────────────────────────────────────

interface FavoriteItem {
  id: string;
  query: string;
  title: string;
}

const ROLE_PROMPTS: Record<string, { subtitle: string; prompts: string[] }> = {
  admin: {
    subtitle: 'Ask about pricing, operations, financials, or any Delta360 data',
    prompts: [
      'Price dyed diesel and a 3K DW tank to Plaquemine, LA',
      'Which customers have outstanding invoices over 90 days?',
      'What does our sales pipeline look like?',
    ],
  },
  accounting: {
    subtitle: 'Ask about invoices, AR aging, revenue, and financial data',
    prompts: [
      'Show AR aging over 90 days',
      'Revenue by month for 2025',
      'Which customers have the largest outstanding balances?',
    ],
  },
  sales: {
    subtitle: 'Ask about pipeline, leads, and customer activity',
    prompts: [
      'Show me the current sales pipeline',
      'Top 5 customers by gross profit',
      'Which leads need follow-up this week?',
    ],
  },
  operations: {
    subtitle: 'Ask about fleet, equipment, and field operations',
    prompts: [
      'How many vehicles do we have and where are they?',
      'Show equipment needing maintenance',
      'What deliveries are scheduled for today?',
    ],
  },
  readonly: {
    subtitle: 'Ask about any Delta360 data you have access to',
    prompts: [
      'Show me current DTN rack prices for Louisiana',
      'How many active customers do we have?',
      'What is our fleet status?',
    ],
  },
};

function EmptyState({ onSelect, role = 'readonly', compact = false }: { onSelect: (text: string) => void; role?: string; compact?: boolean }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    fetch('/api/favorites')
      .then((r) => r.json())
      .then((data: { favorites?: FavoriteItem[] }) => {
        if (data.favorites && data.favorites.length > 0) {
          setFavorites(data.favorites.slice(0, 3));
        }
      })
      .catch(() => {});
  }, []);

  const roleConfig = ROLE_PROMPTS[role] ?? ROLE_PROMPTS.readonly;
  const suggestions = getSmartSuggestions(role as UserRole);
  const workflows = getWorkflowsForRole(role as UserRole);
  const allPrompts = [
    ...favorites.map((f) => f.query),
    ...suggestions.map((s) => s.text),
    ...roleConfig.prompts,
  ];
  const uniquePrompts = Array.from(new Set(allPrompts)).slice(0, 6);

  const CAPABILITIES = [
    { label: 'Query Data', desc: '8 live sources', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { label: 'Create Events', desc: 'Teams calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: 'Salesforce', desc: 'Create & update', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { label: 'Export', desc: '7 formats', icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ];

  return (
    <div className={`flex flex-col items-center justify-center h-full px-4 ${compact ? 'min-h-[200px]' : 'min-h-[400px]'}`}>
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/delta logo mark.png"
        alt="Delta Intelligence"
        className={`object-contain mb-3 opacity-80 ${compact ? 'w-10 h-10' : 'w-14 h-14 mb-4'}`}
      />
      <h2 className={`text-[#09090B] dark:text-white font-bold mb-1 ${compact ? 'text-sm' : 'text-lg'}`}>
        {compact ? 'Nova' : 'Delta Intelligence'}
      </h2>
      <p className={`text-[#71717A] dark:text-[#A1A1AA] text-center max-w-md ${compact ? 'text-xs mb-3' : 'text-sm mb-5'}`}>
        {compact ? 'Ask anything about Delta360 data' : roleConfig.subtitle}
      </p>

      {/* Capability chips — hide in compact */}
      {!compact && (
        <div className="flex items-center gap-2 mb-6 flex-wrap justify-center">
          {CAPABILITIES.map((cap) => (
            <div key={cap.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
              <svg className="w-3.5 h-3.5 text-[#FE5000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={cap.icon} />
              </svg>
              <span className="text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">{cap.label}</span>
              <span className="text-[10px] text-zinc-400">·</span>
              <span className="text-[10px] text-zinc-400">{cap.desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pinned queries + sample prompts */}
      {favorites.length > 0 && (
        <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide font-medium mb-2">
          Pinned Queries
        </p>
      )}
      <div className={`grid gap-2 w-full ${compact ? 'grid-cols-1 max-w-full' : 'grid-cols-1 sm:grid-cols-2 max-w-xl'}`}>
        {(compact ? uniquePrompts.slice(0, 3) : uniquePrompts).map((prompt) => {
          const isPinned = favorites.some((f) => f.query === prompt);
          return (
            <button
              key={prompt}
              onClick={() => onSelect(prompt)}
              className={`text-left px-4 py-3 rounded-xl border text-sm leading-relaxed transition-all ${
                isPinned
                  ? 'border-[#FE5000]/30 bg-[#FE5000]/5 text-[#09090B] dark:text-white hover:border-[#FE5000]/50 hover:bg-[#FE5000]/10 hover:shadow-sm'
                  : 'border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] text-[#71717A] hover:border-[#FE5000]/40 hover:text-[#09090B] dark:hover:text-white hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] hover:shadow-sm'
              }`}
            >
              {isPinned && (
                <svg className="inline w-3 h-3 text-yellow-500 mr-1.5 -mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              )}
              {prompt}
            </button>
          );
        })}
      </div>

      {/* Workflow templates — hide in compact */}
      {!compact && workflows.length > 0 && (
        <div className="mt-5 max-w-xl w-full">
          <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide font-medium mb-2">Guided Workflows</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {workflows.slice(0, 4).map((wf) => (
              <button
                key={wf.id}
                onClick={() => onSelect(wf.steps[0])}
                className="text-left px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-[#FE5000]/30 hover:shadow-sm transition-all group"
              >
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-[#FE5000] transition-colors">{wf.name}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{wf.steps.length} steps</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drag and drop hint + keyboard shortcuts — hide in compact */}
      {!compact && <div className="mt-6 flex items-center gap-4 text-[10px] text-[#A1A1AA]">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          Drag files here to analyze
        </span>
        <span>&middot;</span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#F4F4F5] dark:bg-[#27272A] border border-[#E4E4E7] dark:border-[#3F3F46] text-[#71717A] dark:text-[#A1A1AA] font-mono text-[9px]">&#8984;K</kbd> chat
        </span>
        <span>&middot;</span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#F4F4F5] dark:bg-[#27272A] border border-[#E4E4E7] dark:border-[#3F3F46] text-[#71717A] dark:text-[#A1A1AA] font-mono text-[9px]">&#8984;P</kbd> search
        </span>
      </div>}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#09090B] border border-[#27272A] flex items-center justify-center shrink-0">
          <svg className="w-3 h-3 text-[#FE5000]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 19h20L12 2z" />
          </svg>
        </div>
        <div className="bg-white dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA] animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA] animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA] animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
}
