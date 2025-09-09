/**
 * Mobile number normalizer + Prisma middleware.
 * We avoid relying on Prisma.Middleware type (not exported in your build),
 * and instead type the function by its call signature used by prisma.$use.
 */

function normalizeMobile(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  // Strip all non-digits
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return undefined;

  // Very light normalization:
  // - Keep leading "61..." as-is (AU country code)
  // - If starts with "0" and looks like an AU mobile length, keep it
  // - Otherwise just return the digits
  if (digits.startsWith("61")) return digits;
  if (digits.startsWith("0")) return digits;
  return digits;
}

// Minimal params/next typing to match prisma.$use signature without importing Prisma types
type MiddlewareNext = (params: any) => Promise<any>;

/**
 * Attach with:
 *   import { prisma } from "@/lib/db";
 *   import { mobileNormalizeMiddleware } from "@/lib/prisma-middleware";
 *   prisma.$use(mobileNormalizeMiddleware);
 */
export const mobileNormalizeMiddleware = async (params: any, next: MiddlewareNext) => {
  // Only act on the Member model for create/update/upsert
  if (
    params?.model === "Member" &&
    (params?.action === "create" || params?.action === "update" || params?.action === "upsert")
  ) {
    const data = params?.args?.data;
    if (data && typeof data === "object") {
      // If a raw 'mobile' was provided, compute/override mobileNormalized from it
      if (Object.prototype.hasOwnProperty.call(data, "mobile")) {
        const normalized = normalizeMobile((data as any).mobile);
        if (normalized) (data as any).mobileNormalized = normalized;
      }
      // If only mobileNormalized provided, normalize that too
      if (Object.prototype.hasOwnProperty.call(data, "mobileNormalized")) {
        const normalized = normalizeMobile((data as any).mobileNormalized);
        if (normalized) (data as any).mobileNormalized = normalized;
      }
    }
  }

  return next(params);
};
