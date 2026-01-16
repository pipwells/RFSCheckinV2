// src/app/api/admin/members/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { normaliseAUMobile } from "@/lib/mobile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const firegroundNumber =
    typeof body?.firegroundNumber === "string" ? body.firegroundNumber.trim() : "";
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const mobile = typeof body?.mobile === "string" ? body.mobile.trim() : "";

  if (!firegroundNumber) return NextResponse.json({ error: "fireground_required" }, { status: 400 });
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
        firegroundNumber,
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
  } catch (e: any) {
    // Prisma unique constraint
    if (e?.code === "P2002") {
      const target = Array.isArray(e?.meta?.target) ? e.meta.target.join(",") : "unique";
      return NextResponse.json({ error: "duplicate", target }, { status: 409 });
    }
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
