'use client';

import React from 'react';
import { useDensity } from '@/components/density/DensityProvider';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface DensityChartProps {
  type: 'bar' | 'line' | 'area';
  data: DataPoint[];
  height?: number;
  title?: string;
}

const DEFAULT_COLOR = '#fe5000';

function normalizeValues(data: DataPoint[]): number[] {
  const max = Math.max(...data.map((d) => d.value), 1);
  return data.map((d) => d.value / max);
}

function ExecutiveBarChart({ data, height }: { data: DataPoint[]; height: number }) {
  const normalized = normalizeValues(data);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '4px',
        height: `${height}px`,
        width: '100%',
      }}
    >
      {data.map((d, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            height: '100%',
            justifyContent: 'flex-end',
            gap: '4px',
          }}
        >
          <div
            style={{
              width: '100%',
              height: `${normalized[i] * (height - 20)}px`,
              background: d.color ?? DEFAULT_COLOR,
              borderRadius: '3px 3px 0 0',
              minHeight: '2px',
              transition: 'height 0.2s ease',
            }}
          />
          <div
            style={{
              fontSize: '9px',
              color: '#71717a',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExecutiveLineChart({
  data,
  height,
  area,
}: {
  data: DataPoint[];
  height: number;
  area: boolean;
}) {
  const normalized = normalizeValues(data);
  const chartHeight = height - 20; // reserve bottom for labels
  const segmentWidth = data.length > 1 ? 100 / (data.length - 1) : 100;

  const points = normalized.map((v, i) => ({
    x: i * segmentWidth,
    y: (1 - v) * chartHeight,
  }));

  const svgPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const fillPath = area
    ? `${svgPath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`
    : '';

  return (
    <div style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
      <svg
        viewBox={`0 0 100 ${chartHeight}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${chartHeight}px`, display: 'block' }}
      >
        {area && (
          <path
            d={fillPath}
            fill={DEFAULT_COLOR}
            fillOpacity={0.15}
          />
        )}
        <path
          d={svgPath}
          fill="none"
          stroke={DEFAULT_COLOR}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2"
            fill={data[i].color ?? DEFAULT_COLOR}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          height: '20px',
          alignItems: 'center',
          paddingTop: '2px',
        }}
      >
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              fontSize: '9px',
              color: '#71717a',
              textAlign: 'center',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function OperatorSparkline({ data, type }: { data: DataPoint[]; type: 'bar' | 'line' | 'area' }) {
  const normalized = normalizeValues(data);
  const sparkHeight = 32;

  if (type === 'bar') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1px',
          height: `${sparkHeight}px`,
          width: '100%',
        }}
      >
        {normalized.map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${Math.max(v * sparkHeight, 2)}px`,
              background: data[i].color ?? DEFAULT_COLOR,
              borderRadius: '1px 1px 0 0',
              opacity: 0.85,
            }}
          />
        ))}
      </div>
    );
  }

  // Line / area sparkline via SVG
  const points = normalized.map((v, i) => ({
    x: i * (100 / Math.max(data.length - 1, 1)),
    y: (1 - v) * sparkHeight,
  }));

  const svgPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const fillPath =
    type === 'area'
      ? `${svgPath} L ${points[points.length - 1].x} ${sparkHeight} L ${points[0].x} ${sparkHeight} Z`
      : '';

  return (
    <svg
      viewBox={`0 0 100 ${sparkHeight}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: `${sparkHeight}px`, display: 'block' }}
    >
      {type === 'area' && (
        <path d={fillPath} fill={DEFAULT_COLOR} fillOpacity={0.15} />
      )}
      <path
        d={svgPath}
        fill="none"
        stroke={DEFAULT_COLOR}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function DensityChart({ type, data, height = 200, title }: DensityChartProps) {
  const mode = useDensity();

  if (mode === 'executive') {
    return (
      <div style={{ width: '100%' }}>
        {title && (
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#a1a1aa',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '8px',
            }}
          >
            {title}
          </div>
        )}
        {type === 'bar' ? (
          <ExecutiveBarChart data={data} height={height} />
        ) : (
          <ExecutiveLineChart data={data} height={height} area={type === 'area'} />
        )}
      </div>
    );
  }

  // Operator mode — compact sparkline, no labels, no title
  return (
    <div style={{ width: '100%', height: '32px' }}>
      <OperatorSparkline data={data} type={type} />
    </div>
  );
}
