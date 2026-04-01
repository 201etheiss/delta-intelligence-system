import { NextRequest, NextResponse } from 'next/server';
import { getWhiteLabelConfig } from '@/lib/white-label';

/**
 * GET /api/embed
 *
 * Returns a JavaScript snippet that other apps can include via <script>
 * to embed a Delta Intelligence chat widget.
 *
 * Query params (all optional):
 *   width       — iframe width (default: 400px)
 *   height      — iframe height (default: 600px)
 *   position    — bottom-right | bottom-left (default: bottom-right)
 *   theme       — dark | light (default: dark)
 *   workspace   — workspace slug to scope the chat
 *   type        — chat | kpi (default: chat)
 *   metrics     — comma-separated KPI metrics (for type=kpi)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const params = request.nextUrl.searchParams;
    const width = params.get('width') ?? '400';
    const height = params.get('height') ?? '600';
    const position = params.get('position') ?? 'bottom-right';
    const theme = params.get('theme') ?? 'dark';
    const workspace = params.get('workspace') ?? '';
    const type = params.get('type') ?? 'chat';
    const metrics = params.get('metrics') ?? '';

    const config = getWhiteLabelConfig();
    const origin = request.nextUrl.origin;

    const embedPath = type === 'kpi' ? '/embed/kpi' : '/embed/chat';
    const queryParts = [
      `theme=${encodeURIComponent(theme)}`,
      `position=${encodeURIComponent(position)}`,
    ];
    if (workspace) queryParts.push(`workspace=${encodeURIComponent(workspace)}`);
    if (metrics) queryParts.push(`metrics=${encodeURIComponent(metrics)}`);
    const embedUrl = `${origin}${embedPath}?${queryParts.join('&')}`;

    const positionStyles =
      position === 'bottom-left'
        ? 'bottom:16px;left:16px;'
        : 'bottom:16px;right:16px;';

    const snippet = `(function(){
  var d=document,f=d.createElement('iframe');
  f.src='${embedUrl}';
  f.style.cssText='position:fixed;${positionStyles}width:${width}px;height:${height}px;border:none;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:9999;';
  f.title='${config.platformName} Widget';
  f.allow='clipboard-write';
  d.body.appendChild(f);
})();`;

    return new NextResponse(snippet, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
