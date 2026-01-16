#!/usr/bin/env tsx
/**
 * Seed a test workspace for development.
 *
 * Usage:
 *   npx tsx scripts/seed-workspace.ts [workspace-name]
 *
 * Creates a workspace and prints its ID for use with bulk-ingest.ts.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const name = process.argv[2] || 'dev-workspace';

  // Check if workspace already exists
  const existing = await prisma.workspace.findFirst({
    where: { name },
  });

  if (existing) {
    console.log(`Workspace "${name}" already exists`);
    console.log(`ID: ${existing.id}`);
    return;
  }

  // Create workspace
  const workspace = await prisma.workspace.create({
    data: { name },
  });

  console.log(`Created workspace "${name}"`);
  console.log(`ID: ${workspace.id}`);
  console.log(`\nUse this ID with the ingest script:`);
  console.log(`  npx tsx scripts/bulk-ingest.ts ${workspace.id} <docs-path> --corpus docs`);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
