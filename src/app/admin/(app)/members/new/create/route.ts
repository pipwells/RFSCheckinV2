import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import { normaliseAUMobile } from "@/lib/mobile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/members", req.url), 303);
  }

  const form = await req.formData();

  const firegroundNumber = String(form.get("firegroundNumber") || "").trim();
  const firstName = String(form.get("firstName") || "").trim();
  const lastName = String(form.get("lastName") || "").trim();
  const mobile = String(form.get("mobile") || "").trim();

  if (!firegroundNumber || !firstName || !lastName) {
    return NextResponse.redirect(new URL("/admin/members/new?error=missing", req.url), 303);
  }

  const mobileNormalized = mobile ? normaliseAUMobile(mobile) : null;
  if (mobile && !mobileNormalized) {
    return NextResponse.redirect(new URL("/admin/members/new?error=mobile_invalid", req.url), 303);
  }

  try {
    await prisma.member.create({
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

    return NextResponse.redirect(new URL("/admin/members", req.url), 303);
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.redirect(new URL("/admin/members/new?error=duplicate", req.url), 303);
    }
    return NextResponse.redirect(new URL("/admin/members/new?error=create_failed", req.url), 303);
  }
}
