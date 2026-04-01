'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSessionState } from '@/lib/shell/session-state';
import type { SessionState } from '@/lib/shell/session-state';

export function IntelligenceSummary() {
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    setSession(getSessionState());
  }, []);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
      }}
    >
      {/* Resume card */}
      <div
        style={{
          borderRadius: '8px',
          border: '1px solid rgba(254,80,0,0.25)',
          background: 'rgba(254,80,0,0.05)',
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
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#E4E4E7', margin: '6px 0 0' }}>
            Welcome to Delta Intelligence
          </p>
        )}
      </div>

      {/* Changes card */}
      <div
        style={{
          borderRadius: '8px',
          border: '1px solid rgba(59,130,246,0.25)',
          background: 'rgba(59,130,246,0.05)',
          padding: '14px 16px',
        }}
      >
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Since Last Visit
        </p>
        <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            '7 new invoices',
            '3 deliveries completed',
            '1 anomaly detected',
            '2 automations ran',
          ].map((item) => (
            <li
              key={item}
              style={{ fontSize: '11px', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'inline-block' }} />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Attention card */}
      <div
        style={{
          borderRadius: '8px',
          border: '1px solid rgba(234,179,8,0.25)',
          background: 'rgba(234,179,8,0.05)',
          padding: '14px 16px',
        }}
      >
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#EAB308', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Needs Attention
        </p>
        <ul style={{ margin: '8px 0 6px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            '4 AP invoices past Net-30',
            '1 reconciliation exception',
            '2 Salesforce opps closing this week',
          ].map((item) => (
            <li
              key={item}
              style={{ fontSize: '11px', color: '#A1A1AA', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#EAB308', flexShrink: 0, display: 'inline-block' }} />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href="/exceptions"
          style={{ fontSize: '11px', color: '#EAB308', textDecoration: 'none', fontWeight: 500 }}
        >
          View all 7 action items →
        </Link>
      </div>
    </div>
  );
}
