import { NextResponse } from 'next/server';
import { getAllApps, getAppHealth, type AppHealth } from '@/lib/integration/app-registry';

// Cache health results for 30 seconds
let healthCache: { data: Record<string, AppHealth>; ts: number } | null = null;
const CACHE_TTL = 30_000;

export async function GET() {
  const apps = getAllApps();

  // Check cache
  const now = Date.now();
  if (healthCache && now - healthCache.ts < CACHE_TTL) {
    return NextResponse.json({
      success: true,
      data: apps.map((app) => ({
        ...app,
        health: healthCache!.data[app.id] ?? 'unknown',
      })),
    });
  }

  // Fetch fresh health
  const healthMap: Record<string, AppHealth> = {};
  await Promise.allSettled(
    apps.map(async (app) => {
      healthMap[app.id] = await getAppHealth(app.id);
    })
  );

  healthCache = { data: healthMap, ts: now };

  return NextResponse.json({
    success: true,
    data: apps.map((app) => ({
      ...app,
      health: healthMap[app.id] ?? 'unknown',
    })),
  });
}
