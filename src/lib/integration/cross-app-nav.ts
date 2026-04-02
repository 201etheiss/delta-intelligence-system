/**
 * Cross-App Navigation Helpers
 * Utilities for navigating between Delta360 apps.
 */

import { getApp, getAllApps, type AppInfo } from './app-registry';
import { getExternalRoutes, type RouteMapping } from './route-map';

export interface RelatedApp {
  readonly app: AppInfo;
  readonly path: string;
  readonly fullUrl: string;
  readonly label: string;
  readonly dataFlow: RouteMapping['dataFlow'];
}

/**
 * Build a deep link URL to another app.
 * @param appId - Target app ID from app-registry
 * @param path - Path within the app
 * @param params - Optional query parameters
 * @returns Full URL string, or null if app not found
 */
export function buildDeepLink(
  appId: string,
  path: string,
  params?: Record<string, string>
): string | null {
  const app = getApp(appId);
  if (!app) return null;

  const url = new URL(path, app.url);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

/**
 * Build a return link back to DI from an external app.
 * External apps can use this to link back to the DI page the user came from.
 */
export function buildDIReturnLink(currentDIPath: string): string {
  const diApp = getApp('delta-intelligence');
  if (!diApp) return currentDIPath;
  return `${diApp.url}${currentDIPath}`;
}

/**
 * Get all related external app pages for a given DI path.
 * Used by AppSwitcher and CrossAppBreadcrumb to show "Related in [App]" links.
 */
export function getRelatedApps(diPath: string): readonly RelatedApp[] {
  const mappings = getExternalRoutes(diPath);

  return mappings
    .map((mapping) => {
      const app = getApp(mapping.externalApp);
      if (!app) return null;

      const fullUrl = `${app.url}${mapping.externalPath}`;

      return {
        app,
        path: mapping.externalPath,
        fullUrl,
        label: mapping.label,
        dataFlow: mapping.dataFlow,
      };
    })
    .filter((item): item is RelatedApp => item !== null);
}

/**
 * Parse an incoming URL to determine which Delta360 app and page it points to.
 * Useful for handling cross-app navigation events.
 */
export function parseIncomingLink(
  urlString: string
): { appId: string; path: string; params: Record<string, string> } | null {
  try {
    const url = new URL(urlString);
    const apps = getAllApps();

    for (const app of apps) {
      const appUrl = new URL(app.url);
      if (url.hostname === appUrl.hostname && url.port === appUrl.port) {
        const params: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          params[key] = value;
        });

        return {
          appId: app.id,
          path: url.pathname,
          params,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get the data flow direction icon for display.
 * Returns a unicode arrow indicating data direction.
 */
export function getDataFlowIcon(dataFlow: RouteMapping['dataFlow']): string {
  switch (dataFlow) {
    case 'di-to-app': return '\u2192';
    case 'app-to-di': return '\u2190';
    case 'bidirectional': return '\u2194';
  }
}
