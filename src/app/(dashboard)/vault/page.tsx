'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Search,
  RefreshCw,
  Upload,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Clock,
  Hash,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvidenceEntry {
  id: string;
  sourceModule: string;
  sourceId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  checksum: string;
  uploadedBy: string;
  description: string;
  tags: string[];
  verified: boolean;
  createdAt: string;
}

interface VaultStats {
  totalFiles: number;
  totalSize: number;
  oldest: string | null;
  newest: string | null;
  byModule: Record<string, number>;
}

const MODULE_OPTIONS = ['all', 'je', 'recon', 'close', 'audit', 'report', 'tax'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtSize(bytes: number): string {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${typeof val === 'number' ? val.toFixed(1) : '0'} ${units[i] ?? 'B'}`;
}

function truncHash(hash: string): string {
  if (!hash || typeof hash !== 'string') return '--';
  return hash.length > 16 ? `${hash.slice(0, 8)}...${hash.slice(-8)}` : hash;
}

function fileIcon(fileType: string) {
  if (!fileType) return <File size={16} className="text-zinc-500" />;
  if (fileType.includes('pdf') || fileType.includes('text'))
    return <FileText size={16} className="text-red-400" />;
  if (fileType.includes('sheet') || fileType.includes('csv') || fileType.includes('excel'))
    return <FileSpreadsheet size={16} className="text-green-400" />;
  if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg'))
    return <FileImage size={16} className="text-blue-400" />;
  return <File size={16} className="text-zinc-500" />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VaultPage() {
  const [evidence, setEvidence] = useState<EvidenceEntry[]>([]);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const moduleParam = moduleFilter !== 'all' ? `?module=${moduleFilter}` : '';
      const searchParam = searchQuery
        ? `${moduleParam ? '&' : '?'}search=${encodeURIComponent(searchQuery)}`
        : '';
      const res = await fetch(`/api/vault${moduleParam}${searchParam}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        setEvidence([]);
        return;
      }
      setEvidence(json.evidence ?? []);
    } catch {
      setError('Failed to fetch evidence');
      setEvidence([]);
    }

    // Fetch stats
    try {
      const statsRes = await fetch('/api/vault?stats=true');
      const statsJson = await statsRes.json();
      setStats(statsJson.stats ?? null);
    } catch {
      setStats(null);
    }

    setLoading(false);
  }, [moduleFilter, searchQuery]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  // Stats
  const totalFiles = stats?.totalFiles ?? (evidence ?? []).length;
  const totalSize = stats?.totalSize ?? (evidence ?? []).reduce((s, e) => s + (typeof e.fileSize === 'number' ? e.fileSize : 0), 0);
  const oldest = stats?.oldest ?? ((evidence ?? []).length > 0 ? (evidence ?? [])[(evidence ?? []).length - 1]?.createdAt : null);
  const newest = stats?.newest ?? ((evidence ?? []).length > 0 ? (evidence ?? [])[0]?.createdAt : null);

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[#FE5000]" />
          <h1 className="text-lg font-bold text-white">Evidence Vault</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchEvidence}
            disabled={loading}
            className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 bg-[#FE5000] hover:bg-[#E54800] rounded-lg px-4 py-2 text-sm text-white transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      <AIInsightsBanner module="vault" compact />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <File size={14} /> Total Files
          </div>
          <div className="text-lg font-bold text-white">{totalFiles}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <HardDrive size={14} /> Total Size
          </div>
          <div className="text-lg font-bold text-white">{fmtSize(totalSize)}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Clock size={14} /> Oldest
          </div>
          <div className="text-lg font-bold text-zinc-300">
            {oldest ? new Date(oldest).toLocaleDateString() : '--'}
          </div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Clock size={14} /> Newest
          </div>
          <div className="text-lg font-bold text-zinc-300">
            {newest ? new Date(newest).toLocaleDateString() : '--'}
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      {showUpload && (
        <div
          className={`mb-6 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-[#FE5000] bg-orange-900/10'
              : 'border-zinc-700 bg-zinc-900/50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
        >
          <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">Drag and drop files here, or click to browse</p>
          <p className="text-xs text-zinc-600 mt-0.5">Supports PDF, Excel, CSV, images, and documents</p>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search evidence by filename, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#FE5000] transition-colors"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#FE5000]"
        >
          {MODULE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 'all' ? 'All Modules' : m.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : error !== null ? (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {String(error)}
        </div>
      ) : (evidence ?? []).length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Shield size={40} className="mx-auto mb-2 opacity-50" />
          <p>No evidence found</p>
          <p className="text-xs mt-0.5">Upload files to the evidence vault</p>
        </div>
      ) : (
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left px-3 py-2">ID</th>
                <th className="text-left px-3 py-2">Module</th>
                <th className="text-left px-3 py-2">Source ID</th>
                <th className="text-left px-3 py-2">File</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Size</th>
                <th className="text-left px-3 py-2">Hash (SHA-256)</th>
                <th className="text-left px-3 py-2">Uploaded By</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-center px-3 py-2">Integrity</th>
              </tr>
            </thead>
            <tbody>
              {(evidence ?? []).map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-xs text-zinc-400">{entry.id}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 uppercase">
                      {entry.sourceModule}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">{entry.sourceId}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {fileIcon(entry.fileType)}
                      <span className="text-zinc-200 truncate max-w-[200px]">{entry.fileName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-500 text-xs">{entry.fileType}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-400 text-xs">
                    {fmtSize(entry.fileSize)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1 font-mono text-xs text-zinc-500">
                      <Hash size={10} />
                      {truncHash(entry.checksum)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-400 text-xs">{entry.uploadedBy}</td>
                  <td className="px-3 py-2 text-zinc-400 text-xs">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '--'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {entry.verified !== false ? (
                      <CheckCircle2 size={14} className="mx-auto text-green-500" />
                    ) : (
                      <AlertTriangle size={14} className="mx-auto text-yellow-500" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
