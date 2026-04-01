/**
 * GET  /api/assets/fixed  — List assets (?category=vehicles&status=active)
 * POST /api/assets/fixed  — Create asset
 * PATCH /api/assets/fixed — Update asset (dispose, reclassify)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getAssets,
  createAsset,
  updateAsset,
  disposeAsset,
  getAssetSummary,
  type AssetCategory,
  type AssetStatus,
  type CreateAssetInput,
} from '@/lib/engines/fixed-assets';

const ALLOWED_ROLES = new Set(['admin', 'accounting', 'operations']);

async function getUser() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const role = getUserRole(session.user.email);
    return { email: session.user.email, role };
  }
  if (process.env.NODE_ENV === 'development') {
    return { email: 'dev@delta360.energy', role: 'admin' as const };
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!ALLOWED_ROLES.has(user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const category = params.get('category') as AssetCategory | null;
    const status = params.get('status') as AssetStatus | null;
    const view = params.get('view');

    if (view === 'summary') {
      const summary = getAssetSummary();
      return NextResponse.json({ success: true, data: summary });
    }

    const assets = getAssets({
      category: category ?? undefined,
      status: status ?? undefined,
    });

    return NextResponse.json({ success: true, data: assets, count: assets.length });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load assets' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Only admin/accounting can create assets' }, { status: 403 });
    }

    const body = (await req.json()) as CreateAssetInput;

    if (!body.code || !body.description || !body.category || typeof body.cost !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: code, description, category, cost' },
        { status: 400 }
      );
    }

    const asset = createAsset(body);
    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to create asset' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Only admin/accounting can update assets' }, { status: 403 });
    }

    const body = (await req.json()) as {
      id: string;
      action?: 'dispose' | 'reclassify' | 'update';
      disposedDate?: string;
      disposalProceeds?: number;
      description?: string;
      category?: AssetCategory;
      profitCenter?: string;
      status?: AssetStatus;
      entityId?: string;
    };

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Asset id is required' }, { status: 400 });
    }

    if (body.action === 'dispose') {
      if (!body.disposedDate) {
        return NextResponse.json(
          { success: false, error: 'disposedDate is required for disposal' },
          { status: 400 }
        );
      }
      const result = disposeAsset(body.id, body.disposedDate, body.disposalProceeds ?? 0);
      if (!result) {
        return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: result });
    }

    const result = updateAsset(body.id, {
      description: body.description,
      category: body.category,
      profitCenter: body.profitCenter,
      status: body.status,
      entityId: body.entityId,
    });

    if (!result) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update asset' },
      { status: 500 }
    );
  }
}
