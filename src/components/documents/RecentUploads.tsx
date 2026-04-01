'use client';

import { useState, useEffect } from 'react';
import { FileText, Image, Table2, FileCode, Archive, AlertCircle, Loader2, Trash2 } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface DocumentRecord {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly uploadedAt: string;
}

const STORAGE_KEY = 'di_uploaded_documents';

function formatBytes(bytes: number): string {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'pdf':
      return <FileText size={16} className="text-red-400" />;
    case 'image':
      return <Image size={16} className="text-blue-400" />;
    case 'xlsx':
    case 'csv':
      return <Table2 size={16} className="text-emerald-400" />;
    case 'zip':
      return <Archive size={16} className="text-amber-400" />;
    default:
      return <FileCode size={16} className="text-zinc-400" />;
  }
}

function loadDocuments(): DocumentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DocumentRecord[]) : [];
  } catch {
    return [];
  }
}

// ── Component ────────────────────────────────────────────────

export default function RecentUploads() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load from localStorage as the document store
    try {
      const docs = loadDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen for new uploads by watching localStorage changes
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setDocuments(loadDocuments());
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const removeDocument = (name: string) => {
    const updated = documents.filter((d) => d.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setDocuments(updated);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-6">
        <div className="flex items-center gap-2 text-sm text-[#71717A]">
          <Loader2 size={14} className="animate-spin" />
          Loading documents...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
        <AlertCircle size={14} />
        {error}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F4F5] dark:bg-[#27272A] flex items-center justify-center mb-4">
            <FileText size={20} className="text-[#A1A1AA]" />
          </div>
          <h3 className="text-sm font-semibold text-[#09090B] dark:text-white mb-1">
            No documents uploaded yet
          </h3>
          <p className="text-xs text-[#A1A1AA] max-w-sm">
            Use the upload zone above to add documents. They will appear here for quick reference.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B]">
      <div className="px-5 py-3 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#09090B] dark:text-white">
          Recent Documents
        </h3>
        <span className="text-xs text-[#A1A1AA] tabular-nums">
          {documents.length} file{documents.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A]">
        {(documents ?? []).map((doc) => (
          <div
            key={doc.name}
            className="group flex items-center justify-between px-5 py-3 hover:bg-[#FAFAFA] dark:hover:bg-[#27272A]/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              {getTypeIcon(doc.type)}
              <div className="min-w-0">
                <p className="text-sm text-[#09090B] dark:text-white truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[#A1A1AA] uppercase font-semibold tracking-wide">
                    {doc.type}
                  </span>
                  <span className="text-[10px] text-[#71717A] tabular-nums">
                    {formatBytes(doc.size)}
                  </span>
                  {doc.uploadedAt && (
                    <span className="text-[10px] text-[#71717A] tabular-nums">
                      {formatDate(doc.uploadedAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => removeDocument(doc.name)}
              className="opacity-0 group-hover:opacity-100 shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[#A1A1AA] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
              aria-label={`Remove ${doc.name}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
