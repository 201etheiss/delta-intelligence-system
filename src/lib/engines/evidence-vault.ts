/**
 * Evidence Vault Engine
 * Immutable evidence storage with SHA-256 checksums for tamper detection.
 * File persistence: data/evidence-index.json (metadata), data/evidence/ (files).
 * NEVER allows overwrite or delete — all entries are immutable.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EvidenceSourceModule = 'je' | 'recon' | 'close' | 'report' | 'audit' | 'tax';

export interface EvidenceEntry {
  readonly id: string;
  readonly sourceModule: EvidenceSourceModule;
  readonly sourceId: string;
  readonly fileName: string;
  readonly fileType: string;
  readonly fileSizeBytes: number;
  readonly checksumSha256: string;
  readonly uploadedBy: string;
  readonly uploadedAt: string;
  readonly immutable: true;
  readonly tags: readonly string[];
  readonly description: string;
}

export interface EvidenceStats {
  readonly totalEntries: number;
  readonly totalSizeBytes: number;
  readonly byModule: Readonly<Record<string, number>>;
  readonly recentUploads: readonly EvidenceEntry[];
}

export interface ChecksumResult {
  readonly id: string;
  readonly fileName: string;
  readonly storedChecksum: string;
  readonly currentChecksum: string;
  readonly valid: boolean;
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), 'data');
const INDEX_FILE = join(DATA_DIR, 'evidence-index.json');
const EVIDENCE_DIR = join(DATA_DIR, 'evidence');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(EVIDENCE_DIR)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

function readIndex(): readonly EvidenceEntry[] {
  ensureDataDir();
  if (!existsSync(INDEX_FILE)) return [];
  try {
    const raw = readFileSync(INDEX_FILE, 'utf-8');
    return JSON.parse(raw) as EvidenceEntry[];
  } catch {
    return [];
  }
}

function writeIndex(entries: readonly EvidenceEntry[]): void {
  ensureDataDir();
  writeFileSync(INDEX_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ev-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Store evidence immutably.
 * Computes SHA-256 checksum, writes file to data/evidence/, logs to index.
 */
export function storeEvidence(
  fileBuffer: Buffer,
  metadata: {
    sourceModule: EvidenceSourceModule;
    sourceId: string;
    fileName: string;
    fileType: string;
    uploadedBy: string;
    tags?: readonly string[];
    description?: string;
  }
): EvidenceEntry {
  ensureDataDir();

  const id = generateId();
  const checksum = computeSha256(fileBuffer);

  // Write file with ID prefix to prevent collisions
  const storedName = `${id}_${metadata.fileName}`;
  const filePath = join(EVIDENCE_DIR, storedName);
  writeFileSync(filePath, fileBuffer);

  const entry: EvidenceEntry = {
    id,
    sourceModule: metadata.sourceModule,
    sourceId: metadata.sourceId,
    fileName: metadata.fileName,
    fileType: metadata.fileType,
    fileSizeBytes: fileBuffer.length,
    checksumSha256: checksum,
    uploadedBy: metadata.uploadedBy,
    uploadedAt: new Date().toISOString(),
    immutable: true,
    tags: metadata.tags ?? [],
    description: metadata.description ?? '',
  };

  const existing = readIndex();
  writeIndex([...existing, entry]);

  return entry;
}

/**
 * Get a single evidence entry by ID.
 */
export function getEvidence(id: string): EvidenceEntry | null {
  const entries = readIndex();
  return entries.find((e) => e.id === id) ?? null;
}

/**
 * Get evidence entries by source module and optional source ID.
 */
export function getEvidenceBySource(
  module: EvidenceSourceModule,
  sourceId?: string
): readonly EvidenceEntry[] {
  const entries = readIndex();
  return entries.filter(
    (e) => e.sourceModule === module && (!sourceId || e.sourceId === sourceId)
  );
}

/**
 * Search evidence by query string (matches fileName, description, tags).
 */
export function searchEvidence(query: string): readonly EvidenceEntry[] {
  const entries = readIndex();
  const q = query.toLowerCase();
  return entries.filter(
    (e) =>
      e.fileName.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
  );
}

/**
 * Get evidence vault statistics.
 */
export function getEvidenceStats(): EvidenceStats {
  const entries = readIndex();
  const totalSizeBytes = entries.reduce((sum, e) => sum + e.fileSizeBytes, 0);

  const byModule: Record<string, number> = {};
  for (const e of entries) {
    byModule[e.sourceModule] = (byModule[e.sourceModule] ?? 0) + 1;
  }

  const recentUploads = [...entries]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 10);

  return { totalEntries: entries.length, totalSizeBytes, byModule, recentUploads };
}

/**
 * Validate checksum for a single evidence entry (tamper detection).
 * Re-hashes the stored file and compares to recorded checksum.
 */
export function validateChecksum(id: string): ChecksumResult | null {
  const entry = getEvidence(id);
  if (!entry) return null;

  const storedName = `${id}_${entry.fileName}`;
  const filePath = join(EVIDENCE_DIR, storedName);

  if (!existsSync(filePath)) {
    return {
      id,
      fileName: entry.fileName,
      storedChecksum: entry.checksumSha256,
      currentChecksum: 'FILE_MISSING',
      valid: false,
    };
  }

  const fileBuffer = readFileSync(filePath);
  const currentChecksum = computeSha256(fileBuffer);

  return {
    id,
    fileName: entry.fileName,
    storedChecksum: entry.checksumSha256,
    currentChecksum,
    valid: currentChecksum === entry.checksumSha256,
  };
}

/**
 * Validate all checksums in the vault.
 */
export function validateAllChecksums(): readonly ChecksumResult[] {
  const entries = readIndex();
  return entries.map((e) => {
    const result = validateChecksum(e.id);
    if (!result) {
      return {
        id: e.id,
        fileName: e.fileName,
        storedChecksum: e.checksumSha256,
        currentChecksum: 'INDEX_ERROR',
        valid: false,
      };
    }
    return result;
  });
}

/**
 * Get all evidence entries.
 */
export function getAllEvidence(): readonly EvidenceEntry[] {
  return readIndex();
}

/**
 * Get the file path for an evidence entry (for serving downloads).
 */
export function getEvidenceFilePath(id: string): string | null {
  const entry = getEvidence(id);
  if (!entry) return null;

  const storedName = `${id}_${entry.fileName}`;
  const filePath = join(EVIDENCE_DIR, storedName);

  if (!existsSync(filePath)) return null;
  return filePath;
}
