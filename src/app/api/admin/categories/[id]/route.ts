// Update/toggle/move category
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.redirect(new URL("/admin/login?next=/admin/categories", req.url));

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const dir = url.searchParams.get("dir"); // for move

  const cat = await prisma.category.findFirst({
    where: { id: params.id, organisationId: orgId },
    select: { id: true, parentId: true, active: true, code: true },
  });
  if (!cat) return NextResponse.redirect(new URL("/admin/categories?error=notfound", req.url), { status: 303 });

  if (action === "toggle") {
    await prisma.category.update({ where: { id: cat.id }, data: { active: !cat.active } });
    return NextResponse.redirect(new URL("/admin/categories", req.url), { status: 303 });
  }

  if (action === "update") {
    const form = Object.fromEntries((await req.formData()).entries());
    const name = String(form.name ?? "").trim();
    const code = String(form.code ?? "").trim();

    // If code changed and there are tasks using this code snapshot, warn by refusing (keep immutable once used)
    if (code && code !== cat.code) {
      const used = await prisma.sessionTask.count({
        where: { categoryId: cat.id, categoryCodeSnapshot: cat.code },
      });
      if (used > 0) {
        return NextResponse.redirect(new URL("/admin/categories?error=code_immutable", req.url), { status: 303 });
      }
    }

    await prisma.category.update({
      where: { id: cat.id },
      data: { name, code },
    });
    return NextResponse.redirect(new URL("/admin/categories", req.url), { status: 303 });
  }

  if (action === "move") {
    if (dir !== "up" && dir !== "down") {
      return NextResponse.redirect(new URL("/admin/categories", req.url), { status: 303 });
    }
    // swap sort with neighbor in same level
    const siblings = await prisma.category.findMany({
      where: { organisationId: orgId, parentId: cat.parentId },
      orderBy: { sort: "asc" },
      select: { id: true, sort: true },
    });
    const idx = siblings.findIndex(s => s.id === cat.id);
    const tgtIdx = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || tgtIdx < 0 || tgtIdx >= siblings.length) {
      return NextResponse.redirect(new URL("/admin/categories", req.url), { status: 303 });
    }
    const a = siblings[idx], b = siblings[tgtIdx];
    await prisma.$transaction([
      prisma.category.update({ where: { id: a.id }, data: { sort: b.sort } }),
      prisma.category.update({ where: { id: b.id }, data: { sort: a.sort } }),
    ]);
    return NextResponse.redirect(new URL("/admin/categories", req.url), { status: 303 });
  }

  return NextResponse.redirect(new URL("/admin/categories", req.url), { status: 303 });
}
