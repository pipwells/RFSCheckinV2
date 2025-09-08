// Create category (top-level or sub)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { suggestTopLevelCode, suggestChildCode } from "@/lib/category-code";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.redirect(new URL("/admin/login?next=/admin/categories", req.url));

  const isJson = (req.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await req.json() : Object.fromEntries((await req.formData()).entries());
  const name = String((data as any).name ?? "").trim();
  const parentId = ((data as any).parentId ?? "") || null;
  let code = String((data as any).code ?? "").trim() || null;

  if (!name) return NextResponse.redirect(new URL("/admin/categories?error=missing", req.url), { status: 303 });

  if (!code) {
    code = parentId ? await suggestChildCode(orgId, parentId) : await suggestTopLevelCode(orgId);
    if (!code) {
      // No available code slot (more than 8)
      return NextResponse.redirect(new URL("/admin/categories?error=max_reached", req.url), { status: 303 });
    }
  }

  // set sort = max+1 within its level
  const maxSort = await prisma.category.aggregate({
    where: { organisationId: orgId, parentId },
    _max: { sort: true },
  });

  await prisma.category.create({
    data: {
      organisationId: orgId,
      parentId,
      name,
      code,
      active: true,
      sort: (maxSort._max.sort ?? 0) + 1,
    },
  });

  return NextResponse.redirect(new URL("/admin/categories", req.url), { status: 303 });
}
