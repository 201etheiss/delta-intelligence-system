import {
  getDashboardMetrics,
  getCloseTemplatesByCategory,
  getAccountsByType,
  getActivityLog,
} from '@/lib/db';
import DashboardContent from './DashboardContent';

export default async function DashboardPage() {
  const [metrics, closeCategories, accountTypes, activityLog] = await Promise.all([
    getDashboardMetrics(),
    getCloseTemplatesByCategory(),
    getAccountsByType(),
    getActivityLog(10),
  ]);

  return (
    <DashboardContent
      metrics={metrics}
      closeCategories={closeCategories}
      accountTypes={accountTypes}
      activityLog={activityLog}
    />
  );
}
