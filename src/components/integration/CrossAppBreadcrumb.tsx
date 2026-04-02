'use client';

import { ChevronRight, ExternalLink } from 'lucide-react';
import { getExternalRoutes, type RouteMapping } from '@/lib/integration/route-map';
import { getApp } from '@/lib/integration/app-registry';
import { MODULE_GROUPS, SPOKE_MODULES } from '@/lib/shell/module-registry';

interface CrossAppBreadcrumbProps {
  currentPath: string;
  currentModule: string | null;
}

export default function CrossAppBreadcrumb({ currentPath, currentModule }: CrossAppBreadcrumbProps) {
  const allModules = [...MODULE_GROUPS, ...SPOKE_MODULES];
  const moduleInfo = allModules.find((m) => m.id === currentModule);
  const externalRoutes = getExternalRoutes(currentPath);

  // Find the page label from module registry
  const pageInfo = moduleInfo?.pages.find((p) => p.href === currentPath);
  const pageLabel = pageInfo?.label ?? currentPath.split('/').pop() ?? '';

  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-zinc-500 border-b border-zinc-800/50">
      {/* DI root */}
      <span className="text-zinc-400">Delta Intelligence</span>

      {/* Module */}
      {moduleInfo && (
        <>
          <ChevronRight className="h-3 w-3 text-zinc-600" />
          <span className="text-zinc-400">{moduleInfo.label}</span>
        </>
      )}

      {/* Page */}
      {pageLabel && pageLabel !== moduleInfo?.label && (
        <>
          <ChevronRight className="h-3 w-3 text-zinc-600" />
          <span className="text-zinc-300">{pageLabel}</span>
        </>
      )}

      {/* External links */}
      {externalRoutes.length > 0 && (
        <>
          <span className="mx-2 text-zinc-700">|</span>
          {externalRoutes.map((route: RouteMapping) => {
            const app = getApp(route.externalApp);
            if (!app) return null;
            const href = `${app.url}${route.externalPath}`;

            return (
              <a
                key={`${route.externalApp}-${route.externalPath}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-orange-500/70 hover:text-orange-400 transition-colors"
              >
                <span>{route.label}</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            );
          })}
        </>
      )}
    </div>
  );
}
