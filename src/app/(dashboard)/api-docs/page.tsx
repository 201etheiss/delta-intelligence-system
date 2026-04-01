'use client';

import { useState, useCallback } from 'react';
import { Code, ChevronDown, ChevronRight, Play, Copy, Check } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface EndpointParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface EndpointDoc {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  category: string;
  params?: EndpointParam[];
  requestBody?: string;
  responseExample?: string;
}

// ── Endpoint Registry ────────────────────────────────────────

const ENDPOINTS: EndpointDoc[] = [
  // Chat
  {
    method: 'POST',
    path: '/api/chat',
    description: 'Send a message to the AI chat. Supports multi-model routing, workspace context, and document attachments.',
    category: 'Chat',
    requestBody: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }], model: 'auto', workspacePrompt: '' }, null, 2),
    responseExample: JSON.stringify({ content: 'Response text', model: 'claude-sonnet-4-20250514', tokensUsed: 150, inputTokens: 50, outputTokens: 100 }, null, 2),
  },
  // Reports
  {
    method: 'POST',
    path: '/api/reports',
    description: 'Generate an AI-powered report with iterative refinement.',
    category: 'Reports',
    requestBody: JSON.stringify({ type: 'executive_summary', topic: 'Q1 Performance', dataSources: ['ascend', 'salesforce'] }, null, 2),
    responseExample: JSON.stringify({ success: true, report: { id: 'rpt_001', content: '...' } }, null, 2),
  },
  // Workbooks
  {
    method: 'GET',
    path: '/api/workbooks',
    description: 'List all available workbook templates.',
    category: 'Workbooks',
    responseExample: JSON.stringify({ success: true, workbooks: [{ id: 'wb_001', name: 'Financial Analysis' }] }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/workbooks',
    description: 'Generate a new workbook from a template.',
    category: 'Workbooks',
    requestBody: JSON.stringify({ templateId: 'financial_analysis', parameters: {} }, null, 2),
    responseExample: JSON.stringify({ success: true, workbook: { id: 'wb_002', name: 'Financial Analysis' } }, null, 2),
  },
  // Dashboard
  {
    method: 'GET',
    path: '/api/dashboard',
    description: 'Fetch KPI metrics: customer count, pipeline total, vehicle count, A/R total, recent invoices, rack price.',
    category: 'Dashboard',
    responseExample: JSON.stringify({ success: true, kpis: { customerCount: 150, pipelineTotal: 2500000, vehicleCount: 45, arTotal: 800000 }, fetchedAt: '2026-03-28T12:00:00Z' }, null, 2),
  },
  // Navigation
  {
    method: 'GET',
    path: '/api/navigation',
    description: 'Get the full navigation structure with page groups.',
    category: 'Navigation',
    responseExample: JSON.stringify({ success: true, platform: 'Delta Intelligence', totalPages: 14, groups: [] }, null, 2),
  },
  // Config
  {
    method: 'GET',
    path: '/api/config',
    description: 'Get the white-label platform configuration.',
    category: 'Config',
    responseExample: JSON.stringify({ success: true, config: { companyName: 'Delta360', platformName: 'Delta Intelligence', primaryColor: '#FF5C00' } }, null, 2),
  },
  {
    method: 'PATCH',
    path: '/api/config',
    description: 'Update white-label configuration (admin only).',
    category: 'Config',
    requestBody: JSON.stringify({ platformName: 'My Platform', primaryColor: '#0066FF' }, null, 2),
    responseExample: JSON.stringify({ success: true, config: { companyName: 'Delta360', platformName: 'My Platform', primaryColor: '#0066FF' } }, null, 2),
  },
  // Embed
  {
    method: 'GET',
    path: '/api/embed',
    description: 'Get an embeddable JavaScript snippet for the chat widget.',
    category: 'Embed',
    params: [
      { name: 'width', type: 'string', required: false, description: 'Widget width in px (default: 400)' },
      { name: 'height', type: 'string', required: false, description: 'Widget height in px (default: 600)' },
      { name: 'position', type: 'string', required: false, description: 'bottom-right | bottom-left' },
      { name: 'theme', type: 'string', required: false, description: 'dark | light' },
      { name: 'workspace', type: 'string', required: false, description: 'Workspace slug' },
      { name: 'type', type: 'string', required: false, description: 'chat | kpi' },
      { name: 'metrics', type: 'string', required: false, description: 'Comma-separated KPI metrics' },
    ],
    responseExample: '(function(){ /* JS snippet */ })();',
  },
  // Admin
  {
    method: 'GET',
    path: '/api/admin/users',
    description: 'List all users with roles and status.',
    category: 'Admin',
    responseExample: JSON.stringify({ success: true, users: [{ email: 'admin@delta360.energy', role: 'admin', active: true }] }, null, 2),
  },
  // Upload
  {
    method: 'POST',
    path: '/api/upload',
    description: 'Upload a document for AI analysis (PDF, DOCX, XLSX, CSV, images).',
    category: 'Documents',
    requestBody: 'FormData with "file" field',
    responseExample: JSON.stringify({ success: true, document: { name: 'report.pdf', pages: 12, chars: 45000 } }, null, 2),
  },
  // Gateway
  {
    method: 'POST',
    path: '/api/gateway',
    description: 'Proxy requests to the Unified Data Gateway (Ascend, Salesforce, Power BI, Samsara, Fleet Panda).',
    category: 'Gateway',
    requestBody: JSON.stringify({ service: 'ascend', endpoint: '/customers', method: 'GET' }, null, 2),
    responseExample: JSON.stringify({ success: true, data: [] }, null, 2),
  },
  // Settings
  {
    method: 'GET',
    path: '/api/settings',
    description: 'Get user preferences (model, timezone, date range, etc.).',
    category: 'Settings',
    responseExample: JSON.stringify({ success: true, preferences: { defaultModel: 'auto', timezone: 'America/Chicago' } }, null, 2),
  },
  {
    method: 'PATCH',
    path: '/api/settings',
    description: 'Update user preferences.',
    category: 'Settings',
    requestBody: JSON.stringify({ defaultModel: 'sonnet', darkMode: true }, null, 2),
    responseExample: JSON.stringify({ success: true, preferences: { defaultModel: 'sonnet' } }, null, 2),
  },
];

// ── Helpers ──────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: '#22C55E',
  POST: '#3B82F6',
  PATCH: '#F59E0B',
  DELETE: '#EF4444',
};

function groupByCategory(endpoints: EndpointDoc[]): Record<string, EndpointDoc[]> {
  const groups: Record<string, EndpointDoc[]> = {};
  for (const ep of endpoints) {
    const list = groups[ep.category] ?? [];
    groups[ep.category] = [...list, ep];
  }
  return groups;
}

// ── Components ───────────────────────────────────────────────

function EndpointCard({ endpoint }: { endpoint: EndpointDoc }) {
  const [expanded, setExpanded] = useState(false);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const tryIt = useCallback(async () => {
    setLoading(true);
    setResponse('');
    try {
      const options: RequestInit = { method: endpoint.method };
      if (endpoint.requestBody && endpoint.method !== 'GET') {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = endpoint.requestBody;
      }
      const res = await fetch(endpoint.path, options);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResponse(JSON.stringify(json, null, 2));
      } catch {
        setResponse(text);
      }
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : 'Request failed'}`);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  const copyPath = useCallback(() => {
    navigator.clipboard.writeText(endpoint.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [endpoint.path]);

  return (
    <div className="border border-[#27272A] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#18181B]/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-[#52525B] shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-[#52525B] shrink-0" />
        )}
        <span
          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded font-mono"
          style={{
            color: METHOD_COLORS[endpoint.method] ?? '#A1A1AA',
            backgroundColor: `${METHOD_COLORS[endpoint.method] ?? '#A1A1AA'}15`,
          }}
        >
          {endpoint.method}
        </span>
        <code className="text-sm text-[#FAFAFA] font-mono">{endpoint.path}</code>
        <span className="text-xs text-[#71717A] ml-auto hidden md:block">
          {endpoint.description.slice(0, 60)}
          {endpoint.description.length > 60 ? '...' : ''}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#27272A] bg-[#18181B]/30">
          <p className="text-sm text-[#A1A1AA] mt-3 mb-2">{endpoint.description}</p>

          {/* Query params */}
          {endpoint.params && endpoint.params.length > 0 && (
            <div className="mb-2">
              <h4 className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">
                Query Parameters
              </h4>
              <div className="space-y-1">
                {endpoint.params.map((p) => (
                  <div key={p.name} className="flex items-baseline gap-2 text-xs">
                    <code className="text-[#FF5C00] font-mono">{p.name}</code>
                    <span className="text-[#52525B]">{p.type}</span>
                    {p.required && (
                      <span className="text-red-400 text-[10px]">required</span>
                    )}
                    <span className="text-[#71717A]">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request body */}
          {endpoint.requestBody && (
            <div className="mb-2">
              <h4 className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">
                Request Body
              </h4>
              <pre className="bg-[#09090B] border border-[#27272A] rounded p-3 text-xs text-[#A1A1AA] font-mono overflow-x-auto">
                {endpoint.requestBody}
              </pre>
            </div>
          )}

          {/* Response example */}
          {endpoint.responseExample && (
            <div className="mb-2">
              <h4 className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">
                Response Example
              </h4>
              <pre className="bg-[#09090B] border border-[#27272A] rounded p-3 text-xs text-[#A1A1AA] font-mono overflow-x-auto">
                {endpoint.responseExample}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={tryIt}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white bg-[#FF5C00] hover:bg-[#E54800] transition-colors disabled:opacity-50"
            >
              <Play size={12} />
              {loading ? 'Running...' : 'Try it'}
            </button>
            <button
              onClick={copyPath}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-[#A1A1AA] border border-[#27272A] hover:bg-[#27272A] transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy path'}
            </button>
          </div>

          {/* Live response */}
          {response && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">
                Live Response
              </h4>
              <pre className="bg-[#09090B] border border-[#22C55E]/30 rounded p-3 text-xs text-[#A1A1AA] font-mono overflow-x-auto max-h-64 overflow-y-auto">
                {response}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const grouped = groupByCategory(ENDPOINTS);
  const categories = Object.keys(grouped);

  return (
    <div className="h-full overflow-y-auto bg-[#09090B]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-[#FF5C00]/10">
            <Code size={20} className="text-[#FF5C00]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">API Documentation</h1>
            <p className="text-sm text-[#71717A]">
              Interactive reference for all Delta Intelligence API endpoints
            </p>
          </div>
        </div>

        {/* Base URL */}
        <div className="mb-6 p-3 rounded-lg bg-[#18181B] border border-[#27272A]">
          <div className="text-[10px] font-semibold text-[#52525B] uppercase tracking-wide mb-1">
            Base URL
          </div>
          <code className="text-sm text-[#FF5C00] font-mono">
            {typeof window !== 'undefined' ? window.location.origin : 'https://intelligence.delta360.energy'}
          </code>
        </div>

        {/* Endpoint sections */}
        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat}>
              <h2 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide mb-2">
                {cat}
              </h2>
              <div className="space-y-2">
                {(grouped[cat] ?? []).map((ep, idx) => (
                  <EndpointCard key={`${ep.method}-${ep.path}-${idx}`} endpoint={ep} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
