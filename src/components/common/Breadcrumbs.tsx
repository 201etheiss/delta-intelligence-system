'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbSegment {
  label: string;
  href: string;
}

const LABEL_MAP: Record<string, string> = {
  admin: 'Admin',
  users: 'Users',
  permissions: 'Permissions',
  integrations: 'Integrations',
  audit: 'Audit Log',
  health: 'Health',
  usage: 'Usage',
  reports: 'Reports',
  templates: 'Templates',
  dashboards: 'Dashboards',
  shared: 'Shared',
  settings: 'Settings',
};

function segmentLabel(segment: string): string {
  return LABEL_MAP[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

export default function Breadcrumbs() {
  const pathname = usePathname();

  if (!pathname) return null;

  const segments = pathname.split('/').filter(Boolean);

  // Only show breadcrumbs for nested pages (2+ segments)
  if (segments.length < 2) return null;

  const crumbs: BreadcrumbSegment[] = [
    { label: 'Dashboard', href: '/' },
  ];

  let path = '';
  for (const seg of segments) {
    // Skip dynamic segments like [id] — show them as the last item only
    if (seg.startsWith('[') || seg.match(/^[a-f0-9-]{8,}$/)) {
      crumbs.push({ label: 'Detail', href: `${path}/${seg}` });
    } else {
      path += `/${seg}`;
      crumbs.push({ label: segmentLabel(seg), href: path });
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 px-6 py-2 text-xs">
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {idx > 0 && (
              <svg className="w-3 h-3 text-[#52525B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
            {isLast ? (
              <span className="text-[#A1A1AA] font-medium">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-[#71717A] hover:text-white transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
