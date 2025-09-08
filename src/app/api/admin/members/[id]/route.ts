// src/app/api/admin/members/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { normalizeAUMobile } from "@/lib/phone";

export const dynamic = "force-dynamic";

function toURL(path: string, req: NextRequest) {
  return new URL(path, req.url);
}

async function parseBody(req: NextRequest): Promise<Record<string, any>> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await req.json();
    } catch {
      return {};
    }
  }
  try {
    const fd = await req.formData();
    return Object.fromEntries(fd.entries());
  } catch {
    return {};
  }
}

type PatchResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

async function patchMemberCore(
  id: string,
  orgId: string,
  body: Record<string, any>
): Promise<PatchResult> {
  // Allowed fields
  const firstName =
    body.firstName !== undefined ? String(body.firstName).trim() : undefined;
  const lastName =
    body.lastName !== undefined ? String(body.lastName).trim() : undefined;
  const status =
    body.status !== undefined ? String(body.status).trim() : undefined;
  const mobileRaw =
    body.mobile !== undefined ? String(body.mobile).trim() : undefined;

  const member = await prisma.member.findFirst({
    where: { id, organisationId: orgId, isVisitor: false },
    select: { id: true, mobileNormalized: true },
  });
  if (!member) {
    return { ok: false, status: 404, error: "not_found" };
  }

  let mobileNormalized: string | null | undefined = undefined;
  if (mobileRaw !== undefined) {
    mobileNormalized = normalizeAUMobile(mobileRaw);
    if (!mobileNormalized) {
      return { ok: false, status: 400, error: "invalid_mobile" };
    }
    if (mobileNormalized !== member.mobileNormalized) {
      const dup = await prisma.member.findFirst({
        where: {
          organisationId: orgId,
          isVisitor: false,
          mobileNormalized,
          NOT: { id },
        },
        select: { id: true },
      });
      if (dup) {
        return { ok: false, status: 409, error: "mobile_in_use" };
      }
    }
  }

  if (status && !["active", "disabled"].includes(status)) {
    return { ok: false, status: 400, error: "invalid_status" };
  }

  await prisma.member.update({
    where: { id },
    data: {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(mobileRaw !== undefined ? { mobile: mobileRaw } : {}),
      ...(mobileNormalized !== undefined ? { mobileNormalized } : {}),
    },
  });

  return { ok: true };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session.user?.organisationId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await parseBody(req);
  const result = await patchMemberCore(params.id, session.user.organisationId, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}

// HTML forms submit POST; accept `_method=PATCH` and redirect instead of JSON
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session.user?.organisationId) {
    return NextResponse.redirect(toURL("/admin/login?error=unauthorized", req), 303);
  }

  const body = await parseBody(req);
  const method = String(body._method || "").toUpperCase();
  if (method !== "PATCH") {
    return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
  }

  const result = await patchMemberCore(params.id, session.user.organisationId, body);

  // Allow overriding redirect target; default back to members list
  const redirectTo = typeof body.redirect === "string" && body.redirect.length > 0
    ? body.redirect
    : "/admin/members";

  if (!result.ok) {
    // Send back to the edit page with an error code
    const err = encodeURIComponent(result.error);
    return NextResponse.redirect(toURL(`/admin/members/${params.id}?error=${err}`, req), 303);
  }

  return NextResponse.redirect(toURL(redirectTo, req), 303);
}
