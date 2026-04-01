import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  storeEvidence,
  getAllEvidence,
  getEvidenceBySource,
  searchEvidence,
  getEvidence,
  getEvidenceStats,
  validateChecksum,
  validateAllChecksums,
  type EvidenceSourceModule,
} from '@/lib/engines/evidence-vault';

const VALID_MODULES: readonly string[] = ['je', 'recon', 'close', 'report', 'audit', 'tax'];

/** Map engine evidence entry to page-expected shape */
function mapEntry(e: { id: string; sourceModule: string; sourceId: string; fileName: string; fileType: string; fileSizeBytes: number; checksumSha256: string; uploadedBy: string; uploadedAt: string; tags: readonly string[]; description: string }) {
  return {
    id: e.id,
    sourceModule: e.sourceModule,
    sourceId: e.sourceId,
    fileName: e.fileName,
    fileType: e.fileType,
    fileSize: e.fileSizeBytes,
    checksum: e.checksumSha256,
    uploadedBy: e.uploadedBy,
    description: e.description,
    tags: [...e.tags],
    verified: true,
    createdAt: e.uploadedAt,
  };
}

/**
 * GET /api/vault
 * Query params:
 *   ?module=recon&sourceId=X  → Filter by source
 *   ?search=query             → Search by filename/description/tags
 *   ?id=ev-xxx                → Get single entry
 *   ?stats=true               → Get vault statistics
 *   ?verifyAll=true           → Verify all checksums
 *   (no params)               → List all evidence
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const module = searchParams.get('module');
    const sourceId = searchParams.get('sourceId');
    const search = searchParams.get('search');
    const id = searchParams.get('id');
    const stats = searchParams.get('stats');
    const verifyAll = searchParams.get('verifyAll');

    if (verifyAll === 'true') {
      const results = validateAllChecksums();
      return NextResponse.json({ results });
    }

    if (stats === 'true') {
      const raw = getEvidenceStats();
      const sorted = [...raw.recentUploads].sort(
        (a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
      );
      const vaultStats = {
        totalFiles: raw.totalEntries,
        totalSize: raw.totalSizeBytes,
        oldest: sorted.length > 0 ? sorted[0].uploadedAt : null,
        newest: sorted.length > 0 ? sorted[sorted.length - 1].uploadedAt : null,
        byModule: raw.byModule,
      };
      return NextResponse.json({ stats: vaultStats });
    }

    if (id) {
      const entry = getEvidence(id);
      if (!entry) {
        return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
      }
      return NextResponse.json({ evidence: entry });
    }

    if (search) {
      const results = searchEvidence(search);
      return NextResponse.json({ evidence: results.map(mapEntry) });
    }

    if (module) {
      if (!VALID_MODULES.includes(module)) {
        return NextResponse.json(
          { error: `Invalid module. Must be one of: ${VALID_MODULES.join(', ')}` },
          { status: 400 }
        );
      }
      const results = getEvidenceBySource(module as EvidenceSourceModule, sourceId ?? undefined);
      return NextResponse.json({ evidence: results.map(mapEntry) });
    }

    const all = getAllEvidence();
    return NextResponse.json({ evidence: all.map(mapEntry) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load evidence' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault
 * Upload evidence (multipart form data).
 * Fields: file, sourceModule, sourceId, uploadedBy, tags (comma-separated), description
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const sourceModule = formData.get('sourceModule') as string | null;
    const sourceId = formData.get('sourceId') as string | null;
    const uploadedBy = formData.get('uploadedBy') as string | null;
    const tags = formData.get('tags') as string | null;
    const description = formData.get('description') as string | null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!sourceModule || !VALID_MODULES.includes(sourceModule)) {
      return NextResponse.json(
        { error: `sourceModule is required. Must be one of: ${VALID_MODULES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = file instanceof File ? file.name : 'unnamed';
    const fileType = file.type || 'application/octet-stream';

    const entry = storeEvidence(buffer, {
      sourceModule: sourceModule as EvidenceSourceModule,
      sourceId,
      fileName,
      fileType,
      uploadedBy: uploadedBy ?? session?.user?.email ?? 'system',
      tags: tags ? tags.split(',').map((t) => t.trim()) : [],
      description: description ?? '',
    });

    return NextResponse.json({ evidence: entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to store evidence' },
      { status: 500 }
    );
  }
}
