'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { BookOpen, Plus, Search, X, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';

interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  category: string;
  aliases: string[];
  examples?: string[];
  updatedBy: string;
  updatedAt: string;
}

const CATEGORIES = ['all', 'operations', 'finance', 'sales', 'fleet', 'general'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  operations: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  finance: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  sales: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  fleet: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  general: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export default function GlossaryPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [formTerm, setFormTerm] = useState('');
  const [formDef, setFormDef] = useState('');
  const [formCat, setFormCat] = useState('general');
  const [formAliases, setFormAliases] = useState('');
  const [formExamples, setFormExamples] = useState('');

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (search) params.set('search', search);
      const res = await fetch(`/api/glossary?${params}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      console.error('Failed to fetch glossary');
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const resetForm = () => {
    setFormTerm('');
    setFormDef('');
    setFormCat('general');
    setFormAliases('');
    setFormExamples('');
    setShowAdd(false);
    setEditId(null);
  };

  const startEdit = (entry: GlossaryEntry) => {
    setEditId(entry.id);
    setFormTerm(entry.term);
    setFormDef(entry.definition);
    setFormCat(entry.category);
    setFormAliases(entry.aliases.join(', '));
    setFormExamples((entry.examples ?? []).join('\n'));
    setShowAdd(true);
  };

  const handleSave = async () => {
    const payload = {
      term: formTerm,
      definition: formDef,
      category: formCat,
      aliases: formAliases.split(',').map(a => a.trim()).filter(Boolean),
      examples: formExamples.split('\n').map(e => e.trim()).filter(Boolean),
    };

    if (editId) {
      await fetch('/api/glossary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, ...payload }),
      });
    } else {
      await fetch('/api/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    resetForm();
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this glossary entry?')) return;
    await fetch(`/api/glossary?id=${id}`, { method: 'DELETE' });
    fetchEntries();
  };

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookOpen size={24} className="text-[#FF5C00]" />
            <div>
              <h1 className="text-lg font-semibold">Domain Glossary</h1>
              <p className="text-sm text-[#71717A] dark:text-[#A1A1AA]">
                Delta360 terminology and definitions ({entries.length} terms)
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setShowAdd(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#E54800] transition-colors"
            >
              <Plus size={16} />
              Add Term
            </button>
          )}
        </div>

        {/* Search + Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search terms, definitions, aliases..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#18181B] border border-[#27272A] rounded-lg text-sm text-white placeholder-[#52525B] outline-none focus:border-[#FF5C00]/50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={[
                  'px-3 py-2 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors border',
                  category === cat
                    ? 'bg-[#FF5C00]/10 text-[#FF5C00] border-[#FF5C00]/30'
                    : 'bg-[#18181B] text-[#71717A] dark:text-[#A1A1AA] border-[#27272A] hover:text-white',
                ].join(' ')}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Add/Edit Form */}
        {showAdd && isAdmin && (
          <div className="mb-6 p-4 bg-[#18181B] border border-[#27272A] rounded-lg">
            <h3 className="text-xs font-semibold mb-2">{editId ? 'Edit Term' : 'Add New Term'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={formTerm}
                onChange={e => setFormTerm(e.target.value)}
                placeholder="Term (e.g., BOL)"
                className="px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white placeholder-[#52525B] outline-none"
              />
              <select
                value={formCat}
                onChange={e => setFormCat(e.target.value)}
                className="px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white outline-none"
              >
                {CATEGORIES.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <textarea
                value={formDef}
                onChange={e => setFormDef(e.target.value)}
                placeholder="Definition"
                rows={2}
                className="sm:col-span-2 px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white placeholder-[#52525B] outline-none resize-none"
              />
              <input
                value={formAliases}
                onChange={e => setFormAliases(e.target.value)}
                placeholder="Aliases (comma-separated)"
                className="px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white placeholder-[#52525B] outline-none"
              />
              <input
                value={formExamples}
                onChange={e => setFormExamples(e.target.value)}
                placeholder="Examples (newline-separated)"
                className="px-3 py-2 bg-[#09090B] border border-[#27272A] rounded-lg text-sm text-white placeholder-[#52525B] outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={resetForm} className="px-3 py-1.5 text-sm text-[#71717A] dark:text-[#A1A1AA] hover:text-white">Cancel</button>
              <button
                onClick={handleSave}
                disabled={!formTerm || !formDef}
                className="px-4 py-1.5 bg-[#FF5C00] text-white text-sm rounded-lg hover:bg-[#E54800] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {/* Entries List */}
        {loading ? (
          <div className="text-center py-12 text-[#52525B] text-sm">Loading glossary...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-[#52525B] text-sm">
            {search || category !== 'all' ? 'No matching terms found.' : 'No glossary entries yet.'}
          </div>
        ) : (
          <div className="space-y-1">
            {entries.map(entry => {
              const isExpanded = expandedId === entry.id;
              const catColor = CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.general;
              return (
                <div
                  key={entry.id}
                  className="bg-[#18181B] border border-[#27272A] rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-[#1F1F23] transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={14} className="text-[#52525B] shrink-0" /> : <ChevronRight size={14} className="text-[#52525B] shrink-0" />}
                    <span className="font-mono font-semibold text-sm text-[#FF5C00] min-w-[80px]">{entry.term}</span>
                    <span className="text-sm text-[#A1A1AA] truncate flex-1">{entry.definition.slice(0, 100)}{entry.definition.length > 100 ? '...' : ''}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded border capitalize shrink-0 ${catColor}`}>
                      {entry.category}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-[#27272A]">
                      <p className="text-sm text-[#D4D4D8] mb-2 leading-relaxed">{entry.definition}</p>

                      {entry.aliases.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-[#52525B] uppercase tracking-wider">Aliases: </span>
                          <span className="text-xs text-[#A1A1AA]">{entry.aliases.join(', ')}</span>
                        </div>
                      )}

                      {entry.examples && entry.examples.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-[#52525B] uppercase tracking-wider">Examples:</span>
                          <ul className="mt-0.5 space-y-0.5">
                            {entry.examples.map((ex, i) => (
                              <li key={i} className="text-xs text-[#A1A1AA] pl-3 before:content-['-'] before:absolute before:left-0 relative">{ex}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {isAdmin && (
                        <div className="flex gap-2 mt-3 pt-2 border-t border-[#27272A]">
                          <button onClick={() => startEdit(entry)} className="flex items-center gap-1 text-xs text-[#71717A] dark:text-[#A1A1AA] hover:text-white">
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => handleDelete(entry.id)} className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400">
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
