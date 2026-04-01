'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, AlertCircle, Bot, Zap, LogOut, Settings } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { AlertPopover } from './AlertPopover';
import { BotPopover } from './BotPopover';
import { AutomationPopover } from './AutomationPopover';

interface NovaBarProps {
  currentModule: string | null;
  currentPage: string;
  densityMode: 'executive' | 'operator';
  onDensityToggle: () => void;
  onNovaClick: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

type ActivePopover = 'alerts' | 'bots' | 'automations' | 'notifications' | null;

function deriveInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

export function NovaBar({
  currentModule,
  currentPage,
  densityMode,
  onDensityToggle,
  onNovaClick,
}: NovaBarProps) {
  const { data: session } = useSession();
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userAvatarRef = useRef<HTMLButtonElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alertCount, setAlertCount] = useState<number>(3);
  const [activeBotsCount, setActiveBotsCount] = useState<number>(0);
  const [automationCount, setAutomationCount] = useState<number>(0);

  const alertPillRef = useRef<HTMLButtonElement>(null);
  const botPillRef = useRef<HTMLButtonElement>(null);
  const automationPillRef = useRef<HTMLButtonElement>(null);
  const notifBellRef = useRef<HTMLButtonElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const placeholderNotifications: Notification[] = [
    {
      id: 'n1',
      title: 'GL Sync Complete',
      message: 'Ascend GL sync finished with 0 errors',
      read: false,
      createdAt: '2m ago',
    },
    {
      id: 'n2',
      title: 'New Budget Variance',
      message: 'Q2 OpEx exceeded by 4.2%',
      read: false,
      createdAt: '18m ago',
    },
    {
      id: 'n3',
      title: 'User Login',
      message: 'Blake McNeil logged in from new device',
      read: true,
      createdAt: '1h ago',
    },
  ];

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setNotifications(data as Notification[]);
        } else if (data && typeof data === 'object' && 'notifications' in data) {
          setNotifications((data as { notifications: Notification[] }).notifications ?? []);
        }
      })
      .catch(() => {
        setNotifications(placeholderNotifications);
      });

    // Use Nova briefing for alert count (critical + high priority items)
    fetch('/api/nova/briefing')
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { success: boolean; data?: { items?: Array<{ priority: string }> } };
        if (d.success && d.data?.items) {
          const urgentCount = d.data.items.filter(
            (i) => i.priority === 'critical' || i.priority === 'high'
          ).length;
          setAlertCount(urgentCount);
        }
      })
      .catch(() => {
        // Fall back to health-based count
        fetch('/api/admin/health')
          .then((r) => r.json())
          .then((data: unknown) => {
            const services = (data as { services?: Array<{ status: string }> })?.services ?? [];
            const errorCount = services.filter(
              (s) => s.status === 'error' || s.status === 'degraded'
            ).length;
            setAlertCount(errorCount);
          })
          .catch(() => setAlertCount(0));
      });

    fetch('/api/automations')
      .then((r) => r.json())
      .then((data: unknown) => {
        const list = (data as { automations?: Array<{ enabled: boolean; lastRunStatus: string | null }> })?.automations ?? [];
        setAutomationCount(list.length);
        setActiveBotsCount(list.filter((a) => a.enabled && a.lastRunStatus !== 'error').length);
      })
      .catch(() => {/* keep defaults */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node) &&
        userAvatarRef.current &&
        !userAvatarRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayNotifications =
    notifications.length > 0 ? notifications : placeholderNotifications;

  const unreadCount = displayNotifications.filter((n) => !n.read).length;

  const togglePopover = useCallback(
    (name: ActivePopover) => {
      setActivePopover((prev) => (prev === name ? null : name));
    },
    []
  );

  const closePopover = useCallback(() => setActivePopover(null), []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const inputPlaceholder = currentModule
    ? `Ask Nova... (viewing ${currentModule} — ${currentPage})`
    : `Ask Nova... (${currentPage})`;

  return (
    <div
      style={{
        width: '100%',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '10px',
        background: 'linear-gradient(90deg, #111113 0%, #18181b 50%, #111113 100%)',
        borderBottom: '1px solid #FE5000',
        position: 'relative',
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Nova Avatar */}
      <button
        onClick={onNovaClick}
        aria-label="Open Nova"
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FE5000 0%, #ff8c42 100%)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: '13px',
          flexShrink: 0,
          boxShadow: '0 0 10px rgba(254,80,0,0.4)',
          transition: 'box-shadow 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 16px rgba(254,80,0,0.7)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 10px rgba(254,80,0,0.4)';
        }}
      >
        N
      </button>

      {/* Nova Input */}
      <input
        type="text"
        placeholder={inputPlaceholder}
        style={{
          flex: 1,
          height: '30px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid #3f3f46',
          borderRadius: '6px',
          padding: '0 12px',
          color: '#e4e4e7',
          fontSize: '13px',
          outline: 'none',
          minWidth: 0,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#FE5000';
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(254,80,0,0.15)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#3f3f46';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />

      {/* Pills Group */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {/* Alerts Pill */}
        <div style={{ position: 'relative' }}>
          <button
            ref={alertPillRef}
            onClick={() => togglePopover('alerts')}
            title={alertCount > 0 ? `${alertCount} item${alertCount !== 1 ? 's' : ''} need your attention` : 'No alerts'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '20px',
              background:
                activePopover === 'alerts'
                  ? 'rgba(254,80,0,0.25)'
                  : 'rgba(254,80,0,0.12)',
              border: '1px solid rgba(254,80,0,0.35)',
              color: '#ff7043',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <AlertCircle size={12} />
            {alertCount} Alerts
          </button>
          <AlertPopover
            open={activePopover === 'alerts'}
            onClose={closePopover}
            triggerRef={alertPillRef as React.RefObject<HTMLElement | null>}
          />
        </div>

        {/* Bots Pill */}
        <div style={{ position: 'relative' }}>
          <button
            ref={botPillRef}
            onClick={() => togglePopover('bots')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '20px',
              background:
                activePopover === 'bots'
                  ? 'rgba(167,139,250,0.25)'
                  : 'rgba(167,139,250,0.12)',
              border: '1px solid rgba(167,139,250,0.35)',
              color: '#a78bfa',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <Bot size={12} />
            {activeBotsCount} Bots Active
          </button>
          <BotPopover
            open={activePopover === 'bots'}
            onClose={closePopover}
            triggerRef={botPillRef as React.RefObject<HTMLElement | null>}
          />
        </div>

        {/* Automations Pill */}
        <div style={{ position: 'relative' }}>
          <button
            ref={automationPillRef}
            onClick={() => togglePopover('automations')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '20px',
              background:
                activePopover === 'automations'
                  ? 'rgba(74,222,128,0.2)'
                  : 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.3)',
              color: '#4ade80',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <Zap size={12} />
            {automationCount} Automations
          </button>
          <AutomationPopover
            open={activePopover === 'automations'}
            onClose={closePopover}
            triggerRef={automationPillRef as React.RefObject<HTMLElement | null>}
          />
        </div>
      </div>

      {/* Density Toggle */}
      <div
        style={{
          display: 'flex',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid #3f3f46',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => {
            if (densityMode !== 'executive') onDensityToggle();
          }}
          title="Executive density"
          style={{
            padding: '4px 9px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            border: 'none',
            cursor: 'pointer',
            background:
              densityMode === 'executive' ? '#FE5000' : 'transparent',
            color: densityMode === 'executive' ? '#fff' : '#71717a',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          EX
        </button>
        <button
          onClick={() => {
            if (densityMode !== 'operator') onDensityToggle();
          }}
          title="Operator density"
          style={{
            padding: '4px 9px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            border: 'none',
            borderLeft: '1px solid #3f3f46',
            cursor: 'pointer',
            background:
              densityMode === 'operator' ? '#FE5000' : 'transparent',
            color: densityMode === 'operator' ? '#fff' : '#71717a',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          OP
        </button>
      </div>

      {/* Notification Bell */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          ref={notifBellRef}
          onClick={() => togglePopover('notifications')}
          aria-label="Notifications"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '6px',
            background:
              activePopover === 'notifications'
                ? 'rgba(255,255,255,0.1)'
                : 'transparent',
            border: '1px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a1a1aa',
            position: 'relative',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'rgba(255,255,255,0.08)';
            (e.currentTarget as HTMLButtonElement).style.color = '#e4e4e7';
          }}
          onMouseLeave={(e) => {
            if (activePopover !== 'notifications') {
              (e.currentTarget as HTMLButtonElement).style.background =
                'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa';
            }
          }}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '3px',
                right: '3px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#FE5000',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Dropdown */}
        {activePopover === 'notifications' && (
          <NotificationDropdown
            ref={notifDropdownRef}
            notifications={displayNotifications}
            onClose={closePopover}
            onMarkRead={markRead}
            triggerRef={notifBellRef as React.RefObject<HTMLElement | null>}
          />
        )}
      </div>

      {/* User Avatar + Dropdown */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          ref={userAvatarRef}
          onClick={() => setUserMenuOpen((prev) => !prev)}
          title={session?.user?.name ?? 'User menu'}
          aria-label="User menu"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: '#27272a',
            border: '1px solid #3f3f46',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#e4e4e7',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {deriveInitials(session?.user?.name)}
        </button>

        {userMenuOpen && (
          <div
            ref={userMenuRef}
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              width: '220px',
              background: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              zIndex: 1000,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            {/* Identity header */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid #27272a',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e7' }}>
                {session?.user?.name ?? 'User'}
              </div>
              <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
                {session?.user?.email ?? ''}
              </div>
              {(session?.user as { role?: string })?.role && (
                <div
                  style={{
                    marginTop: '6px',
                    display: 'inline-block',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    background: 'rgba(254,80,0,0.15)',
                    color: '#FE5000',
                    border: '1px solid rgba(254,80,0,0.3)',
                  }}
                >
                  {(session?.user as { role?: string }).role}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ padding: '6px 0' }}>
              <Link
                href="/settings"
                onClick={() => setUserMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  color: '#a1a1aa',
                  textDecoration: 'none',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#e4e4e7';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#a1a1aa';
                }}
              >
                <Settings size={13} />
                Settings
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 14px',
                  fontSize: '13px',
                  color: '#a1a1aa',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(254,80,0,0.08)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#FE5000';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa';
                }}
              >
                <LogOut size={13} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface NotificationDropdownProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

import { forwardRef } from 'react';

const NotificationDropdown = forwardRef<HTMLDivElement, NotificationDropdownProps>(
  ({ notifications, onClose, onMarkRead, triggerRef }, ref) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLDivElement>) ?? internalRef;

    useEffect(() => {
      const handleClick = (e: MouseEvent) => {
        if (
          resolvedRef.current &&
          !resolvedRef.current.contains(e.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node)
        ) {
          onClose();
        }
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose, triggerRef, resolvedRef]);

    return (
      <div
        ref={resolvedRef}
        style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          width: '320px',
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '8px',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Bell size={14} color="#e4e4e7" />
          <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 600 }}>
            Notifications
          </span>
          {notifications.filter((n) => !n.read).length > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                background: 'rgba(254,80,0,0.2)',
                color: '#FE5000',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {notifications.filter((n) => !n.read).length} unread
            </span>
          )}
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: '#52525b',
                fontSize: '13px',
              }}
            >
              No notifications
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #27272a',
                  background: notif.read ? 'transparent' : 'rgba(254,80,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  cursor: notif.read ? 'default' : 'pointer',
                }}
                onClick={() => {
                  if (!notif.read) onMarkRead(notif.id);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  {!notif.read && (
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#FE5000',
                        marginTop: '5px',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          color: notif.read ? '#a1a1aa' : '#e4e4e7',
                          fontSize: '13px',
                          fontWeight: notif.read ? 400 : 600,
                        }}
                      >
                        {notif.title}
                      </span>
                      <span style={{ color: '#52525b', fontSize: '11px', flexShrink: 0 }}>
                        {notif.createdAt}
                      </span>
                    </div>
                    <span style={{ color: '#71717a', fontSize: '12px' }}>
                      {notif.message}
                    </span>
                    {!notif.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkRead(notif.id);
                        }}
                        style={{
                          marginTop: '4px',
                          background: 'none',
                          border: 'none',
                          color: '#FE5000',
                          fontSize: '11px',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
);

NotificationDropdown.displayName = 'NotificationDropdown';
