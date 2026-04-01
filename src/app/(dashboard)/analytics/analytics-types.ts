// ── Analytics Types ────────────────────────────────────────────

export interface UsageBucket {
  queries: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface ModelStats {
  queries: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface FeedbackByModel {
  up: number;
  down: number;
  total: number;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  usageCount: number;
  rating?: number;
  ratingCount?: number;
  category: string;
}

export interface AutomationRun {
  automationId: string;
  status: 'success' | 'error' | 'skipped';
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface TopEndpoint {
  endpoint: string;
  calls: number;
}

export interface TopUser {
  email: string;
  queries: number;
  tokens: number;
  cost: number;
}

export interface ErrorEntry {
  timestamp: string;
  endpoint: string;
  error: string;
  statusCode?: number;
}

export interface AnalyticsData {
  success: boolean;
  cachedAt: string;
  usage: {
    today: UsageBucket;
    thisWeek: UsageBucket;
    thisMonth: UsageBucket;
    allTime: UsageBucket;
    byModel: Record<string, ModelStats>;
    recentEntries: Array<{
      timestamp: string;
      userEmail: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      estimatedCost: number;
      endpoints?: string[];
    }>;
    topUsers: TopUser[];
    topEndpoints: TopEndpoint[];
  };
  feedback: {
    total: number;
    thumbsUp: number;
    thumbsDown: number;
    byModel: Record<string, FeedbackByModel>;
    recentEntries: Array<{
      id: string;
      rating: string | number;
      comment: string;
      model: string;
      query: string;
      createdAt: string;
    }>;
  };
  errors: {
    total: number;
    last24h: number;
    byEndpoint: Record<string, number>;
    recentErrors: ErrorEntry[];
  };
  workspaces: {
    total: number;
    items: WorkspaceItem[];
  };
  automations: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    successRate: number;
    recentRuns: AutomationRun[];
  };
}

// ── localStorage conversation types ───────────────────────────

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface StoredConversation {
  id: string;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatInsights {
  totalConversations: number;
  avgMessagesPerConvo: number;
  avgResponseLength: number;
  topFirstQuestions: Array<{ question: string; count: number }>;
  hourDistribution: number[]; // 24 slots
}
