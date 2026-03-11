import {
  getAccounts,
  getCloseTemplates,
  getReconRules,
  getEntities,
  getActivityLog,
  getSourceSystems,
  getUsers,
} from '@/lib/db';
import DashboardContent from './DashboardContent';

export default async function DashboardPage() {
  const [accounts, closeTemplates, reconRules, entities, activityLog, sourceSystems, users] =
    await Promise.all([
      getAccounts(),
      getCloseTemplates(),
      getReconRules(),
      getEntities(),
      getActivityLog(50),
      getSourceSystems(),
      getUsers(),
    ]);

  return (
    <DashboardContent
      data={{
        accounts,
        closeTemplates,
        reconRules,
        entities,
        activityLog,
        sourceSystems,
        users,
      }}
    />
  );
}
