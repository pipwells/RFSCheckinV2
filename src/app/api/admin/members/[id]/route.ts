import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { normaliseAUMobile } from "@/lib/mobile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

function safeRedirectPath(input: unknown, fallback: string) {
  const v = typeof input === "string" ? input.trim() : "";
  if (!v) return fallback;
  if (!v.startsWith("/")) return fallback;
  if (v.startsWith("//")) return fallback;
  return v;
}

export async function GET(_req: NextRequest, context: { params: Promise<Params> }) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { id } = await context.params;

  const m = await prisma.member.findFirst({
    where: { id, organisationId: orgId, isVisitor: false },
    select: {
      id: true,
      firegroundNumber: true,
      firstName: true,
      lastName: true,
      mobile: true,
      mobileNormalized: true,
      status: true,
    },
  });

  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, member: m });
}

/**
 * POST handler for HTML forms:
 * - _method=PATCH to update fields/status
 * - _method=DELETE to delete record
 */
export async function POST(req: NextRequest, context: { params: Promise<Params> }) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { id } = await context.params;

  const form = await req.formData();
  const method = String(form.get("_method") ?? "POST").toUpperCase();
  const redirectTo = safeRedirectPath(form.get("redirect"), "/admin/members");

  const existing = await prisma.member.findFirst({
    where: { id, organisationId: orgId, isVisitor: false },
    select: { id: true },
  });
  if (!existing) return NextResponse.redirect(new URL("/admin/members?error=not_found", req.url), 303);

  if (method === "DELETE") {
    await prisma.member.delete({ where: { id } });
    return NextResponse.redirect(new URL(redirectTo, req.url), 303);
  }

  if (method !== "PATCH") {
    return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
  }

  const firstName = typeof form.get("firstName") === "string" ? String(form.get("firstName")).trim() : "";
  const lastName = typeof form.get("lastName") === "string" ? String(form.get("lastName")).trim() : "";
  const mobile = typeof form.get("mobile") === "string" ? String(form.get("mobile")).trim() : "";
  const status = typeof form.get("status") === "string" ? String(form.get("status")).trim() : "";

  const data: {
    firstName?: string;
    lastName?: string;
    mobile?: string | null;
    mobileNormalized?: string | null;
    status?: string;
  } = {};

  if (firstName) data.firstName = firstName;
  if (lastName) data.lastName = lastName;

  // Allow clearing mobile by submitting blank
  if (mobile) {
    const norm = normaliseAUMobile(mobile);
    if (!norm) {
      return NextResponse.redirect(new URL(`/admin/members/${id}?error=mobile_invalid`, req.url), 303);
    }
    data.mobile = mobile;
    data.mobileNormalized = norm;
  } else if (form.has("mobile")) {
    data.mobile = null;
    data.mobileNormalized = null;
  }

  if (status === "active" || status === "disabled") {
    data.status = status;
  }

  try {
    await prisma.member.update({
      where: { id },
      data,
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "P2002") {
      return NextResponse.redirect(new URL(`/admin/members/${id}?error=duplicate`, req.url), 303);
    }
    return NextResponse.redirect(new URL(`/admin/members/${id}?error=failed`, req.url), 303);
  }

  return NextResponse.redirect(new URL(redirectTo, req.url), 303);
}

export async function PATCH(req: NextRequest, context: { params: Promise<Params> }) {
  // Optional JSON PATCH (if you later use fetch() updates)
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    firstName?: string;
    lastName?: string;
    mobile?: string | null;
    status?: "active" | "disabled";
  };

  const existing = await prisma.member.findFirst({
    where: { id, organisationId: orgId, isVisitor: false },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data: any = {};
  if (typeof body.firstName === "string") data.firstName = body.firstName.trim();
  if (typeof body.lastName === "string") data.lastName = body.lastName.trim();

  if (body.mobile === null) {
    data.mobile = null;
    data.mobileNormalized = null;
  } else if (typeof body.mobile === "string") {
    const m = body.mobile.trim();
    const norm = m ? normaliseAUMobile(m) : null;
    if (m && !norm) return NextResponse.json({ error: "mobile_invalid" }, { status: 400 });
    data.mobile = m || null;
    data.mobileNormalized = norm;
  }

  if (body.status === "active" || body.status === "disabled") data.status = body.status;

  try {
    const updated = await prisma.member.update({ where: { id }, data });
    return NextResponse.json({ ok: true, member: updated });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "P2002") return NextResponse.json({ error: "duplicate" }, { status: 409 });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<Params> }) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { id } = await context.params;

  const existing = await prisma.member.findFirst({
    where: { id, organisationId: orgId, isVisitor: false },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.member.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
