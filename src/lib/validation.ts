/**
 * Zod validation schemas for API request bodies.
 * Import and use .parse() or .safeParse() at the top of each route handler.
 */
import { z } from 'zod';

export const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(100000),
  })).min(1),
  model: z.string().optional(),
  conversationId: z.string().optional(),
  workspaceId: z.string().optional(),
  workspacePrompt: z.string().max(50000).optional(),
  preferredModel: z.string().optional(),
  dataSources: z.array(z.string()).optional(),
  documents: z.array(z.object({
    name: z.string(),
    content: z.string(),
  })).optional(),
  documentContext: z.string().max(50000).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

export const AssistantRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(100000),
  })).min(1),
  model: z.string().optional(),
  conversationId: z.string().optional(),
  assistantId: z.string().optional(),
  values: z.record(z.string(), z.string()).optional(),
});

export const ReportGenerateSchema = z.object({
  prompt: z.string().min(1).max(10000),
  previousReport: z.string().optional(),
  refinement: z.string().optional(),
  reportType: z.string().optional(),
  documents: z.array(z.object({
    name: z.string(),
    content: z.string(),
  })).optional(),
  format: z.string().optional(),
});

export const ReportExportSchema = z.object({
  reports: z.array(z.object({
    title: z.string(),
    content: z.string(),
  })).min(1),
  format: z.enum(['xlsx', 'csv', 'docx', 'pdf', 'pptx', 'md', 'txt', 'json', 'html']),
  bundle: z.boolean().optional(),
});

export const FeedbackSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  conversationId: z.string().optional(),
  rating: z.enum(['up', 'down'], { message: 'rating must be "up" or "down"' }),
  comment: z.string().max(2000).optional(),
  model: z.string().optional(),
  query: z.string().optional(),
  userEmail: z.string().optional(),
});

export const AutomationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.object({
    type: z.string(),
    config: z.record(z.string(), z.unknown()),
  }),
  actions: z.array(z.object({
    type: z.string(),
    config: z.record(z.string(), z.unknown()),
  })),
  enabled: z.boolean().optional(),
});

export const SettingsSchema = z.object({
  preferredModel: z.enum(['haiku', 'sonnet', 'opus', 'auto']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['en', 'es']).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    teams: z.boolean().optional(),
  }).optional(),
});

export const UserCreateSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly']),
});

export const UploadSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().max(10 * 1024 * 1024), // 10MB
});

/**
 * Helper to validate and return parsed data or error response.
 */
export function validateRequest<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: `Validation failed: ${issues}` };
}
