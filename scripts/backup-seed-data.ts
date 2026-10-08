/**
 * Backup seed data (and any real-user rows attached to it) to backups/.
 *
 * Usage: npm run db:backup
 * Writes: backups/seed-backup-<timestamp>.json
 */

import { prisma } from "../app/lib/db/prisma";
import { collectSeedData, writeBackup } from "./lib/seedMarkers";

async function main() {
  const backup = await collectSeedData(prisma);
  const file = writeBackup(backup);

  console.log("Seed data backup written:");
  console.log(`  ${file}`);
  for (const [model, count] of Object.entries(backup.counts)) {
    console.log(`  ${model.padEnd(24)} ${count}`);
  }

  if (
    Object.values(backup.counts).every((c) => c === 0)
  ) {
    console.log("\nNo seed data found in the database.");
  }
}

main()
  .catch((error) => {
    console.error("Backup failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
