'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Settings, Save, Check } from 'lucide-react';

type ModelPreference = 'auto' | 'haiku' | 'sonnet' | 'opus';
type DigestFrequency = 'daily' | 'weekly' | 'none';
type ExportFormat = 'xlsx' | 'csv' | 'pdf';
type DateRangeDefault = 'this_month' | 'this_quarter' | 'this_year' | 'last_30_days';

interface Preferences {
  userId: string;
  defaultModel: ModelPreference;
  defaultProfitCenter: string;
  defaultDateRange: DateRangeDefault;
  timezone: string;
  emailDigest: DigestFrequency;
  preferredFormat: ExportFormat;
  darkMode: boolean;
}

const MODEL_OPTIONS: { value: ModelPreference; label: string }[] = [
  { value: 'auto', label: 'Auto (recommended)' },
  { value: 'haiku', label: 'Haiku (fast, low cost)' },
  { value: 'sonnet', label: 'Sonnet (balanced)' },
  { value: 'opus', label: 'Opus (deep reasoning)' },
];

const DIGEST_OPTIONS: { value: DigestFrequency; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'pdf', label: 'PDF (.pdf)' },
];

const DATE_RANGE_OPTIONS: { value: DateRangeDefault; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_30_days', label: 'Last 30 Days' },
];

const TIMEZONE_OPTIONS = [
  'America/Chicago',
  'America/New_York',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? '';

  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync dark mode from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDark = localStorage.getItem('di_dark_mode') === 'true';
    if (prefs && prefs.darkMode !== isDark) {
      setPrefs((prev) => prev ? { ...prev, darkMode: isDark } : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const fetchPrefs = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await fetch(`/api/settings?userId=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      if (data.preferences) {
        // Sync dark mode from localStorage (source of truth)
        const isDark = typeof window !== 'undefined' && localStorage.getItem('di_dark_mode') === 'true';
        setPrefs({ ...data.preferences, darkMode: isDark });
      }
    } catch {
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Save failed');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#09090B]">
        <div className="text-zinc-500 text-sm">Loading preferences...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#09090B]">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Settings size={24} className="text-[#FE5000]" />
          <h1 className="text-lg font-semibold text-white">Settings</h1>
        </div>

        {error && (
          <div className="mb-2.5 px-4 py-2 rounded bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {prefs && (
          <div className="space-y-4">
            {/* Default Model */}
            <SettingRow label="Default AI Model" description="Which model to use by default for queries">
              <select
                value={prefs.defaultModel}
                onChange={(e) => updateField('defaultModel', e.target.value as ModelPreference)}
                className="bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-sm text-white focus:border-[#FE5000]/50 focus:outline-none w-full"
              >
                {MODEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </SettingRow>

            {/* Timezone */}
            <SettingRow label="Timezone" description="Used for date displays and digest scheduling">
              <select
                value={prefs.timezone}
                onChange={(e) => updateField('timezone', e.target.value)}
                className="bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-sm text-white focus:border-[#FE5000]/50 focus:outline-none w-full"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </SettingRow>

            {/* Email Digest */}
            <SettingRow label="Email Digest" description="Receive a summary of platform activity">
              <select
                value={prefs.emailDigest}
                onChange={(e) => updateField('emailDigest', e.target.value as DigestFrequency)}
                className="bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-sm text-white focus:border-[#FE5000]/50 focus:outline-none w-full"
              >
                {DIGEST_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </SettingRow>

            {/* Export Format */}
            <SettingRow label="Preferred Export Format" description="Default format when exporting data">
              <select
                value={prefs.preferredFormat}
                onChange={(e) => updateField('preferredFormat', e.target.value as ExportFormat)}
                className="bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-sm text-white focus:border-[#FE5000]/50 focus:outline-none w-full"
              >
                {FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </SettingRow>

            {/* Default Date Range */}
            <SettingRow label="Default Date Range" description="Initial date range for queries and reports">
              <select
                value={prefs.defaultDateRange}
                onChange={(e) => updateField('defaultDateRange', e.target.value as DateRangeDefault)}
                className="bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-sm text-white focus:border-[#FE5000]/50 focus:outline-none w-full"
              >
                {DATE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </SettingRow>

            {/* Dark Mode Toggle */}
            <SettingRow label="Full Dark Mode" description="Apply dark theme to all page content areas (Cmd+/)">
              <button
                onClick={() => {
                  const next = !prefs.darkMode;
                  updateField('darkMode', next);
                  // Apply immediately
                  if (next) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  localStorage.setItem('di_dark_mode', String(next));
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  prefs.darkMode ? 'bg-[#FE5000]' : 'bg-[#27272A]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    prefs.darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </SettingRow>

            {/* Save Button */}
            <div className="pt-4 border-t border-[#27272A]">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#FE5000] text-white font-medium text-sm hover:bg-[#CC4000] transition-colors disabled:opacity-50"
              >
                {saved ? (
                  <>
                    <Check size={16} />
                    Saved
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Preferences'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-4 bg-[#18181B]/50 border border-[#27272A] rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{description}</div>
      </div>
      <div className="w-full sm:w-56 shrink-0">{children}</div>
    </div>
  );
}
