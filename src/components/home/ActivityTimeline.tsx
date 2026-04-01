'use client';

import React, { useEffect, useState } from 'react';

interface TimelineEvent {
  id: string;
  type: 'success' | 'anomaly' | 'data' | 'automation';
  description: string;
  relativeTime: string;
}

const DOT_COLORS: Record<TimelineEvent['type'], string> = {
  success: '#22C55E',
  anomaly: '#FE5000',
  data: '#3B82F6',
  automation: '#8B5CF6',
};

// Map event store event types → timeline types
function classifyEventType(type: string): TimelineEvent['type'] {
  if (type.startsWith('anomaly') || type.startsWith('alert')) return 'anomaly';
  if (type.startsWith('automation')) return 'automation';
  if (type.startsWith('close') || type.startsWith('journal') || type.startsWith('sync.completed')) return 'success';
  return 'data';
}

function formatRelativeTime(timestamp: string | undefined): string {
  if (!timestamp) return 'just now';
  try {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'recently';
  }
}

function buildDescription(ev: {
  type: string;
  payload?: Record<string, unknown>;
}): string {
  const payload = ev.payload ?? {};
  const desc = typeof payload.description === 'string' ? payload.description : null;
  if (desc) return desc;
  // Fallback: humanise the type
  return ev.type.replace(/\./g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

interface RawEvent {
  id?: string;
  type: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
}

export function ActivityTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/events?limit=10')
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { success: boolean; data?: RawEvent[] };
        const rawEvents = d.success && Array.isArray(d.data) ? d.data : [];

        if (rawEvents.length > 0) {
          const mapped: TimelineEvent[] = rawEvents.map((ev, idx) => ({
            id: ev.id ?? `ev-${idx}`,
            type: classifyEventType(ev.type),
            description: buildDescription(ev),
            relativeTime: formatRelativeTime(ev.timestamp),
          }));
          setEvents(mapped);
        } else {
          setEvents([]);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div style={{ padding: '12px 0', color: '#52525B', fontSize: '12px' }}>
        Loading activity...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #27272A',
          background: '#18181B',
          color: '#52525B',
          fontSize: '12px',
          textAlign: 'center',
        }}
      >
        No events recorded yet — events will appear as you use the platform
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        paddingBottom: '4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
          minWidth: 'max-content',
        }}
      >
        {events.map((event) => (
          <div
            key={event.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #27272A',
              background: '#18181B',
              minWidth: '220px',
              maxWidth: '260px',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: DOT_COLORS[event.type],
                flexShrink: 0,
                marginTop: '3px',
              }}
            />
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: '11px',
                  color: '#D4D4D8',
                  margin: 0,
                  lineHeight: '1.4',
                  whiteSpace: 'normal',
                }}
              >
                {event.description}
              </p>
              <p
                style={{
                  fontSize: '10px',
                  color: '#52525B',
                  margin: '4px 0 0',
                }}
              >
                {event.relativeTime}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
