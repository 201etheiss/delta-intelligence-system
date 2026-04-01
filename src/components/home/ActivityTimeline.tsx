'use client';

import React from 'react';

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

const PLACEHOLDER_EVENTS: TimelineEvent[] = [
  { id: '1', type: 'success', description: 'Close tracker updated — March period closed', relativeTime: '1h ago' },
  { id: '2', type: 'data', description: 'Ascend sync completed — 1,204 records ingested', relativeTime: '2h ago' },
  { id: '3', type: 'anomaly', description: 'GL variance detected on account 5020', relativeTime: '3h ago' },
  { id: '4', type: 'automation', description: 'AP aging report auto-generated and emailed', relativeTime: '5h ago' },
  { id: '5', type: 'success', description: 'Salesforce opportunity sync — 14 records updated', relativeTime: '7h ago' },
];

export function ActivityTimeline() {
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
        {PLACEHOLDER_EVENTS.map((event) => (
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
