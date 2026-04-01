/**
 * Server-side conversation storage.
 * Saves/loads conversations from data/conversations.json.
 * Each user has their own conversation list keyed by email.
 *
 * Stepping stone to Supabase — swap the read/write functions later.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const MAX_CONVERSATIONS = 500;

// --- Types ---

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface Conversation {
  id: string;
  userEmail: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
}

interface ConversationsStore {
  conversations: Conversation[];
}

// --- Internal helpers ---

function readStore(): ConversationsStore {
  try {
    if (!fs.existsSync(CONVERSATIONS_FILE)) {
      const empty: ConversationsStore = { conversations: [] };
      writeStore(empty);
      return empty;
    }
    const raw = fs.readFileSync(CONVERSATIONS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as ConversationsStore;
    if (!Array.isArray(parsed.conversations)) {
      return { conversations: [] };
    }
    return parsed;
  } catch {
    return { conversations: [] };
  }
}

function writeStore(store: ConversationsStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function generateTitle(messages: ConversationMessage[]): string {
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (!firstUserMsg) {
    return 'New Conversation';
  }
  const text = firstUserMsg.content.trim().replace(/\n/g, ' ');
  if (text.length <= 60) {
    return text;
  }
  return text.slice(0, 57) + '...';
}

function purgeOldest(store: ConversationsStore): ConversationsStore {
  if (store.conversations.length <= MAX_CONVERSATIONS) {
    return store;
  }
  // Sort by updatedAt descending, keep newest MAX_CONVERSATIONS
  const sorted = [...store.conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return { conversations: sorted.slice(0, MAX_CONVERSATIONS) };
}

// --- Public API ---

export function saveConversation(conv: Conversation): void {
  const store = readStore();
  const idx = store.conversations.findIndex(c => c.id === conv.id);

  // Auto-generate title from first user message if not provided or generic
  const title = (!conv.title || conv.title === 'New Conversation')
    ? generateTitle(conv.messages)
    : conv.title;

  const now = new Date().toISOString();
  const updated: Conversation = {
    ...conv,
    title,
    updatedAt: now,
    createdAt: conv.createdAt || now,
  };

  if (idx >= 0) {
    // Update existing — create new array (immutable pattern)
    const next = [...store.conversations];
    next[idx] = updated;
    writeStore(purgeOldest({ conversations: next }));
  } else {
    // Insert new
    writeStore(purgeOldest({ conversations: [updated, ...store.conversations] }));
  }
}

export function getConversation(id: string): Conversation | null {
  const store = readStore();
  return store.conversations.find(c => c.id === id) ?? null;
}

export function getUserConversations(email: string, limit = 50): Conversation[] {
  const store = readStore();
  return store.conversations
    .filter(c => c.userEmail === email)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export function deleteConversation(id: string): boolean {
  const store = readStore();
  const before = store.conversations.length;
  const filtered = store.conversations.filter(c => c.id !== id);
  if (filtered.length === before) {
    return false;
  }
  writeStore({ conversations: filtered });
  return true;
}

export function searchConversations(email: string, query: string): Conversation[] {
  const store = readStore();
  const lower = query.toLowerCase();
  return store.conversations
    .filter(c => c.userEmail === email)
    .filter(c => {
      if (c.title.toLowerCase().includes(lower)) return true;
      return c.messages.some(m => m.content.toLowerCase().includes(lower));
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
