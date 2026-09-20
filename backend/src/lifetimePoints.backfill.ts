import { PrismaClient } from "@prisma/client";

import { runLifetimePointsBackfill } from "./lifetimePointsBackfill";

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log("[lifetime-points] Connecting to database for maintenance backfill");
    await prisma.$connect();
    console.log("[lifetime-points] Database connected");

    const summary = await runLifetimePointsBackfill(prisma);

    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("[lifetime-points] Backfill command failed", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    console.log("[lifetime-points] Database connection closed");
  }
}

void main();
