import { supabaseService } from './supabase';

// Type definitions
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string;
  is_active: boolean;
}

export interface Entity {
  id: string;
  name: string;
  code: string;
  entity_type: string;
  currency: string;
  is_active: boolean;
}

export interface Account {
  id: string;
  account_number: string;
  name: string;
  account_type: string;
  entity_id: string;
  is_active: boolean;
  normal_balance: string;
}

export interface CloseTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  owner_id: string;
  frequency: string;
  estimated_hours: number;
  is_active: boolean;
}

export interface JournalTemplate {
  id: string;
  name: string;
  template_type: string;
  entity_id: string;
  frequency: string;
  is_active: boolean;
}

export interface ReconRule {
  id: string;
  name: string;
  account_id: string;
  rule_type: string;
  source_system: string;
  threshold_amount: number;
  is_active: boolean;
}

export interface ProfitCenter {
  id: string;
  name: string;
  code: string;
  entity_id: string;
  manager_id: string;
  is_active: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  owner_id: string;
  start_date: string;
  target_date: string;
}

export interface Responsibility {
  id: string;
  title: string;
  responsibility_type: string;
  assigned_to_id: string;
  entity_id: string;
  is_active: boolean;
}

export interface SourceSystem {
  id: string;
  name: string;
  system_type: string;
  connection_status: string;
}

export interface AuditItem {
  id: string;
  title: string;
  category: string;
  status: string;
  assigned_to_id: string;
  due_date: string;
}

export interface KPIThreshold {
  id: string;
  kpi_name: string;
  target_value: number;
  warning_threshold: number;
  critical_threshold: number;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  category: string;
}

/**
 * Get all users
 */
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabaseService
    .from('users')
    .select('*');

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a single user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabaseService
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    console.error('Error fetching user by email:', error);
    return null;
  }

  return data || null;
}

/**
 * Get a single user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching user by ID:', error);
    return null;
  }

  return data || null;
}

/**
 * Get dashboard metrics - aggregate counts from multiple tables
 */
export async function getDashboardMetrics() {
  try {
    const [usersRes, entitiesRes, accountsRes, closeTemplatesRes, journalTemplatesRes, reconRulesRes] =
      await Promise.all([
        supabaseService.from('users').select('id', { count: 'exact' }).eq('is_active', true),
        supabaseService
          .from('entities')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
        supabaseService
          .from('accounts')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
        supabaseService
          .from('close_templates')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
        supabaseService
          .from('journal_templates')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
        supabaseService
          .from('recon_rules')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
      ]);

    return {
      activeUsers: usersRes.count || 0,
      activeEntities: entitiesRes.count || 0,
      activeAccounts: accountsRes.count || 0,
      activeCloseTemplates: closeTemplatesRes.count || 0,
      activeJournalTemplates: journalTemplatesRes.count || 0,
      activeReconRules: reconRulesRes.count || 0,
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return {
      activeUsers: 0,
      activeEntities: 0,
      activeAccounts: 0,
      activeCloseTemplates: 0,
      activeJournalTemplates: 0,
      activeReconRules: 0,
    };
  }
}

/**
 * Get all close templates
 */
export async function getCloseTemplates(): Promise<CloseTemplate[]> {
  const { data, error } = await supabaseService
    .from('close_templates')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching close templates:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all journal templates
 */
export async function getJournalTemplates(): Promise<JournalTemplate[]> {
  const { data, error } = await supabaseService
    .from('journal_templates')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching journal templates:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all recon rules
 */
export async function getReconRules(): Promise<ReconRule[]> {
  const { data, error } = await supabaseService
    .from('recon_rules')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching recon rules:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all accounts
 */
export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabaseService
    .from('accounts')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching accounts:', error);
    return [];
  }

  return data || [];
}

/**
 * Get accounts by entity ID
 */
export async function getAccountsByEntity(entityId: string): Promise<Account[]> {
  const { data, error } = await supabaseService
    .from('accounts')
    .select('*')
    .eq('entity_id', entityId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching accounts by entity:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all entities
 */
export async function getEntities(): Promise<Entity[]> {
  const { data, error } = await supabaseService
    .from('entities')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching entities:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a single entity by ID
 */
export async function getEntityById(id: string): Promise<Entity | null> {
  const { data, error } = await supabaseService
    .from('entities')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching entity by ID:', error);
    return null;
  }

  return data || null;
}

/**
 * Get all profit centers
 */
export async function getProfitCenters(): Promise<ProfitCenter[]> {
  const { data, error } = await supabaseService
    .from('profit_centers')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching profit centers:', error);
    return [];
  }

  return data || [];
}

/**
 * Get profit centers by entity ID
 */
export async function getProfitCentersByEntity(entityId: string): Promise<ProfitCenter[]> {
  const { data, error } = await supabaseService
    .from('profit_centers')
    .select('*')
    .eq('entity_id', entityId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching profit centers by entity:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all projects
 */
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabaseService
    .from('projects')
    .select('*');

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }

  return data || [];
}

/**
 * Get active projects only
 */
export async function getActiveProjects(): Promise<Project[]> {
  const { data, error } = await supabaseService
    .from('projects')
    .select('*')
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching active projects:', error);
    return [];
  }

  return data || [];
}

/**
 * Get projects by owner ID
 */
export async function getProjectsByOwner(ownerId: string): Promise<Project[]> {
  const { data, error } = await supabaseService
    .from('projects')
    .select('*')
    .eq('owner_id', ownerId);

  if (error) {
    console.error('Error fetching projects by owner:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all responsibilities
 */
export async function getResponsibilities(): Promise<Responsibility[]> {
  const { data, error } = await supabaseService
    .from('responsibilities')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching responsibilities:', error);
    return [];
  }

  return data || [];
}

/**
 * Get responsibilities assigned to a user
 */
export async function getResponsibilitiesByUser(userId: string): Promise<Responsibility[]> {
  const { data, error } = await supabaseService
    .from('responsibilities')
    .select('*')
    .eq('assigned_to_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching responsibilities by user:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all source systems
 */
export async function getSourceSystems(): Promise<SourceSystem[]> {
  const { data, error } = await supabaseService
    .from('source_systems')
    .select('*');

  if (error) {
    console.error('Error fetching source systems:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all audit items
 */
export async function getAuditItems(): Promise<AuditItem[]> {
  const { data, error } = await supabaseService
    .from('audit_items')
    .select('*');

  if (error) {
    console.error('Error fetching audit items:', error);
    return [];
  }

  return data || [];
}

/**
 * Get pending audit items only
 */
export async function getPendingAuditItems(): Promise<AuditItem[]> {
  const { data, error } = await supabaseService
    .from('audit_items')
    .select('*')
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching pending audit items:', error);
    return [];
  }

  return data || [];
}

/**
 * Get audit items assigned to a user
 */
export async function getAuditItemsByUser(userId: string): Promise<AuditItem[]> {
  const { data, error } = await supabaseService
    .from('audit_items')
    .select('*')
    .eq('assigned_to_id', userId);

  if (error) {
    console.error('Error fetching audit items by user:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all KPI thresholds
 */
export async function getKPIThresholds(): Promise<KPIThreshold[]> {
  const { data, error } = await supabaseService
    .from('kpi_thresholds')
    .select('*');

  if (error) {
    console.error('Error fetching KPI thresholds:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all activity log entries
 */
export async function getActivityLog(limit: number = 50): Promise<ActivityLog[]> {
  const { data, error } = await supabaseService
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activity log:', error);
    return [];
  }

  return data || [];
}

/**
 * Get activity log entries for a specific user
 */
export async function getActivityLogByUser(userId: string, limit: number = 50): Promise<ActivityLog[]> {
  const { data, error } = await supabaseService
    .from('activity_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activity log by user:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all settings
 */
export async function getSettings(): Promise<Setting[]> {
  const { data, error } = await supabaseService
    .from('settings')
    .select('*');

  if (error) {
    console.error('Error fetching settings:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a setting by key
 */
export async function getSetting(key: string): Promise<Setting | null> {
  const { data, error } = await supabaseService
    .from('settings')
    .select('*')
    .eq('key', key)
    .single();

  if (error) {
    console.error('Error fetching setting:', error);
    return null;
  }

  return data || null;
}

/**
 * Get close templates grouped by category with counts
 */
export async function getCloseTemplatesByCategory() {
  try {
    const { data, error } = await supabaseService
      .from('close_templates')
      .select('category')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching close templates by category:', error);
      return [];
    }

    const categoryMap: Record<string, number> = {};
    (data || []).forEach((item) => {
      const category = item.category || 'Uncategorized';
      categoryMap[category] = (categoryMap[category] || 0) + 1;
    });

    return Object.entries(categoryMap).map(([category, count]) => ({
      category,
      count,
    }));
  } catch (error) {
    console.error('Error processing close templates by category:', error);
    return [];
  }
}

/**
 * Get accounts grouped by account type with counts
 */
export async function getAccountsByType() {
  try {
    const { data, error } = await supabaseService
      .from('accounts')
      .select('account_type')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching accounts by type:', error);
      return [];
    }

    const typeMap: Record<string, number> = {};
    (data || []).forEach((item) => {
      const type = item.account_type || 'Other';
      typeMap[type] = (typeMap[type] || 0) + 1;
    });

    return Object.entries(typeMap).map(([type, count]) => ({
      type,
      count,
    }));
  } catch (error) {
    console.error('Error processing accounts by type:', error);
    return [];
  }
}
