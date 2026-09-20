import type { PrismaClient } from "@prisma/client";

import { resolveBackfilledLifetimePoints } from "./lifetimePoints";

export const LIFETIME_POINTS_BACKFILL_BATCH_SIZE = 100;

type BackfillLogger = Pick<typeof console, "log" | "error">;

export type LifetimePointsBackfillSummary = {
  processed: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
};

function isValidUserRecord(user: {
  scratchCoin: number;
  lifetimePointsEarned: number;
  ledger: Array<{ kind: string; delta: number }>;
}) {
  return (
    Number.isFinite(user.scratchCoin) &&
    Number.isFinite(user.lifetimePointsEarned) &&
    Array.isArray(user.ledger) &&
    user.ledger.every((entry) => typeof entry.kind === "string" && Number.isFinite(entry.delta))
  );
}

export async function runLifetimePointsBackfill(
  prisma: PrismaClient,
  logger: BackfillLogger = console,
): Promise<LifetimePointsBackfillSummary> {
  let cursor: string | undefined;
  const summary: LifetimePointsBackfillSummary = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
  };

  logger.log("[lifetime-points] Historical backfill started");

  while (true) {
    const users = await prisma.user.findMany({
      take: LIFETIME_POINTS_BACKFILL_BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        scratchCoin: true,
        lifetimePointsEarned: true,
        ledger: {
          select: {
            kind: true,
            delta: true,
          },
        },
      },
    });

    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      summary.processed += 1;

      try {
        if (!isValidUserRecord(user)) {
          summary.skipped += 1;
          logger.error("[lifetime-points] Skipping invalid user record", { userId: user.id });
          continue;
        }

        const resolvedLifetimePointsEarned = resolveBackfilledLifetimePoints({
          existingLifetimePointsEarned: user.lifetimePointsEarned,
          scratchCoin: user.scratchCoin,
          ledgerEntries: user.ledger,
        });

        if (resolvedLifetimePointsEarned <= user.lifetimePointsEarned) {
          summary.unchanged += 1;
          continue;
        }

        const update = await prisma.user.updateMany({
          where: {
            id: user.id,
            lifetimePointsEarned: { lt: resolvedLifetimePointsEarned },
          },
          data: { lifetimePointsEarned: resolvedLifetimePointsEarned },
        });

        if (update.count === 1) {
          summary.updated += 1;
        } else {
          summary.unchanged += 1;
        }
      } catch (error) {
        summary.failed += 1;
        logger.error("[lifetime-points] Failed to backfill user", { userId: user.id, error });
      }
    }

    cursor = users[users.length - 1]?.id;
  }

  logger.log("[lifetime-points] Historical backfill finished", summary);
  return summary;
}
