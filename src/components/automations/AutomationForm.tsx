'use client';

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type {
  Automation,
  Trigger,
  TriggerType,
  Action,
  ActionType,
  Condition,
  ComparisonOperator,
} from '@/lib/automations';

interface AutomationFormProps {
  initial?: Automation | null;
  onSave: (data: {
    name: string;
    description: string;
    trigger: Trigger;
    conditions: Condition[];
    actions: Action[];
  }) => void;
  onCancel: () => void;
}

const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
  { value: 'schedule', label: 'Schedule' },
  { value: 'threshold', label: 'Threshold' },
  { value: 'manual', label: 'Manual' },
];

const ACTION_TYPES: { value: ActionType; label: string; color: string }[] = [
  { value: 'query', label: 'Query', color: 'border-l-blue-500' },
  { value: 'report', label: 'Report', color: 'border-l-green-500' },
  { value: 'email', label: 'Email', color: 'border-l-amber-500' },
  { value: 'webhook', label: 'Webhook', color: 'border-l-purple-500' },
  { value: 'workbook', label: 'Workbook', color: 'border-l-teal-500' },
];

const OPERATORS: ComparisonOperator[] = ['>', '<', '=', '!=', '>=', '<='];

const FREQUENCIES = ['daily', 'weekly', 'monthly'];

function makeActionId(): string {
  return `act_${Math.random().toString(36).slice(2, 8)}`;
}

export default function AutomationForm({
  initial,
  onSave,
  onCancel,
}: AutomationFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [triggerType, setTriggerType] = useState<TriggerType>(
    initial?.trigger.type ?? 'manual'
  );
  const [frequency, setFrequency] = useState(
    initial?.trigger.config.frequency ?? 'daily'
  );
  const [cron, setCron] = useState(initial?.trigger.config.cron ?? '');
  const [thresholdEndpoint, setThresholdEndpoint] = useState(
    initial?.trigger.config.endpoint ?? ''
  );
  const [thresholdField, setThresholdField] = useState(
    initial?.trigger.config.field ?? ''
  );
  const [thresholdOp, setThresholdOp] = useState<ComparisonOperator>(
    initial?.trigger.config.operator ?? '>'
  );
  const [thresholdValue, setThresholdValue] = useState(
    String(initial?.trigger.config.value ?? '')
  );

  const [conditions, setConditions] = useState<Condition[]>(
    initial?.conditions ?? []
  );
  const [actions, setActions] = useState<Action[]>(
    initial?.actions ?? []
  );

  function buildTrigger(): Trigger {
    switch (triggerType) {
      case 'schedule':
        return { type: 'schedule', config: { cron, frequency } };
      case 'threshold':
        return {
          type: 'threshold',
          config: {
            endpoint: thresholdEndpoint,
            field: thresholdField,
            operator: thresholdOp,
            value: isNaN(Number(thresholdValue))
              ? thresholdValue
              : Number(thresholdValue),
          },
        };
      case 'manual':
      default:
        return { type: 'manual', config: {} };
    }
  }

  function addCondition() {
    setConditions((prev) => [...prev, { field: '', operator: '>', value: '' }]);
  }

  function updateCondition(idx: number, patch: Partial<Condition>) {
    setConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  }

  function removeCondition(idx: number) {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addAction(type: ActionType) {
    const newAction: Action = {
      id: makeActionId(),
      type,
      name: `${type.charAt(0).toUpperCase()}${type.slice(1)} Action`,
      config: {},
    };
    setActions((prev) => [...prev, newAction]);
  }

  function updateAction(idx: number, patch: Partial<Action>) {
    setActions((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    );
  }

  function updateActionConfig(
    idx: number,
    configPatch: Partial<Action['config']>
  ) {
    setActions((prev) =>
      prev.map((a, i) =>
        i === idx ? { ...a, config: { ...a.config, ...configPatch } } : a
      )
    );
  }

  function removeAction(idx: number) {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name,
      description,
      trigger: buildTrigger(),
      conditions,
      actions,
    });
  }

  const inputClass =
    'w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#18181B] px-3 py-1.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#FF5C00] focus:ring-1 focus:ring-[#FF5C00]/30 outline-none';
  const labelClass = 'block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#18181B] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
            {initial ? 'Edit Automation' : 'Create Automation'}
          </h2>
          <button
            onClick={onCancel}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 1. Basic Info */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
              Basic Info
            </h3>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Weekly AR Aging Report"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`${inputClass} resize-none`}
                  rows={2}
                  placeholder="What does this automation do?"
                />
              </div>
            </div>
          </section>

          {/* 2. Trigger */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
              Trigger
            </h3>
            <div className="flex gap-2 mb-3">
              {TRIGGER_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTriggerType(t.value)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    triggerType === t.value
                      ? 'bg-[#FF5C00] text-white border-[#FF5C00]'
                      : 'bg-white dark:bg-[#18181B] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {triggerType === 'schedule' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className={inputClass}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Cron (optional)</label>
                  <input
                    value={cron}
                    onChange={(e) => setCron(e.target.value)}
                    className={inputClass}
                    placeholder="0 8 * * 1"
                  />
                </div>
              </div>
            )}

            {triggerType === 'threshold' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Endpoint to poll</label>
                  <input
                    value={thresholdEndpoint}
                    onChange={(e) => setThresholdEndpoint(e.target.value)}
                    className={inputClass}
                    placeholder="/salesforce/query?q=..."
                  />
                </div>
                <div>
                  <label className={labelClass}>Field</label>
                  <input
                    value={thresholdField}
                    onChange={(e) => setThresholdField(e.target.value)}
                    className={inputClass}
                    placeholder="totalSize"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-20">
                    <label className={labelClass}>Op</label>
                    <select
                      value={thresholdOp}
                      onChange={(e) =>
                        setThresholdOp(e.target.value as ComparisonOperator)
                      }
                      className={inputClass}
                    >
                      {OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className={labelClass}>Value</label>
                    <input
                      value={thresholdValue}
                      onChange={(e) => setThresholdValue(e.target.value)}
                      className={inputClass}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {triggerType === 'manual' && (
              <p className="text-xs text-zinc-400">
                This automation will only run when triggered manually.
              </p>
            )}
          </section>

          {/* 3. Conditions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Conditions (optional)
              </h3>
              <button
                type="button"
                onClick={addCondition}
                className="flex items-center gap-1 text-xs text-[#FF5C00] hover:text-[#E54800]"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {conditions.length === 0 && (
              <p className="text-xs text-zinc-400">
                No conditions — actions will always execute.
              </p>
            )}
            <div className="space-y-2">
              {conditions.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={c.field}
                    onChange={(e) =>
                      updateCondition(idx, { field: e.target.value })
                    }
                    className={`${inputClass} flex-1`}
                    placeholder="field"
                  />
                  <select
                    value={c.operator}
                    onChange={(e) =>
                      updateCondition(idx, {
                        operator: e.target.value as ComparisonOperator,
                      })
                    }
                    className={`${inputClass} w-16`}
                  >
                    {OPERATORS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <input
                    value={String(c.value)}
                    onChange={(e) =>
                      updateCondition(idx, {
                        value: isNaN(Number(e.target.value))
                          ? e.target.value
                          : Number(e.target.value),
                      })
                    }
                    className={`${inputClass} w-24`}
                    placeholder="value"
                  />
                  <button
                    type="button"
                    onClick={() => removeCondition(idx)}
                    className="text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Actions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Actions
              </h3>
              <div className="flex gap-1">
                {ACTION_TYPES.map((at) => (
                  <button
                    key={at.value}
                    type="button"
                    onClick={() => addAction(at.value)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-[#FF5C00] hover:text-[#FF5C00] transition-colors"
                  >
                    <Plus size={10} /> {at.label}
                  </button>
                ))}
              </div>
            </div>

            {actions.length === 0 && (
              <p className="text-xs text-zinc-400">
                Add at least one action above.
              </p>
            )}

            <div className="space-y-3">
              {actions.map((action, idx) => {
                const typeInfo =
                  ACTION_TYPES.find((at) => at.value === action.type) ??
                  ACTION_TYPES[0];
                return (
                  <div
                    key={action.id}
                    className={`border border-zinc-200 dark:border-zinc-700 border-l-4 ${typeInfo.color} rounded-lg p-3`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-zinc-400 uppercase">
                          {idx + 1}. {action.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAction(idx)}
                        className="text-zinc-400 hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <input
                      value={action.name}
                      onChange={(e) =>
                        updateAction(idx, { name: e.target.value })
                      }
                      className={`${inputClass} mb-2`}
                      placeholder="Action name"
                    />

                    {/* Type-specific fields */}
                    {action.type === 'query' && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <input
                            value={action.config.endpoint ?? ''}
                            onChange={(e) =>
                              updateActionConfig(idx, {
                                endpoint: e.target.value,
                              })
                            }
                            className={inputClass}
                            placeholder="Endpoint"
                          />
                        </div>
                        <select
                          value={action.config.method ?? 'GET'}
                          onChange={(e) =>
                            updateActionConfig(idx, {
                              method: e.target.value,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                        </select>
                      </div>
                    )}

                    {action.type === 'report' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={action.config.reportTemplate ?? ''}
                          onChange={(e) =>
                            updateActionConfig(idx, {
                              reportTemplate: e.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Template name"
                        />
                        <select
                          value={action.config.reportFormat ?? 'pdf'}
                          onChange={(e) =>
                            updateActionConfig(idx, {
                              reportFormat: e.target.value,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="pdf">PDF</option>
                          <option value="xlsx">Excel</option>
                          <option value="csv">CSV</option>
                        </select>
                      </div>
                    )}

                    {action.type === 'email' && (
                      <div className="space-y-2">
                        <input
                          value={(action.config.to ?? []).join(', ')}
                          onChange={(e) =>
                            updateActionConfig(idx, {
                              to: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          className={inputClass}
                          placeholder="Recipients (comma-separated)"
                        />
                        <input
                          value={action.config.subject ?? ''}
                          onChange={(e) =>
                            updateActionConfig(idx, {
                              subject: e.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Subject"
                        />
                        <textarea
                          value={action.config.bodyTemplate ?? ''}
                          onChange={(e) =>
                            updateActionConfig(idx, {
                              bodyTemplate: e.target.value,
                            })
                          }
                          className={`${inputClass} resize-none`}
                          rows={2}
                          placeholder="Body template (supports {{variables}})"
                        />
                        <label className="flex items-center gap-2 text-xs text-zinc-500">
                          <input
                            type="checkbox"
                            checked={action.config.attachReport ?? false}
                            onChange={(e) =>
                              updateActionConfig(idx, {
                                attachReport: e.target.checked,
                              })
                            }
                            className="rounded border-zinc-300"
                          />
                          Attach report
                        </label>
                      </div>
                    )}

                    {action.type === 'webhook' && (
                      <div className="space-y-2">
                        <input
                          value={action.config.url ?? ''}
                          onChange={(e) =>
                            updateActionConfig(idx, { url: e.target.value })
                          }
                          className={inputClass}
                          placeholder="Webhook URL"
                        />
                      </div>
                    )}

                    {action.type === 'workbook' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={action.config.workbookTemplate ?? ''}
                          onChange={(e) =>
                            updateActionConfig(idx, {
                              workbookTemplate: e.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Workbook template"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name || actions.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-[#FF5C00] rounded-md hover:bg-[#E54800] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {initial ? 'Save Changes' : 'Create Automation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
