import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Parallel fetch all metrics from Supabase
    const [
      entitiesRes,
      accountsRes,
      closeTemplatesRes,
      journalTemplatesRes,
      reconRulesRes,
      projectsRes,
      auditItemsRes,
      usersRes,
      sourceSystemsRes,
      profitCentersRes,
      activityLogRes,
    ] = await Promise.all([
      supabaseService.from('entities').select('id, name, code, entity_type, is_active'),
      supabaseService.from('accounts').select('id, name, account_type, entity_id, is_active, normal_balance'),
      supabaseService.from('close_templates').select('id, name, category, frequency, estimated_hours, is_active'),
      supabaseService.from('journal_templates').select('id, name, entry_type, frequency, is_active'),
      supabaseService.from('recon_rules').select('id, name, rule_type, source_system, is_active'),
      supabaseService.from('projects').select('id, name, status, budget, start_date, end_date'),
      supabaseService.from('audit_items').select('id, title, category, severity, status, due_date'),
      supabaseService.from('users').select('id, full_name, role, department, is_active'),
      supabaseService.from('source_systems').select('id, name, system_type, connection_status'),
      supabaseService.from('profit_centers').select('id, name, code, entity_id'),
      supabaseService.from('activity_log').select('id, action, entity_type, description, created_at').order('created_at', { ascending: false }).limit(20),
    ]);

    const entities = entitiesRes.data || [];
    const accounts = accountsRes.data || [];
    const closeTemplates = closeTemplatesRes.data || [];
    const journalTemplates = journalTemplatesRes.data || [];
    const reconRules = reconRulesRes.data || [];
    const projects = projectsRes.data || [];
    const auditItems = auditItemsRes.data || [];
    const users = usersRes.data || [];
    const sourceSystems = sourceSystemsRes.data || [];
    const profitCenters = profitCentersRes.data || [];
    const activityLog = activityLogRes.data || [];

    // Compute aggregated metrics
    const accountsByType: Record<string, number> = {};
    accounts.forEach((a: { account_type: string }) => {
      const t = a.account_type || 'other';
      accountsByType[t] = (accountsByType[t] || 0) + 1;
    });

    const closeByCategory: Record<string, number> = {};
    closeTemplates.forEach((ct: { category: string }) => {
      const c = ct.category || 'other';
      closeByCategory[c] = (closeByCategory[c] || 0) + 1;
    });

    const closeByFrequency: Record<string, number> = {};
    closeTemplates.forEach((ct: { frequency: string }) => {
      const f = ct.frequency || 'other';
      closeByFrequency[f] = (closeByFrequency[f] || 0) + 1;
    });

    const entityTypes: Record<string, number> = {};
    entities.forEach((e: { entity_type: string }) => {
      const t = e.entity_type || 'other';
      entityTypes[t] = (entityTypes[t] || 0) + 1;
    });

    const journalsByType: Record<string, number> = {};
    journalTemplates.forEach((jt: { entry_type: string }) => {
      const t = jt.entry_type || 'other';
      journalsByType[t] = (journalsByType[t] || 0) + 1;
    });

    const reconByType: Record<string, number> = {};
    reconRules.forEach((r: { rule_type: string }) => {
      const t = r.rule_type || 'other';
      reconByType[t] = (reconByType[t] || 0) + 1;
    });

    const auditBySeverity: Record<string, number> = {};
    auditItems.forEach((a: { severity: string }) => {
      const s = a.severity || 'unknown';
      auditBySeverity[s] = (auditBySeverity[s] || 0) + 1;
    });

    const totalEstimatedHours = closeTemplates.reduce(
      (sum: number, ct: { estimated_hours: number }) => sum + (ct.estimated_hours || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        // Counts
        totalEntities: entities.length,
        totalAccounts: accounts.length,
        totalCloseTemplates: closeTemplates.length,
        totalJournalTemplates: journalTemplates.length,
        totalReconRules: reconRules.length,
        totalProjects: projects.length,
        totalAuditItems: auditItems.length,
        totalUsers: users.length,
        totalSourceSystems: sourceSystems.length,
        totalProfitCenters: profitCenters.length,
        totalEstimatedHours,

        // Breakdowns for charts
        accountsByType,
        closeByCategory,
        closeByFrequency,
        entityTypes,
        journalsByType,
        reconByType,
        auditBySeverity,

        // Recent activity
        recentActivity: activityLog,

        // Raw data for tables
        entities,
        projects,
        auditItems: auditItems.slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
