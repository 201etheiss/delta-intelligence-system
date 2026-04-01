import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down';
}

export default function KpiCard({ title, value, subtitle, trend }: KpiCardProps) {
  const trendColor = trend === 'up' ? 'text-[#FF5C00]' : trend === 'down' ? 'text-red-500' : '';

  return (
    <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-5 shadow-sm">
      <p className="text-xs font-medium text-[#71717A] dark:text-[#A1A1AA] uppercase tracking-wide">{title}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-bold text-[#09090B] dark:text-white font-mono">
          {value}
        </span>
        {trend && (
          <span className={`mb-0.5 flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            {trend === 'up' ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingDown size={14} />
            )}
            {trend === 'up' ? 'Up' : 'Down'}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-[#A1A1AA]">{subtitle}</p>
      )}
    </div>
  );
}
