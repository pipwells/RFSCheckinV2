// src/app/api/admin/members/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { normaliseAUMobile } from "@/lib/mobile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/members
 * Returns the member list for the signed-in admin's organisation.
 */
export async function GET(_req: NextRequest) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const members = await prisma.member.findMany({
    where: { organisationId: orgId, isVisitor: false },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      memberNumber: true,
      firstName: true,
      lastName: true,
      mobile: true,
      status: true,
    },
  });

  return NextResponse.json({ ok: true, members });
}

/**
 * POST /api/admin/members
 * Creates a member in the signed-in admin's organisation.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    memberNumber?: string;
    firstName?: string;
    lastName?: string;
    mobile?: string;
  };

  const memberNumber = typeof body.memberNumber === "string" ? body.memberNumber.trim() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const mobile = typeof body.mobile === "string" ? body.mobile.trim() : "";

  if (!memberNumber) return NextResponse.json({ error: "member_required" }, { status: 400 });
  if (!firstName) return NextResponse.json({ error: "first_required" }, { status: 400 });
  if (!lastName) return NextResponse.json({ error: "last_required" }, { status: 400 });

  const mobileNormalized = mobile ? normaliseAUMobile(mobile) : null;
  if (mobile && !mobileNormalized) {
    return NextResponse.json({ error: "mobile_invalid" }, { status: 400 });
  }

  try {
    const created = await prisma.member.create({
      data: {
        organisationId: orgId,
        memberNumber,
        firstName,
        lastName,
        mobile: mobile || null,
        mobileNormalized,
        isVisitor: false,
        status: "active",
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (e: unknown) {
    const err = e as { code?: string; meta?: { target?: unknown } };

    // Prisma unique constraint
    if (err?.code === "P2002") {
      const target = Array.isArray(err?.meta?.target) ? (err.meta.target as unknown[]).join(",") : "unique";
      return NextResponse.json({ error: "duplicate", target }, { status: 409 });
    }

    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
