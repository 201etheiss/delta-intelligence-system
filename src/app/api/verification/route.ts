/**
 * Verification API Route
 *
 * GET: Run all verification gates (or a specific gate via ?gate=DataIntegrity)
 * POST: Trigger a verification run and store results
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  runAllGates,
  runGate,
  getVerificationHistory,
  getAvailableGates,
  type GateName,
} from '@/lib/verification-gates';
import { recordGateFailure } from '@/lib/feedback-loop';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const gateName = req.nextUrl.searchParams.get('gate');
    const mode = req.nextUrl.searchParams.get('mode');

    // List available gates
    if (mode === 'list') {
      return NextResponse.json({ gates: getAvailableGates() });
    }

    // History mode
    if (mode === 'history') {
      const limitStr = req.nextUrl.searchParams.get('limit');
      const limit = limitStr ? parseInt(limitStr, 10) : 20;
      const history = getVerificationHistory(isNaN(limit) ? 20 : limit);
      return NextResponse.json({ history });
    }

    // Run specific gate
    if (gateName) {
      const available = getAvailableGates();
      if (!available.includes(gateName as GateName)) {
        return NextResponse.json(
          { error: `Unknown gate: ${gateName}. Available: ${available.join(', ')}` },
          { status: 400 }
        );
      }
      const result = runGate(gateName as GateName);

      // Record failures to feedback loop
      for (const check of result.checks) {
        if (!check.passed) {
          recordGateFailure(result.gate, check.name, check.severity, check.message);
        }
      }

      return NextResponse.json({ gate: result });
    }

    // Run all gates
    const result = runAllGates();

    // Record failures to feedback loop
    for (const gate of result.gates) {
      for (const check of gate.checks) {
        if (!check.passed) {
          recordGateFailure(gate.gate, check.name, check.severity, check.message);
        }
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification run failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const result = runAllGates();

    // Record failures to feedback loop
    for (const gate of result.gates) {
      for (const check of gate.checks) {
        if (!check.passed) {
          recordGateFailure(gate.gate, check.name, check.severity, check.message);
        }
      }
    }

    return NextResponse.json({
      ...result,
      triggeredBy: session.user.email,
      message: 'Verification run completed and stored',
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification run failed' },
      { status: 500 }
    );
  }
}
