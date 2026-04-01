'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Settings, Users, Shield, BarChart3, Activity, Save, Plus, FileSearch, ChevronRight, ChevronDown } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */

interface MergedRole {
  role: string;
  name: string;
  services: string[];
  endpoints: Record<string, string[]>;
  capabilities: string[];
  modules: string[];
  isCustom?: boolean;
}

interface EndpointDef {
  path: string;
  label: string;
  methods: string[];
}

interface ModuleGroup {
  category: string;
  pages: { path: string; label: string }[];
}

/* ── Constants ─────────────────────────────────────────────── */

const ALL_SERVICES = [
  { id: 'ascend', label: 'Ascend (ERP)' },
  { id: 'salesforce', label: 'Salesforce (CRM)' },
  { id: 'powerbi', label: 'Power BI' },
  { id: 'samsara', label: 'Samsara (Fleet)' },
  { id: 'fleetpanda', label: 'Fleet Panda' },
  { id: 'microsoft', label: 'Microsoft 365' },
  { id: 'vroozi', label: 'Vroozi (Procurement)' },
  { id: 'paylocity', label: 'Paylocity (HR)' },
];

const ADMIN_TABS = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/permissions', label: 'Permissions', icon: Shield },
  { href: '/admin/usage', label: 'Usage', icon: BarChart3 },
  { href: '/admin/health', label: 'Health', icon: Activity },
  { href: '/admin/audit', label: 'Audit', icon: FileSearch },
];

const PERM_TABS = ['Services', 'Endpoints', 'Capabilities', 'Modules'] as const;
type PermTab = typeof PERM_TABS[number];

const CAPABILITY_LABELS: Record<string, string> = {
  query_gateway: 'Query Gateway',
  generate_workbook: 'Generate Workbook',
  salesforce_create: 'Salesforce Create',
  salesforce_update: 'Salesforce Update',
  create_calendar_event: 'Create Calendar Event',
  check_availability: 'Check Availability',
  read_email: 'Read Email',
  send_email: 'Send Email',
  manage_email: 'Manage Email',
  export_data: 'Export Data',
  generate_report: 'Generate Report',
  manage_users: 'Manage Users',
  view_audit_log: 'View Audit Log',
  approve_entries: 'Approve Entries',
  create_entries: 'Create Entries',
  manage_close: 'Manage Close',
  view_financials: 'View Financials',
  view_fleet: 'View Fleet',
  view_hr: 'View HR',
  configure_system: 'Configure System',
};

/* ── Component ─────────────────────────────────────────────── */

export default function AdminPermissionsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? 'admin';

  const [roles, setRoles] = useState<MergedRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<PermTab>('Services');

  // Catalogs
  const [endpointCatalog, setEndpointCatalog] = useState<Record<string, EndpointDef[]>>({});
  const [moduleCatalog, setModuleCatalog] = useState<ModuleGroup[]>([]);
  const [capabilityCatalog, setCapabilityCatalog] = useState<string[]>([]);

  // Endpoint tree expand state
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  // New custom role form
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleServices, setNewRoleServices] = useState<string[]>([]);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, endpointsRes, modulesRes, capsRes] = await Promise.all([
        fetch('/api/admin/permissions'),
        fetch('/api/admin/permissions?section=endpoints'),
        fetch('/api/admin/permissions?section=modules'),
        fetch('/api/admin/permissions?section=capabilities'),
      ]);
      const rolesData = await rolesRes.json();
      const endpointsData = await endpointsRes.json();
      const modulesData = await modulesRes.json();
      const capsData = await capsRes.json();

      if (rolesData.roles) {
        setRoles(rolesData.roles);
        setError(null);
      } else {
        setError(rolesData.error ?? 'Failed to load permissions');
      }
      if (endpointsData.endpoints) setEndpointCatalog(endpointsData.endpoints);
      if (modulesData.modules) setModuleCatalog(modulesData.modules);
      if (capsData.capabilities) setCapabilityCatalog(capsData.capabilities);
    } catch {
      setError('Unable to reach permissions API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  /* ── Mutation helpers ───────────────────────────────────── */

  const toggleService = (roleKey: string, serviceId: string) => {
    if (roleKey === 'admin') return; // admin always full
    setRoles((prev) =>
      prev.map((r) => {
        if (r.role !== roleKey) return r;
        const has = r.services.includes(serviceId);
        const updated = has
          ? r.services.filter((s) => s !== serviceId)
          : [...r.services, serviceId];
        return { ...r, services: updated };
      })
    );
    setDirty(true);
  };

  const toggleEndpoint = (roleKey: string, serviceId: string, endpointPath: string) => {
    if (roleKey === 'admin') return;
    setRoles((prev) =>
      prev.map((r) => {
        if (r.role !== roleKey) return r;
        const svcEndpoints = r.endpoints[serviceId] ?? [];
        // If wildcard, remove it and add all except the toggled one
        if (svcEndpoints.includes('*')) {
          const allPaths = (endpointCatalog[serviceId] ?? []).map((e) => e.path);
          const filtered = allPaths.filter((p) => p !== endpointPath);
          return { ...r, endpoints: { ...r.endpoints, [serviceId]: filtered } };
        }
        const has = svcEndpoints.includes(endpointPath);
        const updated = has
          ? svcEndpoints.filter((e) => e !== endpointPath)
          : [...svcEndpoints, endpointPath];
        return { ...r, endpoints: { ...r.endpoints, [serviceId]: updated } };
      })
    );
    setDirty(true);
  };

  const toggleCapability = (roleKey: string, capId: string) => {
    if (roleKey === 'admin') return;
    setRoles((prev) =>
      prev.map((r) => {
        if (r.role !== roleKey) return r;
        const has = r.capabilities.includes(capId);
        const updated = has
          ? r.capabilities.filter((c) => c !== capId)
          : [...r.capabilities, capId];
        return { ...r, capabilities: updated };
      })
    );
    setDirty(true);
  };

  const toggleModule = (roleKey: string, modulePath: string) => {
    if (roleKey === 'admin') return;
    setRoles((prev) =>
      prev.map((r) => {
        if (r.role !== roleKey) return r;
        const has = r.modules.includes(modulePath);
        const updated = has
          ? r.modules.filter((m) => m !== modulePath)
          : [...r.modules, modulePath];
        return { ...r, modules: updated };
      })
    );
    setDirty(true);
  };

  const toggleServiceExpand = (serviceId: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };

  const isEndpointChecked = (role: MergedRole, serviceId: string, endpointPath: string): boolean => {
    const svcEndpoints = role.endpoints[serviceId] ?? [];
    if (svcEndpoints.includes('*')) return true;
    // check glob prefix match
    return svcEndpoints.some((pattern) => {
      if (pattern === '*') return true;
      if (pattern.endsWith('*')) return endpointPath.startsWith(pattern.slice(0, -1));
      return pattern === endpointPath;
    });
  };

  /* ── Save / Create ──────────────────────────────────────── */

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
      });
      if (res.ok) {
        setSuccess('Permissions saved');
        setDirty(false);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to save');
      }
    } catch {
      setError('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setError(null);
    setSuccess(null);
    const roleId = newRoleName.trim().toLowerCase().replace(/\s+/g, '-');
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleId, name: newRoleName.trim(), services: newRoleServices }),
      });
      if (res.ok) {
        setSuccess(`Created role "${newRoleName.trim()}"`);
        setShowNewRole(false);
        setNewRoleName('');
        setNewRoleServices([]);
        await fetchRoles();
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to create role');
      }
    } catch {
      setError('Failed to create role');
    }
  };

  const toggleNewRoleService = (serviceId: string) => {
    setNewRoleServices((prev) =>
      prev.includes(serviceId) ? prev.filter((s) => s !== serviceId) : [...prev, serviceId]
    );
  };

  /* ── Render Helpers ─────────────────────────────────────── */

  const roleHeaders = (roles ?? []).map((r) => ({
    key: r.role,
    label: r.name,
    isAdmin: r.role === 'admin',
    isCustom: r.isCustom,
    serviceCount: r.services.length,
  }));

  const renderServicesTab = () => (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#27272A] bg-[#09090B]">
            <th className="text-left px-3 py-2 font-medium text-[#A1A1AA] sticky left-0 bg-[#09090B] min-w-[180px]">Role</th>
            {ALL_SERVICES.map((svc) => (
              <th key={svc.id} className="text-center px-3 py-3 font-medium text-[#A1A1AA] min-w-[110px]">{svc.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={ALL_SERVICES.length + 1} className="px-4 py-8 text-center text-[#A1A1AA]">Loading...</td></tr>
          ) : (
            (roles ?? []).map((config) => (
              <tr key={config.role} className="border-b border-[#27272A] last:border-0 hover:bg-[#27272A]/50">
                <td className="px-3 py-2 sticky left-0 bg-[#18181B]">
                  <div className="font-medium text-white">{config.name}</div>
                  <div className="text-[10px] text-[#A1A1AA] mt-0.5">
                    {config.services.length} / {ALL_SERVICES.length} services
                    {config.isCustom && (
                      <span className="ml-1.5 inline-flex rounded px-1.5 py-0.5 text-[9px] font-medium bg-[#FE5000]/10 text-[#FE5000] border border-[#FE5000]/30">custom</span>
                    )}
                  </div>
                </td>
                {ALL_SERVICES.map((svc) => (
                  <td key={svc.id} className="text-center px-3 py-3">
                    <input
                      type="checkbox"
                      checked={config.services.includes(svc.id)}
                      onChange={() => toggleService(config.role, svc.id)}
                      disabled={config.role === 'admin'}
                      className="w-4 h-4 rounded border-[#3F3F46] text-[#FE5000] focus:ring-[#FE5000]/30 cursor-pointer accent-[#FE5000] disabled:opacity-50"
                    />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderEndpointsTab = () => (
    <div className="space-y-3">
      {Object.entries(endpointCatalog).map(([serviceId, endpoints]) => {
        const svcLabel = ALL_SERVICES.find((s) => s.id === serviceId)?.label ?? serviceId;
        const expanded = expandedServices.has(serviceId);
        return (
          <div key={serviceId} className="rounded-lg border border-[#27272A] bg-[#18181B] shadow-sm overflow-hidden">
            <button
              onClick={() => toggleServiceExpand(serviceId)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#27272A]/50 transition-colors"
            >
              {expanded ? <ChevronDown size={16} className="text-[#FE5000]" /> : <ChevronRight size={16} className="text-[#A1A1AA]" />}
              <span className="font-medium text-white">{svcLabel}</span>
              <span className="text-xs text-[#A1A1AA]">({(endpoints ?? []).length} endpoints)</span>
            </button>
            {expanded && (
              <div className="overflow-x-auto border-t border-[#27272A]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#27272A] bg-[#09090B]">
                      <th className="text-left px-4 py-2 font-medium text-[#A1A1AA] sticky left-0 bg-[#09090B] min-w-[220px]">Endpoint</th>
                      <th className="text-left px-3 py-2 font-medium text-[#A1A1AA] min-w-[80px]">Methods</th>
                      {roleHeaders.map((rh) => (
                        <th key={rh.key} className="text-center px-2 py-2 font-medium text-[#A1A1AA] min-w-[90px]">
                          <div className="text-[11px] leading-tight">{rh.label.split('(')[0].trim()}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(endpoints ?? []).map((ep) => (
                      <tr key={ep.path} className="border-b border-[#27272A]/50 last:border-0 hover:bg-[#27272A]/30">
                        <td className="px-4 py-2 sticky left-0 bg-[#18181B]">
                          <code className="text-xs text-[#FE5000] font-mono">{ep.path}</code>
                          <div className="text-[10px] text-[#71717A]">{ep.label}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 flex-wrap">
                            {(ep.methods ?? []).map((m) => (
                              <span key={m} className="text-[9px] font-mono rounded px-1.5 py-0.5 bg-[#27272A] text-[#A1A1AA]">{m}</span>
                            ))}
                          </div>
                        </td>
                        {(roles ?? []).map((r) => (
                          <td key={r.role} className="text-center px-2 py-2">
                            <input
                              type="checkbox"
                              checked={isEndpointChecked(r, serviceId, ep.path)}
                              onChange={() => toggleEndpoint(r.role, serviceId, ep.path)}
                              disabled={r.role === 'admin'}
                              className="w-3.5 h-3.5 rounded border-[#3F3F46] text-[#FE5000] focus:ring-[#FE5000]/30 cursor-pointer accent-[#FE5000] disabled:opacity-50"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderCapabilitiesTab = () => (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#27272A] bg-[#09090B]">
            <th className="text-left px-3 py-2 font-medium text-[#A1A1AA] sticky left-0 bg-[#09090B] min-w-[200px]">Capability</th>
            {roleHeaders.map((rh) => (
              <th key={rh.key} className="text-center px-3 py-3 font-medium text-[#A1A1AA] min-w-[100px]">
                <div className="text-[11px] leading-tight">{rh.label.split('(')[0].trim()}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(capabilityCatalog ?? []).map((cap) => (
            <tr key={cap} className="border-b border-[#27272A]/50 last:border-0 hover:bg-[#27272A]/30">
              <td className="px-4 py-2.5 sticky left-0 bg-[#18181B]">
                <div className="font-medium text-white text-xs">{CAPABILITY_LABELS[cap] ?? cap}</div>
                <div className="text-[10px] text-[#71717A] font-mono">{cap}</div>
              </td>
              {(roles ?? []).map((r) => (
                <td key={r.role} className="text-center px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={r.capabilities.includes(cap)}
                    onChange={() => toggleCapability(r.role, cap)}
                    disabled={r.role === 'admin'}
                    className="w-4 h-4 rounded border-[#3F3F46] text-[#FE5000] focus:ring-[#FE5000]/30 cursor-pointer accent-[#FE5000] disabled:opacity-50"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderModulesTab = () => (
    <div className="space-y-4">
      {(moduleCatalog ?? []).map((group) => (
        <div key={group.category} className="rounded-lg border border-[#27272A] bg-[#18181B] shadow-sm overflow-x-auto">
          <div className="px-4 py-2.5 border-b border-[#27272A] bg-[#09090B]">
            <h4 className="text-xs font-semibold text-[#FE5000] uppercase tracking-wider">{group.category}</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A]/50">
                <th className="text-left px-4 py-2 font-medium text-[#A1A1AA] sticky left-0 bg-[#18181B] min-w-[200px]">Page</th>
                {roleHeaders.map((rh) => (
                  <th key={rh.key} className="text-center px-2 py-2 font-medium text-[#A1A1AA] min-w-[90px]">
                    <div className="text-[11px] leading-tight">{rh.label.split('(')[0].trim()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(group.pages ?? []).map((page) => (
                <tr key={page.path} className="border-b border-[#27272A]/30 last:border-0 hover:bg-[#27272A]/30">
                  <td className="px-4 py-2 sticky left-0 bg-[#18181B]">
                    <div className="text-white text-xs">{page.label}</div>
                    <div className="text-[10px] text-[#71717A] font-mono">{page.path}</div>
                  </td>
                  {(roles ?? []).map((r) => (
                    <td key={r.role} className="text-center px-2 py-2">
                      <input
                        type="checkbox"
                        checked={r.modules.includes(page.path)}
                        onChange={() => toggleModule(r.role, page.path)}
                        disabled={r.role === 'admin'}
                        className="w-3.5 h-3.5 rounded border-[#3F3F46] text-[#FE5000] focus:ring-[#FE5000]/30 cursor-pointer accent-[#FE5000] disabled:opacity-50"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

  /* ── Main Render ────────────────────────────────────────── */

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-[#09090B]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-[#FE5000]" />
          <div>
            <h2 className="text-lg font-bold text-white">Admin Portal</h2>
            <p className="mt-0.5 text-sm text-[#A1A1AA]">Manage users, permissions, usage, and system health</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold bg-[#09090B] text-[#FE5000] border border-[#27272A] uppercase tracking-wide">
          {userRole}
        </span>
      </div>

      {/* Admin Tabs */}
      <nav className="flex gap-1 border-b border-[#27272A]">
        {ADMIN_TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin/permissions';
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                active
                  ? 'border-[#FE5000] text-[#FE5000]'
                  : 'border-transparent text-[#A1A1AA] hover:text-white hover:border-[#3F3F46]',
              ].join(' ')}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Messages */}
      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</div>
      )}
      {success && (
        <div className="rounded-md border border-green-900/50 bg-green-950/50 px-3 py-2 text-sm text-green-400">{success}</div>
      )}

      {/* Actions Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-1.5 rounded-md bg-[#FE5000] px-4 py-2 text-sm font-medium text-white hover:bg-[#CC4000] disabled:opacity-50 transition-colors"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={() => setShowNewRole(!showNewRole)}
          className="flex items-center gap-1.5 rounded-md border border-[#3F3F46] px-4 py-2 text-sm font-medium text-white hover:bg-[#27272A] transition-colors"
        >
          <Plus size={14} />
          Create Custom Role
        </button>
        {dirty && (
          <span className="text-xs text-[#FE5000] font-medium">Unsaved changes</span>
        )}
      </div>

      {/* New Role Form */}
      {showNewRole && (
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5 shadow-sm space-y-3">
          <h3 className="text-xs font-semibold text-white">New Custom Role</h3>
          <input
            type="text"
            placeholder="Role name (e.g., Dispatch Manager)"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            className="w-full rounded-md border border-[#3F3F46] bg-[#09090B] px-3 py-2 text-sm text-white placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#FE5000]/30 focus:border-[#FE5000]"
          />
          <div className="flex flex-wrap gap-2">
            {ALL_SERVICES.map((svc) => {
              const selected = newRoleServices.includes(svc.id);
              return (
                <button
                  key={svc.id}
                  onClick={() => toggleNewRoleService(svc.id)}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                    selected
                      ? 'bg-[#FE5000] text-white border-[#FE5000]'
                      : 'bg-[#18181B] text-[#A1A1AA] border-[#3F3F46] hover:border-[#FE5000]',
                  ].join(' ')}
                >
                  {svc.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateRole}
              disabled={!newRoleName.trim()}
              className="rounded-md bg-[#FE5000] px-4 py-2 text-sm font-medium text-white hover:bg-[#CC4000] disabled:opacity-50 transition-colors"
            >
              Create Role
            </button>
            <button
              onClick={() => { setShowNewRole(false); setNewRoleName(''); setNewRoleServices([]); }}
              className="rounded-md border border-[#3F3F46] px-4 py-2 text-sm font-medium text-[#A1A1AA] hover:bg-[#27272A] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Permission Sub-Tabs */}
      <div className="flex gap-1 border-b border-[#27272A]">
        {PERM_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab
                ? 'border-[#FE5000] text-[#FE5000]'
                : 'border-transparent text-[#A1A1AA] hover:text-white hover:border-[#3F3F46]',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Services' && renderServicesTab()}
      {activeTab === 'Endpoints' && renderEndpointsTab()}
      {activeTab === 'Capabilities' && renderCapabilitiesTab()}
      {activeTab === 'Modules' && renderModulesTab()}
    </div>
  );
}
