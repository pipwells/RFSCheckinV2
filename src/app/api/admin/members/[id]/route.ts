// src/app/api/admin/members/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { normaliseAUMobile } from "@/lib/mobile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

function isEightDigits(v: string): boolean {
  return /^\d{8}$/.test(v);
}

function redirect303(req: NextRequest, to: string) {
  return NextResponse.redirect(new URL(to, req.url), 303);
}

async function parseBody(req: NextRequest): Promise<{
  methodOverride?: string;
  redirectTo?: string;
  memberNumber?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  status?: string;
  rfidTag?: string;
}> {
  const ct = req.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      methodOverride: typeof j?._method === "string" ? j._method : undefined,
      redirectTo: typeof j?.redirect === "string" ? (j.redirect as string) : undefined,
      memberNumber: typeof j?.memberNumber === "string" ? (j.memberNumber as string).trim() : undefined,
      firstName: typeof j?.firstName === "string" ? (j.firstName as string).trim() : undefined,
      lastName: typeof j?.lastName === "string" ? (j.lastName as string).trim() : undefined,
      mobile: typeof j?.mobile === "string" ? (j.mobile as string).trim() : undefined,
      status: typeof j?.status === "string" ? (j.status as string).trim() : undefined,
      rfidTag: typeof j?.rfidTag === "string" ? (j.rfidTag as string).trim() : undefined,
    };
  }

  const fd = await req.formData();
  return {
    methodOverride: typeof fd.get("_method") === "string" ? String(fd.get("_method")) : undefined,
    redirectTo: typeof fd.get("redirect") === "string" ? String(fd.get("redirect")) : undefined,
    memberNumber: typeof fd.get("memberNumber") === "string" ? String(fd.get("memberNumber")).trim() : undefined,
    firstName: typeof fd.get("firstName") === "string" ? String(fd.get("firstName")).trim() : undefined,
    lastName: typeof fd.get("lastName") === "string" ? String(fd.get("lastName")).trim() : undefined,
    mobile: typeof fd.get("mobile") === "string" ? String(fd.get("mobile")).trim() : undefined,
    status: typeof fd.get("status") === "string" ? String(fd.get("status")).trim() : undefined,
    rfidTag: typeof fd.get("rfidTag") === "string" ? String(fd.get("rfidTag")).trim() : undefined,
  };
}

export async function GET(req: NextRequest, context: { params: Promise<Params> }) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { id } = await context.params;

  const m = await prisma.member.findFirst({
    where: { id, organisationId: orgId, isVisitor: false },
    select: { id: true, memberNumber: true, firstName: true, lastName: true, mobile: true, status: true },
  });

  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, member: m });
}

export async function POST(req: NextRequest, context: { params: Promise<Params> }) {
  // Support HTML forms using POST + _method=PATCH
  const body = await parseBody(req);
  const method = (body.methodOverride || "").toUpperCase();

  if (method === "PATCH") return PATCH(req, context);
  if (method === "DELETE") return DELETE(req, context);

  return NextResponse.json({ error: "unsupported" }, { status: 405 });
}

export async function PATCH(req: NextRequest, context: { params: Promise<Params> }) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { id } = await context.params;
  const body = await parseBody(req);

  const member = await prisma.member.findFirst({
    where: { id, organisationId: orgId, isVisitor: false },
    select: { id: true },
  });
  if (!member) {
    if (body.redirectTo) return redirect303(req, `${body.redirectTo}?error=not_found`);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.memberNumber === "string") {
    if (!isEightDigits(body.memberNumber)) {
      if (body.redirectTo) return redirect303(req, `${body.redirectTo}?error=membernumber_invalid`);
      return NextResponse.json({ error: "membernumber_invalid" }, { status: 400 });
    }
    data.memberNumber = body.memberNumber;
  }

  if (typeof body.firstName === "string") data.firstName = body.firstName;
  if (typeof body.lastName === "string") data.lastName = body.lastName;

  if (typeof body.mobile === "string") {
    const mn = normaliseAUMobile(body.mobile);
    if (!mn) {
      if (body.redirectTo) return redirect303(req, `${body.redirectTo}?error=mobile_invalid`);
      return NextResponse.json({ error: "mobile_invalid" }, { status: 400 });
    }
    data.mobile = body.mobile;
    data.mobileNormalized = mn;
  }

  if (typeof body.status === "string") {
    if (body.status !== "active" && body.status !== "disabled" && body.status !== "archived") {
      if (body.redirectTo) return redirect303(req, `${body.redirectTo}?error=status_invalid`);
      return NextResponse.json({ error: "status_invalid" }, { status: 400 });
    }
    data.status = body.status;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.member.update({
          where: { id: member.id },
          data,
        });
      }

      if (typeof body.rfidTag === "string") {
        const tag = body.rfidTag.trim();

        if (!tag) {
          // Clear existing active tags for this member
          await tx.memberTag.updateMany({
            where: { organisationId: orgId, memberId: member.id, active: true },
            data: { active: false },
          });
        } else {
          // Assign/reassign the physical tag within the org
          await tx.memberTag.upsert({
            where: { organisationId_tagValue: { organisationId: orgId, tagValue: tag } },
            create: {
              organisationId: orgId,
              memberId: member.id,
              tagValue: tag,
              active: true,
            },
            update: {
              memberId: member.id,
              active: true,
            },
          });
        }
      }
    });

    if (body.redirectTo) return redirect303(req, body.redirectTo);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { code?: string };

    if (err?.code === "P2002") {
      if (body.redirectTo) return redirect303(req, `${body.redirectTo}?error=duplicate`);
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
    if (body.redirectTo) return redirect303(req, `${body.redirectTo}?error=failed`);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<Params> }) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { id } = await context.params;
  const body = await parseBody(req);

  const member = await prisma.member.findFirst({
    where: { id, organisationId: orgId, isVisitor: false },
    select: { id: true },
  });
  if (!member) {
    if (body.redirectTo) return redirect303(req, `${body.redirectTo}?error=not_found`);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Archive-only (no hard delete)
  try {
    await prisma.member.update({
      where: { id: member.id },
      data: { status: "archived" },
    });

    if (body.redirectTo) return redirect303(req, body.redirectTo);
    return NextResponse.json({ ok: true });
  } catch {
    if (body.redirectTo) return redirect303(req, `${body.redirectTo}?error=failed`);
    return NextResponse.json({ error: "archive_failed" }, { status: 500 });
  }
}
