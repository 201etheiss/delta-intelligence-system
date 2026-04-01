import { NextRequest, NextResponse } from 'next/server';
import {
  getIngestionStatus,
  runIngestion,
  startIngestionLoop,
  stopIngestionLoop,
  isLoopActive,
  INGESTION_CONFIGS,
} from '@/lib/ingestion/ascend-ingestor';

export async function GET() {
  try {
    const status = getIngestionStatus();
    return NextResponse.json({
      loopActive: isLoopActive(),
      tables: status,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get ingestion status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { action?: string; tableName?: string };

    // Start/stop the loop
    if (body.action === 'start') {
      startIngestionLoop();
      return NextResponse.json({ ok: true, message: 'Ingestion loop started' });
    }

    if (body.action === 'stop') {
      stopIngestionLoop();
      return NextResponse.json({ ok: true, message: 'Ingestion loop stopped' });
    }

    // Manual run for a specific table
    if (body.tableName) {
      const config = INGESTION_CONFIGS.find((c) => c.tableName === body.tableName);
      if (!config) {
        return NextResponse.json(
          { error: `Unknown table: ${body.tableName}` },
          { status: 400 }
        );
      }

      const count = await runIngestion(config);
      return NextResponse.json({ ok: true, tableName: config.tableName, recordsIngested: count });
    }

    return NextResponse.json(
      { error: 'Provide action ("start"|"stop") or tableName' },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ingestion failed' },
      { status: 500 }
    );
  }
}
