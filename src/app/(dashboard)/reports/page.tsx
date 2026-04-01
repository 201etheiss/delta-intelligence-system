'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  FileText,
  FileSpreadsheet,
  Copy,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

function renderContent(raw: string): string {
  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_m: string, lang: string, code: string) => {
      const langLabel = lang
        ? `<span class="absolute top-2 left-3 text-[10px] text-zinc-500 font-mono select-none">${lang}</span>`
        : '';
      const trimmedCode = code.trim();
      return `<div class="relative group my-2">${langLabel}<pre class="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-3 ${lang ? 'pt-7' : ''} overflow-x-auto text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre">${trimmedCode}</pre></div>`;
    }
  );

  html = html.replace(
    /`([^`\n]+)`/g,
    '<code class="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-1 py-0.5 rounded text-xs font-mono">$1</code>'
  );

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/^[-] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="font-semibold text-sm mt-3 mb-1 text-zinc-900 dark:text-zinc-100">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="font-semibold text-base mt-4 mb-1 text-zinc-900 dark:text-zinc-100 border-b border-[#FF5C00] pb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-3 mb-2 text-zinc-900 dark:text-zinc-100">$1</h1>');

  html = html.replace(
    /(?:^|\n)((?:\|.+\|\n?)+)/gm,
    (_m: string, tableBlock: string) => {
      const rows = tableBlock.trim().split('\n').filter(Boolean);
      if (rows.length < 2) return tableBlock;
      const isSeparator = /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(rows[1]);
      const dataRows = isSeparator ? [rows[0], ...rows.slice(2)] : rows;
      const renderRow = (row: string, isHeader: boolean) => {
        const cells = row.split('|').slice(1, -1).map((c: string) => c.trim());
        const tag = isHeader ? 'th' : 'td';
        const cellClass = isHeader
          ? 'px-3 py-1.5 text-left text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 whitespace-nowrap'
          : 'px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 whitespace-nowrap';
        return `<tr>${cells.map((c: string) => `<${tag} class="${cellClass}">${c}</${tag}>`).join('')}</tr>`;
      };
      const headerRow = isSeparator ? renderRow(dataRows[0], true) : '';
      const bodyRows = (isSeparator ? dataRows.slice(1) : dataRows)
        .map((r: string, i: number) => {
          const rowHtml = renderRow(r, false);
          return i % 2 === 1 ? rowHtml.replace('<tr>', '<tr class="bg-zinc-50 dark:bg-zinc-800/50">') : rowHtml;
        })
        .join('');
      return `<div class="overflow-x-auto my-2"><table class="w-full border-collapse text-sm min-w-[400px]"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table></div>`;
    }
  );

  html = html
    .split(/\n\n+/)
    .map((block: string) => {
      if (
        block.startsWith('<pre') ||
        block.startsWith('<div class="relative') ||
        block.startsWith('<div class="overflow') ||
        block.startsWith('<h') ||
        block.startsWith('<table')
      ) {
        return block;
      }
      if (block.startsWith('<li class="ml-4 list-decimal"')) {
        return '<ol class="my-2 pl-4">' + block + '</ol>';
      }
      if (block.startsWith('<li class="ml-4 list-disc"')) {
        return '<ul class="my-2 pl-4">' + block + '</ul>';
      }
      return `<p class="mb-1 last:mb-0">${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  return html;
}

export default function ReportsPage() {
  const [prompt, setPrompt] = useState('');
  const [refinement, setRefinement] = useState('');
  const [report, setReport] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [model, setModel] = useState('');
  const [tokensUsed, setTokensUsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Load prompt from template navigation
  useEffect(() => {
    const stored = sessionStorage.getItem('di_report_prompt');
    if (stored) {
      setPrompt(stored);
      sessionStorage.removeItem('di_report_prompt');
    }
  }, []);

  const generateReport = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setReport('');

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      setReport(data.report);
      setReportTitle(data.title);
      setModel(data.model);
      setTokensUsed(data.tokensUsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  const refineReport = useCallback(async () => {
    if (!refinement.trim() || !report) return;
    setRefining(true);
    setError('');

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          previousReport: report,
          refinement: refinement.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refinement failed');

      setReport(data.report);
      setReportTitle(data.title);
      setModel(data.model);
      setTokensUsed((prev: number) => prev + data.tokensUsed);
      setRefinement('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRefining(false);
    }
  }, [prompt, report, refinement]);

  const handleExport = useCallback(async (format: 'csv' | 'pdf' | 'docx' | 'xlsx') => {
    if (!report) return;

    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, format, title: reportTitle }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (format === 'pdf') {
        window.open(url, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = url;
        const ext = format === 'docx' ? 'html' : format === 'xlsx' ? 'csv' : format;
        a.download = `${reportTitle.replace(/\s+/g, '_')}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [report, reportTitle]);

  const handleCopy = useCallback(() => {
    if (!report) return;
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* clipboard unavailable */ });
  }, [report]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim() || !prompt.trim()) return;
    setSavingTemplate(true);

    try {
      const res = await fetch('/api/reports/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDesc.trim(),
          prompt: prompt.trim(),
          params: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      setShowSaveTemplate(false);
      setTemplateName('');
      setTemplateDesc('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  }, [templateName, templateDesc, prompt]);

  const renderedHtml = report ? renderContent(report) : '';

  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-[#09090B]">
      {/* Left panel: Report Builder */}
      <div className="w-[420px] shrink-0 flex flex-col border-r border-zinc-200 dark:border-[#27272A] bg-zinc-50 dark:bg-[#18181B]">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-[#27272A]">
          <div className="flex items-center gap-2 mb-1">
            <FileBarChart size={18} className="text-[#FF5C00]" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">AI Report Builder</h2>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Describe the report, then iterate</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Describe the report you want...
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., AR aging by customer with 30/60/90 buckets, sorted by total outstanding"
              rows={4}
              className="w-full rounded-lg border border-zinc-300 dark:border-[#3F3F46] bg-white dark:bg-[#27272A] px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#FF5C00] focus:ring-1 focus:ring-[#FF5C00]/30 resize-none"
            />
          </div>

          <button
            onClick={generateReport}
            disabled={loading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold bg-[#FF5C00] text-white hover:bg-[#E54800] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Generating...</>
            ) : (
              <><Sparkles size={16} /> Generate Report</>
            )}
          </button>

          {report && (
            <div className="pt-2 border-t border-zinc-200 dark:border-[#27272A]">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Refine the report
              </label>
              <textarea
                value={refinement}
                onChange={(e) => setRefinement(e.target.value)}
                placeholder="e.g., add YoY column, sort by revenue desc, highlight overdue > $50K"
                rows={2}
                className="w-full rounded-lg border border-zinc-300 dark:border-[#3F3F46] bg-white dark:bg-[#27272A] px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#FF5C00] focus:ring-1 focus:ring-[#FF5C00]/30 resize-none"
              />
              <button
                onClick={refineReport}
                disabled={refining || !refinement.trim()}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border border-[#FF5C00] text-[#FF5C00] hover:bg-[#FF5C00]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {refining ? (
                  <><Loader2 size={14} className="animate-spin" /> Refining...</>
                ) : (
                  <><RefreshCw size={14} /> Refine</>
                )}
              </button>
            </div>
          )}

          {report && (
            <div className="pt-2 border-t border-zinc-200 dark:border-[#27272A]">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Export</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleExport('csv')}
                  className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border border-zinc-300 dark:border-[#3F3F46] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors"
                >
                  <FileSpreadsheet size={14} /> CSV
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border border-zinc-300 dark:border-[#3F3F46] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors"
                >
                  <FileText size={14} /> PDF
                </button>
                <button
                  onClick={() => handleExport('xlsx')}
                  className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border border-zinc-300 dark:border-[#3F3F46] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors"
                >
                  <Download size={14} /> XLSX
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border border-zinc-300 dark:border-[#3F3F46] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors"
                >
                  <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {report && (
            <div className="pt-2 border-t border-zinc-200 dark:border-[#27272A]">
              {!showSaveTemplate ? (
                <button
                  onClick={() => setShowSaveTemplate(true)}
                  className="w-full text-xs text-zinc-500 hover:text-[#FF5C00] transition-colors"
                >
                  Save as Template
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name"
                    className="w-full rounded-lg border border-zinc-300 dark:border-[#3F3F46] bg-white dark:bg-[#27272A] px-3 py-1.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400"
                  />
                  <input
                    type="text"
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full rounded-lg border border-zinc-300 dark:border-[#3F3F46] bg-white dark:bg-[#27272A] px-3 py-1.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTemplate}
                      disabled={savingTemplate || !templateName.trim()}
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#FF5C00] text-white hover:bg-[#E54800] disabled:opacity-50 transition-colors"
                    >
                      {savingTemplate ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setShowSaveTemplate(false)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {model && (
            <div className="text-[10px] text-zinc-400 flex items-center gap-3">
              <span>Model: {model}</span>
              <span>Tokens: {tokensUsed.toLocaleString()}</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Live Preview */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-[#27272A] flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-white">
              {reportTitle || 'Report Preview'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {report ? 'Generated report' : 'Your report will appear here'}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {report ? (
            <div className="max-w-[800px] mx-auto px-8 py-6">
              <div className="h-1 w-16 bg-[#FF5C00] mb-6 rounded-full" />
              <div
                className="prose prose-sm max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
              <div className="mt-8 pt-3 border-t border-zinc-200 dark:border-[#27272A] text-[10px] text-zinc-400">
                Generated by Delta Intelligence | {new Date().toLocaleString('en-US')}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-[#27272A] flex items-center justify-center mb-2.5">
                <FileBarChart size={28} className="text-zinc-300" />
              </div>
              <p className="text-sm font-medium text-zinc-500">No report generated yet</p>
              <p className="text-xs text-zinc-400 mt-0.5 max-w-sm">
                Describe the report you need in the builder panel, or pick a template from the Templates page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
