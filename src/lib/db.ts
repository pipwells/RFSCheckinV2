import { PrismaClient } from "@prisma/client";
import { mobileNormalizeMiddleware } from "./prisma-middleware";

/**
 * Singleton Prisma for Next.js:
 *  - Reuse a single instance across hot reloads (dev) via globalThis.
 *  - Avoids “Too many clients” and duplicate identifier issues.
 */
const globalForPrisma = globalThis as unknown as {
  __prisma?: PrismaClient;
  __prismaMwReg?: boolean;
};

export const prisma: PrismaClient =
  globalForPrisma.__prisma ?? new PrismaClient();

// Register middleware exactly once (even across HMR)
if (!globalForPrisma.__prismaMwReg) {
  prisma.$use(mobileNormalizeMiddleware);
  globalForPrisma.__prismaMwReg = true;
}

// Cache the instance in dev so it’s reused
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
