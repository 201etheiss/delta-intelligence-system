/**
 * GET  /api/contracts  — List contracts (?type=&status=&expiring=90)
 * POST /api/contracts  — Create a new contract
 * PATCH /api/contracts — Update contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getContracts,
  createContract,
  updateContract,
  getContractSummary,
  generateRenewalAlerts,
  type ContractType,
  type ContractStatus,
  type CreateContractInput,
} from '@/lib/engines/contracts';

async function getUser(_req: NextRequest) {
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
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;

    if (params.get('summary') === 'true') {
      const summary = getContractSummary();
      return NextResponse.json({ success: true, data: summary });
    }

    if (params.get('alerts') === 'true') {
      const updated = generateRenewalAlerts();
      return NextResponse.json({ success: true, data: updated, count: updated.length });
    }

    const type = params.get('type') as ContractType | null;
    const status = params.get('status') as ContractStatus | null;
    const expiring = params.get('expiring');

    const contracts = getContracts({
      type: type ?? undefined,
      status: status ?? undefined,
      expiring: expiring ? parseInt(expiring, 10) : undefined,
    });

    return NextResponse.json({ success: true, data: contracts, count: contracts.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list contracts';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const body = (await req.json()) as CreateContractInput;
    const contract = createContract(body);

    return NextResponse.json({ success: true, data: contract }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create contract';
    const status = msg.includes('required') ? 400 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const body = (await req.json()) as { id: string; [key: string]: unknown };
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const { id, ...patch } = body;
    const updated = updateContract(id, patch as Parameters<typeof updateContract>[1]);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update contract';
    const status = msg.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
