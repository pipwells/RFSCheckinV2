// src/app/api/admin/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { suggestTopLevelCode, suggestChildCode } from "@/lib/category-code";

export const dynamic = "force-dynamic";

type IncomingCategoryBody = {
  name?: unknown;
  parentId?: unknown;
  code?: unknown;
};

async function readBody(req: NextRequest): Promise<IncomingCategoryBody> {
  const ct = req.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return { name: j.name, parentId: j.parentId, code: j.code };
  }

  const fd = await req.formData();
  return {
    name: fd.get("name"),
    parentId: fd.get("parentId"),
    code: fd.get("code"),
  };
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/categories", req.url));
  }

  const body = await readBody(req);

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const parentId =
    typeof body.parentId === "string" && body.parentId.trim().length > 0
      ? body.parentId.trim()
      : null;

  let code =
    typeof body.code === "string" && body.code.trim().length > 0
      ? body.code.trim()
      : null;

  if (!name) {
    return NextResponse.redirect(new URL("/admin/categories?error=missing", req.url), {
      status: 303,
    });
  }

  if (!code) {
    code = parentId
      ? await suggestChildCode(orgId, parentId)
      : await suggestTopLevelCode(orgId);

    if (!code) {
      return NextResponse.redirect(new URL("/admin/categories?error=max_reached", req.url), {
        status: 303,
      });
    }
  }

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
