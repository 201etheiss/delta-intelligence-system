'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { UploadedFile } from '@/app/api/upload/route';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg';
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.includes(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'png', 'jpg', 'jpeg'].includes(ext);
}

interface FileItem {
  raw: File;
  result?: UploadedFile;
  error?: string;
}

export default function UploadZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const valid = list.filter(isAcceptedFile);
    if (!valid.length) {
      setUploadError('No supported file types found. Accepted: PDF, DOCX, XLSX, CSV, TXT, PNG, JPG.');
      return;
    }
    setUploadError(null);
    setFiles(valid.map((f) => ({ raw: f })));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const handleUpload = useCallback(async () => {
    if (!files.length) return;
    setIsUploading(true);
    setProgress(10);
    setUploadError(null);

    try {
      const formData = new FormData();
      for (const item of files) {
        formData.append('files', item.raw);
      }

      setProgress(40);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      setProgress(80);

      const data: { success: boolean; files?: UploadedFile[]; error?: string } = await response.json();

      if (!response.ok || !data.success) {
        setUploadError(data.error ?? `Upload failed (HTTP ${response.status})`);
        setIsUploading(false);
        setProgress(0);
        return;
      }

      const resultMap = new Map<string, UploadedFile>();
      for (const f of data.files ?? []) {
        resultMap.set(f.name, f);
      }

      setFiles((prev) =>
        prev.map((item) => ({
          ...item,
          result: resultMap.get(item.raw.name),
        }))
      );

      setProgress(100);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error during upload';
      setUploadError(message);
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  }, [files]);

  const uploadedFiles = files.filter((f) => f.result);
  const hasUploadedFiles = uploadedFiles.length > 0;

  const handleAskAboutFiles = useCallback(() => {
    const docs = uploadedFiles.map((f) => ({
      name: f.result!.name,
      content: f.result!.type === 'image' ? '[Image file — visual content]' : f.result!.content,
      type: f.result!.type,
    }));

    try {
      sessionStorage.setItem('di_chat_documents', JSON.stringify(docs));
    } catch {
      // sessionStorage full or unavailable
    }
    router.push('/chat');
  }, [uploadedFiles, router]);

  const handleClear = useCallback(() => {
    setFiles([]);
    setProgress(0);
    setUploadError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-8 py-12 cursor-pointer transition-colors',
          isDragging
            ? 'border-[#FE5000] bg-[#FE5000]/5'
            : 'border-zinc-700 bg-zinc-900 hover:border-[#FE5000]/60 hover:bg-zinc-800',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="sr-only"
          onChange={handleInputChange}
          aria-hidden="true"
        />

        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FE5000"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-zinc-200">
            Drag files here, or{' '}
            <span className="text-[#FE5000]">click to browse</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            PDF, DOCX, XLSX, CSV, TXT, PNG, JPG — max 10 MB each
          </p>
        </div>
      </div>

      {/* Error */}
      {uploadError && (
        <div className="rounded-md border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {uploadError}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
          {files.map((item) => (
            <div key={item.raw.name} className="px-4 py-3 space-y-2">
              {/* Header row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-zinc-800 text-zinc-400 border border-zinc-700">
                    {item.raw.name.split('.').pop()?.toUpperCase() ?? 'FILE'}
                  </span>
                  <span className="truncate text-sm text-zinc-200">{item.raw.name}</span>
                </div>
                <span className="flex-shrink-0 text-xs text-zinc-500">{formatBytes(item.raw.size)}</span>
              </div>

              {/* Content preview */}
              {item.result && (
                <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                  {item.result.type === 'image' ? (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.result.content}
                        alt={item.result.name}
                        className="h-16 w-16 rounded object-cover border border-zinc-700"
                      />
                      <span className="text-xs text-zinc-500">Image ready for visual analysis</span>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400 line-clamp-4">
                      {item.result.content.slice(0, 500)}
                      {item.result.content.length > 500 && (
                        <span className="text-zinc-600"> …{item.result.content.length - 500} more characters</span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {isUploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Extracting content…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-[#FE5000] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex gap-3">
          {!hasUploadedFiles ? (
            <button
              type="button"
              disabled={isUploading}
              onClick={handleUpload}
              className="flex-1 rounded-md bg-[#FE5000] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e04500] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Processing…' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAskAboutFiles}
              className="flex-1 rounded-md bg-[#FE5000] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e04500]"
            >
              Ask about {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}
            </button>
          )}

          <button
            type="button"
            onClick={handleClear}
            disabled={isUploading}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
