'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileBarChart,
  Play,
  Trash2,
  Clock,
  Calendar,
  X,
  Loader2,
} from 'lucide-react';

interface TemplateParam {
  name: string;
  type: string;
  default?: string | number;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  params: TemplateParam[];
}

interface ScheduleConfig {
  templateId: string;
  templateName: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  recipients: string;
  createdAt: string;
}

function getNextRun(frequency: string, time: string): string {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  if (next <= now) {
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }
  }

  return next.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Schedule modal state
  const [schedulingTemplate, setSchedulingTemplate] = useState<ReportTemplate | null>(null);
  const [scheduleFreq, setScheduleFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [scheduleRecipients, setScheduleRecipients] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [tRes, sRes] = await Promise.all([
          fetch('/api/reports/templates'),
          fetch('/api/reports/schedules').catch(() => null),
        ]);

        if (tRes.ok) {
          const data = await tRes.json();
          setTemplates(data.templates ?? []);
        }

        if (sRes && sRes.ok) {
          const data = await sRes.json();
          setSchedules(data.schedules ?? []);
        } else {
          // Load schedules from localStorage as fallback
          const stored = localStorage.getItem('di_report_schedules');
          if (stored) setSchedules(JSON.parse(stored));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleUseTemplate = useCallback((template: ReportTemplate) => {
    // Fill params with defaults
    let filledPrompt = template.prompt;
    for (const param of template.params) {
      const defaultVal = param.default !== undefined ? String(param.default) : '';
      filledPrompt = filledPrompt.replace(`{${param.name}}`, defaultVal);
    }

    // Store prompt in sessionStorage and navigate to reports page
    sessionStorage.setItem('di_report_prompt', filledPrompt);
    router.push('/reports');
  }, [router]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/reports/templates?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, []);

  const handleSaveSchedule = useCallback(() => {
    if (!schedulingTemplate || !scheduleRecipients.trim()) return;

    const newSchedule: ScheduleConfig = {
      templateId: schedulingTemplate.id,
      templateName: schedulingTemplate.name,
      frequency: scheduleFreq,
      time: scheduleTime,
      recipients: scheduleRecipients.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [...schedules, newSchedule];
    setSchedules(updated);
    localStorage.setItem('di_report_schedules', JSON.stringify(updated));

    setSchedulingTemplate(null);
    setScheduleRecipients('');
  }, [schedulingTemplate, scheduleFreq, scheduleTime, scheduleRecipients, schedules]);

  const handleRemoveSchedule = useCallback((idx: number) => {
    const updated = schedules.filter((_, i) => i !== idx);
    setSchedules(updated);
    localStorage.setItem('di_report_schedules', JSON.stringify(updated));
  }, [schedules]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-[#09090B]">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <FileBarChart size={18} className="text-[#FE5000]" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Report Templates</h2>
          </div>
          <p className="text-sm text-zinc-500">
            Pre-built report prompts. Click &quot;Use Template&quot; to generate.
          </p>
        </div>

        {error && (
          <div className="mb-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Template cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {templates.map(template => (
            <div
              key={template.id}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#18181B] p-4 hover:border-[#FE5000]/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-white">{template.name}</h3>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="text-zinc-300 hover:text-red-500 transition-colors p-1"
                  title="Delete template"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-xs text-zinc-500 mb-2 line-clamp-2">{template.description}</p>

              {template.params.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {template.params.map(p => (
                    <span
                      key={p.name}
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                    >
                      {p.name}: {String(p.default ?? '?')}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUseTemplate(template)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-[#FE5000] text-white hover:bg-[#CC4000] transition-colors"
                >
                  <Play size={12} /> Use Template
                </button>
                <button
                  onClick={() => setSchedulingTemplate(template)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Clock size={12} /> Schedule
                </button>
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="col-span-2 text-center py-12 text-sm text-zinc-400">
              No templates found. Generate a report and save it as a template.
            </div>
          )}
        </div>

        {/* Scheduled Reports */}
        {schedules.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-[#FE5000]" />
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-white">Scheduled Reports</h3>
              <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                Phase 3.4b: cron execution pending
              </span>
            </div>
            <div className="space-y-2">
              {schedules.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 px-3 py-2"
                >
                  <div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{s.templateName}</span>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-zinc-500 uppercase font-medium">
                        {s.frequency}
                      </span>
                      <span className="text-[10px] text-zinc-400">at {s.time}</span>
                      <span className="text-[10px] text-zinc-400">
                        Next: {getNextRun(s.frequency, s.time)}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      To: {s.recipients}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveSchedule(idx)}
                    className="text-zinc-300 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {schedulingTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#18181B] rounded-lg shadow-xl w-full max-w-md mx-4 p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-white">
                Schedule: {schedulingTemplate.name}
              </h3>
              <button
                onClick={() => setSchedulingTemplate(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Frequency</label>
                <select
                  value={scheduleFreq}
                  onChange={e => setScheduleFreq(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm text-zinc-900 dark:text-white bg-white dark:bg-[#27272A]"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm text-zinc-900 dark:text-white bg-white dark:bg-[#27272A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Recipients (comma-separated emails)</label>
                <input
                  type="text"
                  value={scheduleRecipients}
                  onChange={e => setScheduleRecipients(e.target.value)}
                  placeholder="user@delta360.energy, team@delta360.energy"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm text-zinc-900 dark:text-white bg-white dark:bg-[#27272A] placeholder-zinc-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveSchedule}
                  disabled={!scheduleRecipients.trim()}
                  className="flex-1 rounded-lg px-4 py-2 text-xs font-semibold bg-[#FE5000] text-white hover:bg-[#CC4000] disabled:opacity-50 transition-colors"
                >
                  Save Schedule
                </button>
                <button
                  onClick={() => setSchedulingTemplate(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
