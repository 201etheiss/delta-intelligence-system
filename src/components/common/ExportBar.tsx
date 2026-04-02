'use client';

import { useState, useCallback } from 'react';
import HelpTooltip from './HelpTooltip';

interface ExportBarProps {
  content: string;
  title?: string;
  onExport?: (format: string) => void;
  compact?: boolean;
}

const FORMATS = [
  { id: 'xlsx', label: 'Excel', icon: 'table' },
  { id: 'csv', label: 'CSV', icon: 'grid' },
  { id: 'docx', label: 'Word', icon: 'doc' },
  { id: 'pdf', label: 'PDF', icon: 'pdf' },
  { id: 'pptx', label: 'PowerPoint', icon: 'slides' },
  { id: 'md', label: 'Markdown', icon: 'md' },
  { id: 'copy', label: 'Copy', icon: 'copy' },
] as const;

function extractTitle(content: string, fallback: string): string {
  const titleMatch = content.match(/^#\s+(.+)$/m) ?? content.match(/^\*\*(.+?)\*\*/m);
  return titleMatch ? titleMatch[1].replace(/\*\*/g, '').trim() : fallback;
}

export default function ExportBar({ content, title, onExport, compact = false }: ExportBarProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleExport = useCallback(async (format: string) => {
    if (exporting) return;

    // Copy to clipboard
    if (format === 'copy') {
      try {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // clipboard not available
      }
      onExport?.('copy');
      return;
    }

    setExporting(format);
    try {
      const resolvedTitle = title ?? extractTitle(content, 'Delta Intelligence Export');

      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reports: [{ title: resolvedTitle, content }],
          format,
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format;
      a.download = `${resolvedTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onExport?.(format);
      const label = FORMATS.find(f => f.id === format)?.label ?? format;
      setToast(`Exported as ${label}`);
      setTimeout(() => setToast(null), 2000);
    } catch {
      setToast('Export failed');
      setTimeout(() => setToast(null), 2000);
    } finally {
      setExporting(null);
    }
  }, [content, title, exporting, onExport]);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-[#71717A] mr-0.5">Export:</span>
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => handleExport(f.id)}
            disabled={!!exporting}
            className="text-[10px] px-1.5 py-0.5 rounded border border-[#3F3F46] text-[#A1A1AA] hover:border-[#FE5000]/40 hover:text-[#FE5000] hover:bg-[#FE5000]/10 transition-colors disabled:opacity-50"
          >
            {exporting === f.id ? '...' : f.id === 'copy' ? (copied ? 'Copied' : f.label) : f.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#27272A]">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-[#71717A] font-medium uppercase tracking-wide mr-1">Export</span>
        <HelpTooltip text="Download this response as a file" position="top" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => handleExport(f.id)}
              disabled={!!exporting}
              className="text-[11px] px-3 py-1.5 rounded-md border border-[#3F3F46] text-[#A1A1AA] font-medium hover:border-[#FE5000]/50 hover:text-[#FE5000] hover:bg-[#FE5000]/10 transition-colors disabled:opacity-50"
            >
              {exporting === f.id ? '...' : f.id === 'copy' ? (copied ? 'Copied!' : f.label) : f.label}
            </button>
          ))}
        </div>
        {toast && (
          <span className="text-[11px] text-[#FE5000] font-medium ml-2">{toast}</span>
        )}
      </div>
    </div>
  );
}
