import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma for Next.js (Turbopack/Vercel friendly).
 * We cache BOTH the core PrismaClient and the extended client to avoid
 * rebuilding the extension on every import and to keep types happy.
 */

// Keep cache types loose to avoid Prisma's complex generic mismatch.
type GlobalPrismaCache = {
  __prisma_core__?: PrismaClient;
  __prisma_ext__?: any; // extended client type (from $extends)
};

const globalForPrisma = globalThis as unknown as GlobalPrismaCache;

// 1) Core client: create once, reuse everywhere
const core: PrismaClient = globalForPrisma.__prisma_core__ ?? new PrismaClient();

/** Lightweight AU-friendly mobile normalizer */
function normalizeMobile(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("61")) return digits; // +61 (AU)
  if (digits.startsWith("0")) return digits;  // local AU style
  return digits;
}

// 2) Extended client: add query hooks for Member mutations
const extended =
  globalForPrisma.__prisma_ext__ ??
  core.$extends({
    query: {
      member: {
        async create({ args, query }) {
          if (args?.data) {
            const data: any = args.data;
            if ("mobile" in data) {
              const n = normalizeMobile(data.mobile);
              if (n) data.mobileNormalized = n;
            } else if ("mobileNormalized" in data) {
              const n = normalizeMobile(data.mobileNormalized);
              if (n) data.mobileNormalized = n;
            }
          }
          return query(args);
        },
        async update({ args, query }) {
          if (args?.data) {
            const data: any = args.data;
            if ("mobile" in data) {
              const n = normalizeMobile(data.mobile);
              if (n) data.mobileNormalized = n;
            } else if ("mobileNormalized" in data) {
              const n = normalizeMobile(data.mobileNormalized);
              if (n) data.mobileNormalized = n;
            }
          }
          return query(args);
        },
        async upsert({ args, query }) {
          if (args?.create) {
            const c: any = args.create;
            if ("mobile" in c) {
              const n = normalizeMobile(c.mobile);
              if (n) c.mobileNormalized = n;
            } else if ("mobileNormalized" in c) {
              const n = normalizeMobile(c.mobileNormalized);
              if (n) c.mobileNormalized = n;
            }
          }
          if (args?.update) {
            const u: any = args.update;
            if ("mobile" in u) {
              const n = normalizeMobile(u.mobile);
              if (n) u.mobileNormalized = n;
            } else if ("mobileNormalized" in u) {
              const n = normalizeMobile(u.mobileNormalized);
              if (n) u.mobileNormalized = n;
            }
          }
          return query(args);
        },
      },
    },
  });

// 3) Export the extended client everywhere
export const prisma = extended;

// 4) Cache both in dev so HMR reuses them
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma_core__ = core;
  globalForPrisma.__prisma_ext__ = extended;
}
