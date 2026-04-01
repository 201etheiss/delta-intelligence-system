'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Settings, Users, Shield, BarChart3, Activity, Upload, FileSearch,
  Search, Filter, Mail, Building2, ChevronDown, ChevronRight,
  UserCog, UserMinus, UserPlus, CheckSquare, Square, LayoutGrid,
  List, GitBranch,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserRole = 'admin' | 'accounting' | 'sales' | 'operations' | 'hr' | 'readonly';

interface UserRecord {
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  addedAt: string;
}

interface OrgDirectoryUser {
  displayName: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  role: UserRole;
  manager: string | null;
  managerEmail: string | null;
  status: 'active' | 'inactive';
  phone: string | null;
}

type ViewMode = 'grid' | 'table' | 'org';
type SortKey = 'name' | 'department' | 'role';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: UserRole[] = ['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly'];

const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#FF5C00',
  accounting: '#3B82F6',
  sales: '#22C55E',
  operations: '#EAB308',
  hr: '#A855F7',
  readonly: '#6B7280',
};

const DEPT_COLORS: Record<string, string> = {
  'Executive': '#FF5C00',
  'Accounting': '#3B82F6',
  'Sales': '#22C55E',
  'Operations': '#EAB308',
  'HR': '#A855F7',
  'IT': '#06B6D4',
  'Marketing': '#EC4899',
  'Finance': '#3B82F6',
};

const ADMIN_TABS = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/permissions', label: 'Permissions', icon: Shield },
  { href: '/admin/usage', label: 'Usage', icon: BarChart3 },
  { href: '/admin/health', label: 'Health', icon: Activity },
  { href: '/admin/audit', label: 'Audit', icon: FileSearch },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name.slice(0, 2) || '??').toUpperCase();
}

function getDeptColor(dept: string | null): string {
  if (!dept) return '#6B7280';
  for (const [key, color] of Object.entries(DEPT_COLORS)) {
    if (dept.toLowerCase().includes(key.toLowerCase())) return color;
  }
  // Hash-based fallback
  let hash = 0;
  for (let i = 0; i < dept.length; i++) {
    hash = dept.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 50%)`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatsHeader({ users }: { users: OrgDirectoryUser[] }) {
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const inactiveUsers = totalUsers - activeUsers;

  const byRole = ROLE_OPTIONS.reduce<Record<string, number>>((acc, role) => {
    acc[role] = users.filter((u) => u.role === role).length;
    return acc;
  }, {});

  const departments = new Set((users ?? []).map((u) => u.department).filter(Boolean));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users size={14} className="text-[#A1A1AA]" />
          <span className="text-xs text-[#A1A1AA] font-medium">Total Users</span>
        </div>
        <p className="text-lg font-bold text-white">{totalUsers}</p>
      </div>
      <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={14} className="text-green-500" />
          <span className="text-xs text-[#A1A1AA] font-medium">Active / Inactive</span>
        </div>
        <p className="text-lg font-bold text-white">
          {activeUsers} <span className="text-sm text-[#A1A1AA]">/ {inactiveUsers}</span>
        </p>
      </div>
      <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={14} className="text-[#A1A1AA]" />
          <span className="text-xs text-[#A1A1AA] font-medium">Departments</span>
        </div>
        <p className="text-lg font-bold text-white">{departments.size}</p>
      </div>
      <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={14} className="text-[#A1A1AA]" />
          <span className="text-xs text-[#A1A1AA] font-medium">By Role</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_OPTIONS.map((role) => (
            <span
              key={role}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role] }}
            >
              {role}: {byRole[role] ?? 0}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function UserCard({
  user,
  selected,
  onSelect,
  onRoleChange,
  onDeactivate,
}: {
  user: OrgDirectoryUser;
  selected: boolean;
  onSelect: (email: string) => void;
  onRoleChange: (email: string, role: UserRole) => void;
  onDeactivate: (email: string) => void;
}) {
  const deptColor = getDeptColor(user.department);
  const roleColor = ROLE_COLORS[user.role];

  return (
    <div
      className={[
        'rounded-lg border bg-[#18181B] p-4 transition-all hover:border-[#3F3F46]',
        selected ? 'border-[#FF5C00] ring-1 ring-[#FF5C00]/30' : 'border-[#27272A]',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        {/* Select checkbox */}
        <button
          onClick={() => onSelect(user.email)}
          className="mt-0.5 text-[#A1A1AA] hover:text-white transition-colors"
        >
          {selected ? <CheckSquare size={16} className="text-[#FF5C00]" /> : <Square size={16} />}
        </button>

        {/* Avatar */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: deptColor }}
        >
          {getInitials(user.displayName)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-xs font-semibold text-white truncate">{user.displayName}</h4>
            <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: user.status === 'active' ? '#22C55E' : '#EF4444' }} />
          </div>
          {user.jobTitle && (
            <p className="text-xs text-[#A1A1AA] truncate">{user.jobTitle}</p>
          )}
          {user.department && (
            <p className="text-[10px] text-[#71717A] flex items-center gap-1 mt-0.5">
              <Building2 size={10} />
              {user.department}
            </p>
          )}
          <a
            href={`mailto:${user.email}`}
            className="text-[10px] text-[#3B82F6] hover:underline flex items-center gap-1 mt-0.5 truncate"
          >
            <Mail size={10} />
            {user.email}
          </a>
          {user.manager && (
            <p className="text-[10px] text-[#71717A] mt-0.5">
              Manager: {user.manager}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#27272A]">
        <select
          value={user.role}
          onChange={(e) => onRoleChange(user.email, e.target.value as UserRole)}
          className="rounded border border-[#3F3F46] bg-[#27272A] px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#FF5C00]/30"
          style={{ color: roleColor }}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r} style={{ color: ROLE_COLORS[r] }}>
              {r}
            </option>
          ))}
        </select>
        {user.status === 'active' && (
          <button
            onClick={() => onDeactivate(user.email)}
            className="text-[10px] text-red-400 hover:text-red-300 font-medium transition-colors flex items-center gap-1"
          >
            <UserMinus size={10} />
            Deactivate
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Org Chart
// ---------------------------------------------------------------------------

interface OrgNode {
  user: OrgDirectoryUser;
  reports: OrgNode[];
}

function buildOrgTree(users: OrgDirectoryUser[]): OrgNode[] {
  const emailMap = new Map<string, OrgDirectoryUser>();
  for (const u of users) {
    emailMap.set(u.email.toLowerCase(), u);
  }

  const childrenMap = new Map<string, OrgDirectoryUser[]>();
  const rootUsers: OrgDirectoryUser[] = [];

  for (const u of users) {
    const mgrEmail = u.managerEmail?.toLowerCase();
    if (mgrEmail && emailMap.has(mgrEmail) && mgrEmail !== u.email.toLowerCase()) {
      const existing = childrenMap.get(mgrEmail) ?? [];
      existing.push(u);
      childrenMap.set(mgrEmail, existing);
    } else {
      rootUsers.push(u);
    }
  }

  function buildNode(user: OrgDirectoryUser): OrgNode {
    const reports = (childrenMap.get(user.email.toLowerCase()) ?? [])
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map(buildNode);
    return { user, reports };
  }

  return rootUsers
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map(buildNode);
}

function OrgTreeNode({ node, depth }: { node: OrgNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasReports = node.reports.length > 0;
  const roleColor = ROLE_COLORS[node.user.role];
  const deptColor = getDeptColor(node.user.department);

  return (
    <div className="ml-0">
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-[#27272A]/50 transition-colors"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {hasReports ? (
          <button onClick={() => setExpanded(!expanded)} className="text-[#A1A1AA] hover:text-white">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-[14px]" />
        )}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ backgroundColor: deptColor }}
        >
          {getInitials(node.user.displayName)}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-white font-medium">{node.user.displayName}</span>
          {node.user.jobTitle && (
            <span className="text-xs text-[#71717A] ml-2">{node.user.jobTitle}</span>
          )}
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0"
          style={{ backgroundColor: `${roleColor}20`, color: roleColor }}
        >
          {node.user.role}
        </span>
        {hasReports && (
          <span className="text-[10px] text-[#71717A]">{node.reports.length} reports</span>
        )}
      </div>
      {expanded && hasReports && (
        <div>
          {node.reports.map((child) => (
            <OrgTreeNode key={child.user.email} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgChartView({ users }: { users: OrgDirectoryUser[] }) {
  const tree = useMemo(() => buildOrgTree(users), [users]);

  if (tree.length === 0) {
    return (
      <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-8 text-center text-[#A1A1AA]">
        No org data available. Connect MS Graph to populate the org chart.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden">
      <div className="px-3 py-2 border-b border-[#27272A] flex items-center gap-2">
        <GitBranch size={14} className="text-[#FF5C00]" />
        <h3 className="text-xs font-semibold text-white">Organization Hierarchy</h3>
      </div>
      <div className="p-2 max-h-[600px] overflow-y-auto">
        {tree.map((node) => (
          <OrgTreeNode key={node.user.email} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminUsersPage() {
  const { data: session } = useSession();

  // Data
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgDirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add user form
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('readonly');
  const [submitting, setSubmitting] = useState(false);

  // Bulk
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // View & filters
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);

  // ----- Data fetching -----

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      } else {
        setError(data.error ?? 'Failed to load users');
      }
    } catch {
      setError('Unable to reach users API');
    }
  }, []);

  const fetchOrgDirectory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/org-directory');
      const data = await res.json();
      if (data.users) {
        setOrgUsers(data.users);
      }
    } catch {
      // Org directory is optional — Graph may not be connected
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchOrgDirectory()]).finally(() => setLoading(false));
  }, [fetchUsers, fetchOrgDirectory]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // ----- Merged user list -----

  const mergedUsers: OrgDirectoryUser[] = useMemo(() => {
    const emailMap = new Map<string, OrgDirectoryUser>();

    // Start with org directory data
    for (const u of orgUsers) {
      emailMap.set(u.email.toLowerCase(), u);
    }

    // Overlay / add from users API (role + status)
    for (const u of users) {
      const email = u.email.toLowerCase();
      const existing = emailMap.get(email);
      if (existing) {
        emailMap.set(email, { ...existing, role: u.role, status: u.status });
      } else {
        const fallbackName = email
          .split('@')[0]
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/^./, (c) => c.toUpperCase());
        emailMap.set(email, {
          displayName: fallbackName,
          email,
          jobTitle: null,
          department: null,
          role: u.role,
          manager: null,
          managerEmail: null,
          status: u.status,
          phone: null,
        });
      }
    }

    return Array.from(emailMap.values());
  }, [users, orgUsers]);

  // ----- Filters -----

  const departments = useMemo(() => {
    const depts = new Set<string>();
    for (const u of mergedUsers) {
      if (u.department) depts.add(u.department);
    }
    return Array.from(depts).sort();
  }, [mergedUsers]);

  const filteredUsers = useMemo(() => {
    let list = [...mergedUsers];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.jobTitle ?? '').toLowerCase().includes(q)
      );
    }

    // Role
    if (filterRole !== 'all') {
      list = list.filter((u) => u.role === filterRole);
    }

    // Department
    if (filterDepartment !== 'all') {
      list = list.filter((u) => u.department === filterDepartment);
    }

    // Status
    if (filterStatus !== 'all') {
      list = list.filter((u) => u.status === filterStatus);
    }

    // Sort
    list.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        case 'department':
          return (a.department ?? '').localeCompare(b.department ?? '');
        case 'role':
          return a.role.localeCompare(b.role);
        default:
          return 0;
      }
    });

    return list;
  }, [mergedUsers, searchQuery, filterRole, filterDepartment, filterStatus, sortBy]);

  // ----- Actions -----

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!newEmail.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Added ${newEmail.trim()}`);
        setNewEmail('');
        setNewRole('readonly');
        setShowAddForm(false);
        await fetchUsers();
      } else {
        setError(data.error ?? 'Failed to add user');
      }
    } catch {
      setError('Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkInvite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearMessages();
    setBulkProcessing(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      for (const line of lines) {
        const [emailVal, roleVal] = line.split(',').map((s) => s.trim());
        if (!emailVal || !emailVal.includes('@')) {
          errorCount++;
          errors.push(`Invalid email: ${emailVal ?? 'empty'}`);
          continue;
        }
        const validRole = ROLE_OPTIONS.includes(roleVal as UserRole) ? roleVal : 'readonly';
        try {
          const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailVal, role: validRole }),
          });
          if (res.ok) {
            successCount++;
          } else {
            const data = await res.json();
            errorCount++;
            errors.push(`${emailVal}: ${data.error ?? 'failed'}`);
          }
        } catch {
          errorCount++;
          errors.push(`${emailVal}: network error`);
        }
      }
      if (successCount > 0) {
        setSuccess(`Bulk invite: ${successCount} added${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
      }
      if (errorCount > 0 && successCount === 0) {
        setError(`Bulk invite: all ${errorCount} failed. ${errors.slice(0, 3).join('; ')}`);
      } else if (errorCount > 0) {
        setError(`${errorCount} failed: ${errors.slice(0, 3).join('; ')}`);
      }
      await fetchUsers();
    } catch {
      setError('Failed to process CSV file');
    } finally {
      setBulkProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChangeRole = async (email: string, role: UserRole) => {
    clearMessages();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      if (res.ok) {
        setSuccess(`Updated ${email} to ${role}`);
        await fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to update role');
      }
    } catch {
      setError('Failed to update role');
    }
  };

  const handleDeactivate = async (email: string) => {
    clearMessages();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSuccess(`Deactivated ${email}`);
        await fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to deactivate user');
      }
    } catch {
      setError('Failed to deactivate user');
    }
  };

  const toggleSelect = (email: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.email)));
    }
  };

  const handleBulkRoleChange = async (role: UserRole) => {
    clearMessages();
    const emails = Array.from(selectedUsers);
    let count = 0;
    for (const email of emails) {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role }),
        });
        if (res.ok) count++;
      } catch {
        // continue
      }
    }
    if (count > 0) {
      setSuccess(`Updated ${count} user(s) to ${role}`);
      setSelectedUsers(new Set());
      await fetchUsers();
    }
  };

  const userRole = session?.user?.role ?? 'admin';

  return (
    <div className="px-5 py-4 space-y-5 overflow-y-auto h-full bg-[#09090B]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-[#FF5C00]" />
          <div>
            <h2 className="text-lg font-bold text-white">Admin Portal</h2>
            <p className="mt-0.5 text-sm text-[#A1A1AA]">Manage users, permissions, usage, and system health</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold bg-[#09090B] text-[#FF5C00] border border-[#27272A] uppercase tracking-wide">
          {userRole}
        </span>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-[#27272A]">
        {ADMIN_TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin/users';
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                active
                  ? 'border-[#FF5C00] text-[#FF5C00]'
                  : 'border-transparent text-[#71717A] hover:text-white hover:border-[#3F3F46]',
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
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {success}
        </div>
      )}

      {/* Stats */}
      {!loading && <StatsHeader users={mergedUsers} />}

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search by name, email, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-[#27272A] bg-[#18181B] pl-9 pr-3 py-2 text-sm text-white placeholder:text-[#71717A] focus:outline-none focus:ring-1 focus:ring-[#FF5C00]/30 focus:border-[#FF5C00]"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-[#71717A]" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
              className="rounded border border-[#27272A] bg-[#18181B] px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#FF5C00]/30"
            >
              <option value="all">All Roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="rounded border border-[#27272A] bg-[#18181B] px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#FF5C00]/30"
          >
            <option value="all">All Depts</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="rounded border border-[#27272A] bg-[#18181B] px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#FF5C00]/30"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded border border-[#27272A] bg-[#18181B] px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#FF5C00]/30"
          >
            <option value="name">Sort: Name</option>
            <option value="department">Sort: Dept</option>
            <option value="role">Sort: Role</option>
          </select>

          {/* View toggles */}
          <div className="flex items-center border border-[#27272A] rounded overflow-hidden">
            {([
              { mode: 'grid' as ViewMode, icon: LayoutGrid },
              { mode: 'table' as ViewMode, icon: List },
              { mode: 'org' as ViewMode, icon: GitBranch },
            ]).map(({ mode, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={[
                  'p-1.5 transition-colors',
                  viewMode === mode ? 'bg-[#FF5C00] text-white' : 'bg-[#18181B] text-[#71717A] hover:text-white',
                ].join(' ')}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 rounded-md bg-[#FF5C00] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#E54800] transition-colors"
        >
          <UserPlus size={12} />
          Add User
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleBulkInvite}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={bulkProcessing}
          className="flex items-center gap-1.5 rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#27272A] disabled:opacity-50 transition-colors"
        >
          <Upload size={12} />
          {bulkProcessing ? 'Processing...' : 'Bulk CSV'}
        </button>

        {selectedUsers.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-[#A1A1AA]">{selectedUsers.size} selected</span>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) handleBulkRoleChange(e.target.value as UserRole);
                e.target.value = '';
              }}
              className="rounded border border-[#27272A] bg-[#18181B] px-2 py-1 text-xs text-white focus:outline-none"
            >
              <option value="" disabled>Bulk set role...</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        <div className="ml-auto text-xs text-[#71717A]">
          {filteredUsers.length} of {mergedUsers.length} users
        </div>
      </div>

      {/* Add user form (collapsible) */}
      {showAddForm && (
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
          <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
            <UserPlus size={14} className="text-[#FF5C00]" />
            Add New User
          </h3>
          <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="user@delta360.energy"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1 rounded-md border border-[#27272A] bg-[#27272A] px-3 py-2 text-sm text-white placeholder:text-[#71717A] focus:outline-none focus:ring-1 focus:ring-[#FF5C00]/30 focus:border-[#FF5C00]"
              required
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="rounded-md border border-[#27272A] bg-[#27272A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#FF5C00]/30"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[#FF5C00] px-4 py-2 text-sm font-medium text-white hover:bg-[#E54800] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Adding...' : 'Add User'}
            </button>
          </form>
          <p className="mt-2 text-[10px] text-[#71717A]">CSV format: email,role (one per line). Valid roles: {ROLE_OPTIONS.join(', ')}</p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-12 text-center text-[#A1A1AA]">
          Loading users...
        </div>
      ) : viewMode === 'org' ? (
        <OrgChartView users={filteredUsers} />
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredUsers.length === 0 ? (
            <div className="col-span-full rounded-lg border border-[#27272A] bg-[#18181B] p-8 text-center text-[#A1A1AA]">
              No users match your filters.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <UserCard
                key={user.email}
                user={user}
                selected={selectedUsers.has(user.email)}
                onSelect={toggleSelect}
                onRoleChange={handleChangeRole}
                onDeactivate={handleDeactivate}
              />
            ))
          )}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A] bg-[#27272A]">
                <th className="text-left px-3 py-2 w-8">
                  <button onClick={selectAll} className="text-[#A1A1AA] hover:text-white">
                    {selectedUsers.size === filteredUsers.length && filteredUsers.length > 0 ? (
                      <CheckSquare size={14} className="text-[#FF5C00]" />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-medium text-[#71717A]">User</th>
                <th className="text-left px-3 py-2 font-medium text-[#71717A] hidden md:table-cell">Department</th>
                <th className="text-left px-3 py-2 font-medium text-[#71717A]">Role</th>
                <th className="text-left px-3 py-2 font-medium text-[#71717A] hidden lg:table-cell">Manager</th>
                <th className="text-left px-3 py-2 font-medium text-[#71717A]">Status</th>
                <th className="text-left px-3 py-2 font-medium text-[#71717A]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#A1A1AA]">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const deptColor = getDeptColor(user.department);
                  const roleColor = ROLE_COLORS[user.role];
                  return (
                    <tr
                      key={user.email}
                      className="border-b border-[#27272A] last:border-0 hover:bg-[#27272A]/30"
                    >
                      <td className="px-3 py-2">
                        <button onClick={() => toggleSelect(user.email)} className="text-[#A1A1AA] hover:text-white">
                          {selectedUsers.has(user.email) ? (
                            <CheckSquare size={14} className="text-[#FF5C00]" />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: deptColor }}
                          >
                            {getInitials(user.displayName)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                            <a href={`mailto:${user.email}`} className="text-[10px] text-[#3B82F6] hover:underline truncate block">
                              {user.email}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <span className="text-xs text-[#A1A1AA]">{user.department ?? '-'}</span>
                        {user.jobTitle && (
                          <span className="block text-[10px] text-[#71717A]">{user.jobTitle}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.email, e.target.value as UserRole)}
                          className="rounded border border-[#3F3F46] bg-[#27272A] px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#FF5C00]/30"
                          style={{ color: roleColor }}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <span className="text-xs text-[#A1A1AA]">{user.manager ?? '-'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={[
                            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                            user.status === 'active'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-red-500/10 text-red-400',
                          ].join(' ')}
                        >
                          <span
                            className={[
                              'w-1.5 h-1.5 rounded-full',
                              user.status === 'active' ? 'bg-green-500' : 'bg-red-500',
                            ].join(' ')}
                          />
                          {user.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {user.status === 'active' && (
                          <button
                            onClick={() => handleDeactivate(user.email)}
                            className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
