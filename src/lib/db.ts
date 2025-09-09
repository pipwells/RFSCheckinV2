import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma for Next.js (works with Turbopack/Vercel):
 *  - Reuse a single instance across hot reloads (dev) via globalThis.
 *  - Avoids “Too many clients”.
 *  - No `$use` middleware; we use `$extends` query extensions instead.
 */
const globalForPrisma = globalThis as unknown as {
  __prisma?: PrismaClient;
};

const base = globalForPrisma.__prisma ?? new PrismaClient();

/** Lightweight AU-friendly mobile normalizer */
function normalizeMobile(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("61")) return digits; // +61 (AU)
  if (digits.startsWith("0")) return digits;  // local AU style
  return digits;
}

/**
 * Use Prisma query extensions to normalize `Member.mobileNormalized`
 * on create/update/upsert without relying on `$use`.
 */
export const prisma = base.$extends({
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

// Cache the instance in dev so it’s reused across HMR
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
