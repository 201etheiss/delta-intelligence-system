'use client';

interface SpokeStatusBadgeProps {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<SpokeStatusBadgeProps['status'], string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500 animate-pulse',
  down: 'bg-red-500',
  unknown: 'bg-zinc-500',
};

const STATUS_LABELS: Record<SpokeStatusBadgeProps['status'], string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unknown',
};

export default function SpokeStatusBadge({ status, size = 'sm' }: SpokeStatusBadgeProps) {
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3';

  return (
    <span
      className={`inline-block rounded-full ${dotSize} ${STATUS_COLORS[status]}`}
      title={STATUS_LABELS[status]}
      role="status"
      aria-label={`Status: ${STATUS_LABELS[status]}`}
    />
  );
}
