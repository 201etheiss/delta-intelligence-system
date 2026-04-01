'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartWidgetProps {
  title: string;
  endpoint: string;
  xKey: string;
  yKey: string;
  type: 'bar' | 'line';
}

type DataPoint = Record<string, unknown>;

export default function ChartWidget({ title, endpoint, xKey, yKey, type }: ChartWidgetProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/gateway/${endpoint}`, {
          headers: { 'x-user-role': 'admin' },
        });
        const json = await res.json() as { success: boolean; data?: unknown; error?: string };
        if (!cancelled) {
          if (json.success && Array.isArray(json.data)) {
            setData(json.data as DataPoint[]);
          } else {
            setError(json.error ?? 'Unexpected response format');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [endpoint]);

  return (
    <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E4E4E7] dark:border-[#27272A]">
        <h3 className="text-sm font-semibold text-[#09090B] dark:text-white">{title}</h3>
      </div>

      {/* Chart body */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="h-52 flex items-center justify-center">
            <div className="space-y-2 w-full">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 rounded bg-[#F4F4F5] dark:bg-[#27272A] animate-pulse" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="h-52 flex items-center justify-center text-sm text-red-500">
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm text-[#A1A1AA]">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={208}>
            {type === 'bar' ? (
              <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" vertical={false} />
                <XAxis
                  dataKey={xKey}
                  tick={{ fontSize: 11, fill: '#A1A1AA' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#A1A1AA' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#09090B',
                    border: '1px solid #27272A',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#FFFFFF',
                  }}
                  cursor={{ fill: '#F4F4F5' }}
                />
                <Bar dataKey={yKey} fill="#FE5000" radius={[3, 3, 0, 0]} maxBarSize={48} />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" vertical={false} />
                <XAxis
                  dataKey={xKey}
                  tick={{ fontSize: 11, fill: '#A1A1AA' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#A1A1AA' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#09090B',
                    border: '1px solid #27272A',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#FFFFFF',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={yKey}
                  stroke="#FE5000"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#FE5000', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
