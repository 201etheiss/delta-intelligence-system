import type { LucideIcon } from 'lucide-react';
import {
  DollarSign, AlertTriangle, Truck, BarChart3,
  Calculator, Briefcase,
} from 'lucide-react';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  color: string;
  icon: string;
  dataSources: string[];
  enabledEndpoints?: string[];
  systemPrompt: string;
  temperature?: number;
  preferredModel?: string;
  maxToolRounds?: number;
  visibility: 'private' | 'team' | 'public';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  rating?: number;
  ratingCount?: number;
  tags: string[];
  category: 'operations' | 'finance' | 'sales' | 'compliance' | 'analytics' | 'custom';
  samplePrompts: string[];
  responseFormat?: string;
  includeDocuments?: string[];
}

export type TabKey = 'my' | 'team' | 'all';
export type CategoryFilter = '' | Workspace['category'];

export const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'sales', label: 'Sales' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'custom', label: 'Custom' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  operations: '#3B82F6',
  finance: '#8B5CF6',
  sales: '#22C55E',
  compliance: '#EF4444',
  analytics: '#F59E0B',
  custom: '#71717A',
};

export const BRAND_COLORS = ['#FE5000', '#EF4444', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B'];

export const DATA_SOURCES = [
  'ascend', 'salesforce', 'samsara', 'powerbi', 'microsoft', 'vroozi', 'fleetpanda',
];

export const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'haiku', label: 'Haiku' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
];

export const FORMAT_OPTIONS = [
  'auto', 'Analysis', 'Operator Brief', 'Decision Memo', 'Status Report', 'Diagnostic',
];

export const ICON_MAP: Record<string, LucideIcon> = {
  dollar: DollarSign,
  alert: AlertTriangle,
  truck: Truck,
  chart: BarChart3,
  calculator: Calculator,
  briefcase: Briefcase,
};
