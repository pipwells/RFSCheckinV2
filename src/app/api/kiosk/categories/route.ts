// src/app/api/kiosk/categories/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { Category } from "@prisma/client";

/**
 * Shape returned to the kiosk.
 * Top-level categories will include a `children` array.
 */
type KioskCategory = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  parentId: string | null;
  children: Array<{
    id: string;
    name: string;
    code: string;
    active: boolean;
  }>;
};

export async function GET(_req: NextRequest) {
  // Pull all active categories; tweak filtering as needed for your kiosk/device/org
  const cats: Category[] = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ code: "asc" }, { name: "asc" }],
  });

  // Group children by parentId for quick lookup
  const byParent = new Map<string | null, Category[]>();
  for (const c of cats) {
    const key = c.parentId ?? null;
    const arr = byParent.get(key);
    if (arr) arr.push(c);
    else byParent.set(key, [c]);
  }

  // Build result: only include top-level categories as "parents"
  const topLevel: Category[] = byParent.get(null) ?? [];

  const shaped: KioskCategory[] = topLevel.map((top: Category) => {
    const kids: Category[] = byParent.get(top.id) ?? [];

    // Ensure at least one child (self default) if none exist
    const children =
      kids.length > 0
        ? kids.map((ch: Category) => ({
            id: ch.id,
            name: ch.name,
            code: ch.code,
            active: ch.active,
          }))
        : [
            {
              id: top.id,
              name: top.name,
              code: top.code,
              active: top.active,
            },
          ];

    return {
      id: top.id,
      name: top.name,
      code: top.code,
      active: top.active,
      parentId: top.parentId,
      children,
    };
  });

  return NextResponse.json(shaped);
}
