import { NextRequest, NextResponse } from 'next/server';
import { getApp } from '@/lib/integration/app-registry';
import { getDIRoute, getExternalRoutes } from '@/lib/integration/route-map';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.from?.app || !body?.from?.path || !body?.to?.app) {
    return NextResponse.json(
      { success: false, error: 'Required: from.app, from.path, to.app' },
      { status: 400 }
    );
  }

  const targetApp = getApp(body.to.app);
  if (!targetApp) {
    return NextResponse.json(
      { success: false, error: `Unknown app: ${body.to.app}` },
      { status: 404 }
    );
  }

  // If navigating FROM an external app TO DI
  if (body.from.app !== 'delta-intelligence') {
    const diRoute = getDIRoute(body.from.app, body.from.path);
    if (diRoute) {
      return NextResponse.json({
        success: true,
        data: {
          targetApp: 'delta-intelligence',
          targetPath: diRoute.diPath,
          label: diRoute.label,
          dataFlow: diRoute.dataFlow,
        },
      });
    }
  }

  // If navigating FROM DI TO an external app
  const externalRoutes = getExternalRoutes(body.from.path);
  const match = externalRoutes.find((r) => r.externalApp === body.to.app);
  if (match) {
    return NextResponse.json({
      success: true,
      data: {
        targetApp: match.externalApp,
        targetPath: match.externalPath,
        targetUrl: `${targetApp.url}${match.externalPath}`,
        label: match.label,
        dataFlow: match.dataFlow,
      },
    });
  }

  // No specific mapping — return app root
  return NextResponse.json({
    success: true,
    data: {
      targetApp: body.to.app,
      targetPath: '/',
      targetUrl: targetApp.url,
      label: targetApp.name,
      dataFlow: 'bidirectional',
    },
  });
}
