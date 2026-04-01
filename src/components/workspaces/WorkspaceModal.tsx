'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Workspace } from './types';
import { CATEGORIES, BRAND_COLORS, DATA_SOURCES, MODEL_OPTIONS, FORMAT_OPTIONS } from './types';

export function WorkspaceModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Workspace;
  onClose: () => void;
  onSave: (ws: Partial<Workspace>) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [longDescription, setLongDescription] = useState(initial?.longDescription ?? '');
  const [color, setColor] = useState(initial?.color ?? '#FF5C00');
  const [category, setCategory] = useState<Workspace['category']>(initial?.category ?? 'custom');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [dataSources, setDataSources] = useState<string[]>(initial?.dataSources ?? []);
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '');
  const [preferredModel, setPreferredModel] = useState(initial?.preferredModel ?? 'auto');
  const [temperature, setTemperature] = useState(initial?.temperature ?? 0.7);
  const [samplePrompts, setSamplePrompts] = useState((initial?.samplePrompts ?? []).join('\n'));
  const [visibility, setVisibility] = useState<Workspace['visibility']>(initial?.visibility ?? 'private');
  const [responseFormat, setResponseFormat] = useState(initial?.responseFormat ?? 'auto');

  const toggleSource = (src: string) => {
    setDataSources((prev) =>
      prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]
    );
  };

  const handleSubmit = () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    onSave({
      ...(initial ? { id: initial.id } : {}),
      name: name.trim(),
      description: description.trim(),
      longDescription: longDescription.trim() || undefined,
      color,
      category,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      dataSources,
      systemPrompt: systemPrompt.trim(),
      preferredModel,
      temperature,
      samplePrompts: samplePrompts.split('\n').map((p) => p.trim()).filter(Boolean),
      visibility,
      responseFormat: responseFormat === 'auto' ? undefined : responseFormat,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#18181B] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {initial ? 'Edit Workspace' : 'New Workspace'}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Section: Basic Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Basic Info</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF5C00]"
                  placeholder="e.g. Logistics Planner"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-1">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF5C00]"
                  placeholder="Short description"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-1">Long Description</label>
                <textarea
                  value={longDescription}
                  onChange={(e) => setLongDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF5C00] resize-none"
                  placeholder="Detailed overview for the marketplace listing..."
                />
              </div>
            </div>
          </div>

          {/* Section: Appearance */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Appearance</h4>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-zinc-900 dark:text-zinc-100">Color</label>
              <div className="flex gap-2">
                {BRAND_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: c === color ? '#09090B' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Workspace['category'])}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF5C00]"
                >
                  {CATEGORIES.filter((c) => c.value !== '').map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-1">Tags (comma-separated)</label>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF5C00]"
                  placeholder="pricing, margins, DTN"
                />
              </div>
            </div>
          </div>

          {/* Section: Data Sources */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Data Sources</h4>
            <div className="grid grid-cols-2 gap-2">
              {DATA_SOURCES.map((src) => (
                <label key={src} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={dataSources.includes(src)}
                    onChange={() => toggleSource(src)}
                    className="w-4 h-4 rounded border-zinc-300 text-[#FF5C00] focus:ring-[#FF5C00]"
                  />
                  <span className="text-sm text-zinc-700 capitalize">{src}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section: AI Configuration */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">AI Configuration</h4>
            <div>
              <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-1">Custom Instructions</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={5}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#FF5C00] resize-none"
                placeholder="Describe the role and focus areas..."
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-1">Preferred Model</label>
                <select
                  value={preferredModel}
                  onChange={(e) => setPreferredModel(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF5C00]"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                  Temperature: {temperature.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-[#FF5C00]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-1">Response Format</label>
                <select
                  value={responseFormat}
                  onChange={(e) => setResponseFormat(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF5C00]"
                >
                  {FORMAT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Prompts & Sharing */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sample Prompts &amp; Sharing</h4>
            <div>
              <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-1">Sample Prompts (one per line)</label>
              <textarea
                value={samplePrompts}
                onChange={(e) => setSamplePrompts(e.target.value)}
                rows={4}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF5C00] resize-none"
                placeholder="Enter suggested questions, one per line"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-2">Visibility</label>
              <div className="flex gap-3">
                {(['private', 'team', 'public'] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value={v}
                      checked={visibility === v}
                      onChange={() => setVisibility(v)}
                      className="text-[#FF5C00] focus:ring-[#FF5C00]"
                    />
                    <span className="text-sm text-zinc-700 capitalize">{v}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-200 dark:border-zinc-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !systemPrompt.trim()}
            className="px-5 py-2 text-sm font-medium bg-[#FF5C00] text-white rounded-lg hover:bg-[#E54800] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {initial ? 'Save Changes' : 'Create Workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}
