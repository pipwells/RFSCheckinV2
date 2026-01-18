import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { normaliseAUMobile } from "@/lib/mobile";

type Params = { id: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(req: NextRequest, fallback: string) {
  const url = new URL(req.url);
  url.pathname = fallback;
  url.search = "";
  return NextResponse.redirect(url, 303);
}

async function requireOrg() {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  return { session, orgId };
}

async function getMember(orgId: string, id: string) {
  return prisma.member.findFirst({
    where: { id, organisationId: orgId, isVisitor: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mobile: true,
      status: true,
      firegroundNumber: true,
    } as any,
  });
}

function buildConfirmPhrase(m: any) {
  const fullName = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim();
  const fireground = (m as any).firegroundNumber ?? "";
  return `${fullName} #${fireground}`.trim();
}

/**
 * GET /api/admin/members/[id]
 */
export async function GET(req: NextRequest, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  const { orgId } = await requireOrg();
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const m = await getMember(orgId, id);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, member: m });
}

/**
 * PATCH /api/admin/members/[id] (JSON)
 */
export async function PATCH(req: NextRequest, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  const { orgId } = await requireOrg();
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as any;

  const data: any = {};
  if (typeof body.firstName === "string") data.firstName = body.firstName.trim();
  if (typeof body.lastName === "string") data.lastName = body.lastName.trim();

  if (typeof body.mobile === "string") {
    const mobileRaw = body.mobile.trim();
    if (!mobileRaw) {
      data.mobile = null;
      data.mobileNormalized = null;
    } else {
      const mobileNorm = normaliseAUMobile(mobileRaw);
      if (!mobileNorm) return NextResponse.json({ error: "mobile_invalid" }, { status: 400 });
      data.mobile = mobileRaw;
      data.mobileNormalized = mobileNorm;
    }
  }

  if (typeof body.status === "string") data.status = body.status.trim();

  const updated = await prisma.member.updateMany({
    where: { id, organisationId: orgId, isVisitor: false },
    data,
  });

  if (updated.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/members/[id]
 */
export async function DELETE(req: NextRequest, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  const { orgId } = await requireOrg();
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  // Support both JSON and form delete
  let confirm = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as any;
    confirm = String(body?.confirm ?? "").trim();
  } else {
    const fd = await req.formData().catch(() => null);
    confirm = String(fd?.get("confirm") ?? "").trim();
  }

  const m = await getMember(orgId, id);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Only from inactive/disabled states
  if (m.status === "active") return NextResponse.json({ error: "must_disable_first" }, { status: 400 });

  const expected = buildConfirmPhrase(m);
  if (!confirm || confirm !== expected) {
    return NextResponse.json({ error: "confirm_mismatch" }, { status: 400 });
  }

  // Try hard delete, but fall back to soft-delete if history/relations block it.
  try {
    await prisma.member.delete({
      where: { id: m.id } as any,
    });
    return NextResponse.json({ ok: true, deleted: "hard" });
  } catch {
    await prisma.member.update({
      where: { id: m.id } as any,
      data: { status: "deleted" } as any,
    });
    return NextResponse.json({ ok: true, deleted: "soft" });
  }
}

/**
 * POST /api/admin/members/[id]
 * Supports HTML forms using _method=PATCH|DELETE and optional redirect.
 */
export async function POST(req: NextRequest, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  const { orgId } = await requireOrg();
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const fd = await req.formData();
  const method = String(fd.get("_method") ?? "").toUpperCase().trim();
  const redirectPath = String(fd.get("redirect") ?? "/admin/members").trim() || "/admin/members";

  if (method === "PATCH") {
    const data: any = {};

    const firstName = String(fd.get("firstName") ?? "").trim();
    const lastName = String(fd.get("lastName") ?? "").trim();
    const mobileRaw = String(fd.get("mobile") ?? "").trim();
    const status = String(fd.get("status") ?? "").trim();

    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;

    // Mobile is allowed to be blank (clears it)
    if (!mobileRaw) {
      data.mobile = null;
      data.mobileNormalized = null;
    } else {
      const mobileNorm = normaliseAUMobile(mobileRaw);
      if (!mobileNorm) return NextResponse.redirect(new URL(`/admin/members/${id}?error=mobile_invalid`, req.url), 303);
      data.mobile = mobileRaw;
      data.mobileNormalized = mobileNorm;
    }

    if (status) data.status = status;

    await prisma.member.updateMany({
      where: { id, organisationId: orgId, isVisitor: false },
      data,
    });

    return redirectTo(req, redirectPath);
  }

  if (method === "DELETE") {
    // We want the same validation as DELETE handler
    // Call the logic inline for form usage.
    const m = await getMember(orgId, id);
    if (!m) return NextResponse.redirect(new URL(`/admin/members?error=not_found`, req.url), 303);

    if (m.status === "active") return NextResponse.redirect(new URL(`/admin/members/${id}#delete`, req.url), 303);

    const confirm = String(fd.get("confirm") ?? "").trim();
    const expected = buildConfirmPhrase(m);
    if (confirm !== expected) return NextResponse.redirect(new URL(`/admin/members/${id}?error=confirm_mismatch#delete`, req.url), 303);

    try {
      await prisma.member.delete({ where: { id: m.id } as any });
    } catch {
      await prisma.member.update({ where: { id: m.id } as any, data: { status: "deleted" } as any });
    }

    return redirectTo(req, redirectPath);
  }

  return NextResponse.json({ error: "unsupported_method" }, { status: 400 });
}
