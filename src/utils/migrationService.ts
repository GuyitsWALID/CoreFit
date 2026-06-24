import {
  buildLegacyMigrationPlan,
  executeLegacyMigrationPlan,
  parseSqlInsertBlocks,
} from './legacyMigration.ts';
import type { LegacyMigrationPlan } from './legacyMigration.ts';

export { parseSqlInsertBlocks };

const asContents = (input: string | string[]) => Array.isArray(input) ? input : [input];

export const buildMigrationPlan = (input: string | string[], targetGymId: string): LegacyMigrationPlan =>
  buildLegacyMigrationPlan(asContents(input), targetGymId);

export const generatePreview = (input: string | string[], targetGymId: string) => {
  const plan = buildMigrationPlan(input, targetGymId);
  return {
    detectedTables: plan.detectedTables,
    sourceCounts: plan.sourceCounts,
    packagesInserted: plan.packages.length,
    usersInserted: plan.users.length,
    staffInserted: plan.staff.length,
    paymentsInserted: plan.payments.length,
    freezesInserted: plan.membershipFreezes.length,
    checkinsInserted: plan.clientCheckins.length,
    trainerAssignmentsInserted: plan.trainerAssignments.length,
    skippedRows: plan.issues.slice(0, 200),
    skippedCount: plan.issues.length,
    warnings: plan.warnings,
    ready: plan.users.length > 0 || plan.packages.length > 0 || plan.staff.length > 0,
  };
};

// Kept as an emergency diagnostic fallback. The primary workflow now executes
// the validated plan directly through migrate-run.
export const generateMigrationSql = (input: string | string[], targetGymId: string) => {
  const preview = generatePreview(input, targetGymId);
  return {
    preview,
    migrationSql: [
      '-- CoreFit automatic migration no longer requires pasting generated SQL.',
      '-- Use Admin > Import Data > Automatic Legacy Migration.',
      `-- Target gym: ${targetGymId}`,
      `-- Preview: ${JSON.stringify(preview)}`,
    ].join('\n'),
  };
};

export const executeMigration = async (
  input: string | string[],
  targetGymId: string,
  supabaseClient: any,
  isDryRun = true,
  onProgress?: (percent: number, message?: string) => void,
) => {
  const plan = buildMigrationPlan(input, targetGymId);
  return executeLegacyMigrationPlan(
    plan,
    supabaseClient,
    isDryRun,
    (message, percent) => onProgress?.(percent, message),
  );
};
