'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getSessionState } from '@/lib/shell/session-state';
import type { SessionState } from '@/lib/shell/session-state';
import type { DailyBriefing, BriefingItem } from '@/lib/nova/briefing-engine';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function deriveFirstName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().split(/\s+/)[0] ?? '';
}

export function IntelligenceSummary() {
  const { data: authSession } = useSession();
  const [session, setSession] = useState<SessionState | null>(null);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [briefingError, setBriefingError] = useState(false);

  useEffect(() => {
    setSession(getSessionState());
  }, []);

  useEffect(() => {
    fetch('/api/nova/briefing')
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { success: boolean; data?: DailyBriefing };
        if (d.success && d.data) {
          setBriefing(d.data);
        } else {
          setBriefingError(true);
        }
      })
      .catch(() => setBriefingError(true));
  }, []);

  const firstName = deriveFirstName(authSession?.user?.name);
  const greeting = firstName ? `${getGreeting()}, ${firstName}` : 'Welcome';

  // Changes: items of type 'change'
  const changeItems = briefing?.items.filter((i) => i.type === 'change') ?? [];
  const changeSummaryLines = buildChangeSummary(briefing, changeItems);

  // Attention: action + alert items sorted by priority
  const attentionItems = (briefing?.items ?? []).filter(
    (i) => i.type === 'action' || i.type === 'alert'
  );
  const totalAttention = attentionItems.length;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
      }}
    >
      {/* Resume card — reads from session state as before */}
      <div
        style={{
          borderRadius: '8px',
          border: '1px solid rgba(254,80,0,0.25)',
          background: 'linear-gradient(135deg, rgba(254,80,0,0.08) 0%, rgba(254,80,0,0.03) 100%)',
          padding: '14px 16px',
        }}
      >
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#FE5000', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Resume
        </p>
        {session?.lastPage ? (
          <>
            <p style={{ fontSize: '12px', color: '#E4E4E7', margin: '6px 0 4px' }}>
              You were viewing{' '}
              <span style={{ fontWeight: 600, color: '#FE5000' }}>
                {session.lastPageContext || session.lastPage}
              </span>{' '}
              {session.lastModule ? (
                <>in <span style={{ fontWeight: 600 }}>{session.lastModule}</span></>
              ) : null}
            </p>
            <Link
              href={session.lastPage}
              style={{
                fontSize: '11px',
                color: '#FE5000',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Jump back →
            </Link>
          </>
        ) : (
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#E4E4E7', margin: '6px 0 0', fontFamily: 'Georgia, serif' }}>
            {greeting}
          </p>
        )}
      </div>

      {/* Changes card — populated from briefing data */}
      <div
        style={{
          borderRadius: '8px',
          border: '1px solid rgba(59,130,246,0.25)',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.03) 100%)',
          padding: '14px 16px',
        }}
      >
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Since Last Visit
        </p>
        {!briefing && !briefingError ? (
          <p style={{ fontSize: '11px', color: '#52525B', margin: '8px 0 0' }}>Loading...</p>
        ) : (
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {changeSummaryLines.map((line) => (
              <li
                key={line}
                style={{ fontSize: '11px', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'inline-block' }} />
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Attention card — populated from briefing action/alert items */}
      <div
        style={{
          borderRadius: '8px',
          border: '1px solid rgba(234,179,8,0.25)',
          background: 'linear-gradient(135deg, rgba(234,179,8,0.08) 0%, rgba(234,179,8,0.03) 100%)',
          padding: '14px 16px',
        }}
      >
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#EAB308', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Needs Attention
        </p>
        {!briefing && !briefingError ? (
          <p style={{ fontSize: '11px', color: '#52525B', margin: '8px 0 0' }}>Loading...</p>
        ) : attentionItems.length === 0 ? (
          <p style={{ fontSize: '11px', color: '#52525B', margin: '8px 0 0' }}>No action items</p>
        ) : (
          <>
            <ul style={{ margin: '8px 0 6px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {attentionItems.slice(0, 3).map((item) => (
                <li
                  key={item.id}
                  style={{ fontSize: '11px', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: item.priority === 'critical' ? '#EF4444' : '#EAB308',
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  {item.title}
                </li>
              ))}
            </ul>
            {totalAttention > 0 && (
              <Link
                href="/"
                style={{ fontSize: '11px', color: '#EAB308', textDecoration: 'none', fontWeight: 500 }}
              >
                View all {totalAttention} action item{totalAttention !== 1 ? 's' : ''} →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function buildChangeSummary(briefing: DailyBriefing | null, changeItems: BriefingItem[]): string[] {
  if (!briefing) return ['No data available'];
  const lines: string[] = [];

  for (const item of changeItems.slice(0, 3)) {
    lines.push(item.title);
  }

  if (briefing.stats.anomaliesDetected > 0) {
    lines.push(`${briefing.stats.anomaliesDetected} anomal${briefing.stats.anomaliesDetected !== 1 ? 'ies' : 'y'} detected`);
  }
  if (briefing.stats.automationRuns > 0) {
    lines.push(`${briefing.stats.automationRuns} automation${briefing.stats.automationRuns !== 1 ? 's' : ''} ran`);
  }

  if (lines.length === 0) {
    lines.push('No changes since last visit');
  }

  return lines;
}
