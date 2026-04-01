'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Shield,
  BarChart3,
  Activity,
  Plug,
  MessageSquare,
  Zap,
  Bell,
  Truck,
  CheckCircle,
  Circle,
  Clock,
  Eye,
  EyeOff,
  Send,
  Loader2,
  FileSearch,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'secret';
  required: boolean;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'messaging' | 'automation' | 'calendar' | 'fleet' | 'notifications';
  status: 'configured' | 'available' | 'coming_soon';
  configFields: ConfigField[];
}

// ── Constants ────────────────────────────────────────────────

const ADMIN_TABS = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/permissions', label: 'Permissions', icon: Shield },
  { href: '/admin/usage', label: 'Usage', icon: BarChart3 },
  { href: '/admin/health', label: 'Health', icon: Activity },
  { href: '/admin/integrations', label: 'Integrations', icon: Plug },
  { href: '/admin/audit', label: 'Audit', icon: FileSearch },
];

const CATEGORY_ICONS: Record<string, typeof MessageSquare> = {
  messaging: MessageSquare,
  automation: Zap,
  notifications: Bell,
  fleet: Truck,
  calendar: Clock,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: typeof CheckCircle }> = {
  configured: { label: 'Configured', color: 'text-green-400 bg-green-400/10 border-green-400/20', Icon: CheckCircle },
  available: { label: 'Available', color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20', Icon: Circle },
  coming_soon: { label: 'Coming Soon', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', Icon: Clock },
};

// ── Component ────────────────────────────────────────────────

export default function AdminIntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Config panel
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/integrations');
      const data = await res.json();
      if (data.integrations) {
        setIntegrations(data.integrations);
      } else {
        setError(data.error ?? 'Failed to load integrations');
      }
    } catch {
      setError('Unable to reach integrations API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const openConfig = async (integration: Integration) => {
    clearMessages();
    setActiveId(integration.id);

    // Load existing config values
    try {
      const res = await fetch('/api/admin/integrations');
      const data = await res.json();
      const found = (data.integrations ?? []).find(
        (i: Integration) => i.id === integration.id
      );
      // Initialize form with empty strings for all fields
      const initial: Record<string, string> = {};
      for (const field of integration.configFields) {
        initial[field.key] = '';
      }
      // We don't have saved values in the GET response (secrets are hidden),
      // so start with empty form
      setFormValues(initial);
      setShowSecrets({});
    } catch {
      // Start with empty form on error
      const initial: Record<string, string> = {};
      for (const field of integration.configFields) {
        initial[field.key] = '';
      }
      setFormValues(initial);
    }
  };

  const handleSave = async () => {
    if (!activeId) return;
    clearMessages();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeId, values: formValues }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`${activeId} configuration saved`);
        fetchIntegrations();
      } else {
        setError(data.error ?? 'Failed to save configuration');
      }
    } catch {
      setError('Unable to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!activeId) return;
    clearMessages();
    setTesting(true);

    try {
      const res = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeId }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ?? `${activeId} test passed`);
      } else {
        setError(data.error ?? `${activeId} test failed`);
      }
    } catch {
      setError('Unable to test integration');
    } finally {
      setTesting(false);
    }
  };

  const activeIntegration = integrations.find((i) => i.id === activeId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#09090B]">
        <Loader2 className="animate-spin text-[#FE5000]" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#09090B] text-white overflow-hidden">
      {/* Admin tab bar */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-2 border-b border-[#27272A]">
        {ADMIN_TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin/integrations';
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-[#FE5000]/10 text-[#FE5000]'
                  : 'text-[#71717A] dark:text-[#A1A1AA] hover:text-white hover:bg-[#18181B]',
              ].join(' ')}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mx-6 mt-3 px-4 py-2 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          {success}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Integration cards grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h2 className="text-lg font-semibold mb-2.5">Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {integrations.map((integration) => {
              const CategoryIcon = CATEGORY_ICONS[integration.category] ?? Plug;
              const statusCfg = STATUS_CONFIG[integration.status] ?? STATUS_CONFIG.available;
              const isActive = activeId === integration.id;

              return (
                <button
                  key={integration.id}
                  onClick={() => openConfig(integration)}
                  className={[
                    'text-left p-4 rounded-lg border transition-colors',
                    isActive
                      ? 'border-[#FE5000]/50 bg-[#FE5000]/5'
                      : 'border-[#27272A] bg-[#18181B] hover:border-[#3F3F46]',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CategoryIcon size={18} className="text-[#A1A1AA]" />
                      <span className="font-medium">{integration.name}</span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${statusCfg.color}`}
                    >
                      <statusCfg.Icon size={10} />
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] line-clamp-2">
                    {integration.description}
                  </p>
                  <div className="mt-2">
                    <span className="text-[9px] uppercase tracking-widest text-[#52525B]">
                      {integration.category}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Config panel (right side) */}
        {activeIntegration && (
          <div className="w-80 xl:w-96 border-l border-[#27272A] bg-[#0F0F11] overflow-y-auto p-3.5">
            <h3 className="text-xs font-semibold mb-1">
              Configure {activeIntegration.name}
            </h3>
            <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mb-2.5">
              {activeIntegration.description}
            </p>

            <div className="space-y-3">
              {activeIntegration.configFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-[#A1A1AA] mb-1">
                    {field.label}
                    {field.required && (
                      <span className="text-[#FE5000] ml-0.5">*</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={
                        field.type === 'secret' && !showSecrets[field.key]
                          ? 'password'
                          : 'text'
                      }
                      value={formValues[field.key] ?? ''}
                      onChange={(e) =>
                        setFormValues({ ...formValues, [field.key]: e.target.value })
                      }
                      placeholder={
                        field.type === 'url'
                          ? 'https://...'
                          : field.type === 'secret'
                            ? 'Enter secret...'
                            : 'Enter value...'
                      }
                      className="w-full bg-[#18181B] border border-[#27272A] rounded px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#FE5000]/50 focus:outline-none"
                    />
                    {field.type === 'secret' && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecrets({
                            ...showSecrets,
                            [field.key]: !showSecrets[field.key],
                          })
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA]"
                      >
                        {showSecrets[field.key] ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-[#FE5000] text-white text-sm font-medium hover:bg-[#CC4000] disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Save
              </button>
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-2 px-3 py-2 rounded border border-[#27272A] text-sm text-[#A1A1AA] hover:text-white hover:border-[#3F3F46] disabled:opacity-50 transition-colors"
              >
                {testing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Test
              </button>
            </div>

            <button
              onClick={() => {
                setActiveId(null);
                clearMessages();
              }}
              className="mt-3 w-full text-center text-xs text-[#52525B] hover:text-[#A1A1AA] transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
