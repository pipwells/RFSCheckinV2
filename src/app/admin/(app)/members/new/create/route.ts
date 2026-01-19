// src/app/admin/(app)/members/new/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import { normaliseAUMobile } from "@/lib/mobile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect303(req: NextRequest, to: string) {
  return NextResponse.redirect(new URL(to, req.url), 303);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;

  if (!orgId) return redirect303(req, "/admin/login");

  const form = await req.formData().catch(() => null);
  if (!form) return redirect303(req, "/admin/members/new?error=invalid");

  const memberNumber = String(form.get("memberNumber") || "").trim();
  const firstName = String(form.get("firstName") || "").trim();
  const lastName = String(form.get("lastName") || "").trim();
  const mobile = String(form.get("mobile") || "").trim();
  const rfidTag = String(form.get("rfidTag") || "").trim();

  if (!memberNumber || !firstName || !lastName || !mobile) {
    return redirect303(req, "/admin/members/new?error=missing");
  }

  if (!/^\d{8}$/.test(memberNumber)) {
    return redirect303(req, "/admin/members/new?error=member_invalid");
  }

  const mobileNormalized = normaliseAUMobile(mobile);
  if (!mobileNormalized) {
    return redirect303(req, "/admin/members/new?error=mobile_invalid");
  }

  try {
    const created = await prisma.member.create({
      data: {
        organisationId: orgId,
        memberNumber,
        firstName,
        lastName,
        mobile,
        mobileNormalized,
        isVisitor: false,
        status: "active",
      },
      select: { id: true },
    });

    if (rfidTag) {
      await prisma.memberTag.create({
        data: {
          organisationId: orgId,
          memberId: created.id,
          tagValue: rfidTag,
          active: true,
        },
      });
    }
  } catch (e: unknown) {
    const err = e as { code?: string; meta?: { target?: unknown } };

    if (err?.code === "P2002") {
      const target = Array.isArray(err?.meta?.target)
        ? (err.meta.target as unknown[]).map(String)
        : [];

      // If the tag uniqueness tripped, show a clearer error
      if (target.some((t) => t.includes("tagValue") || t.includes("organisationId_tagValue"))) {
        return redirect303(req, "/admin/members/new?error=tag_duplicate");
      }

      return redirect303(req, "/admin/members/new?error=duplicate");
    }

    return redirect303(req, "/admin/members/new?error=failed");
  }

  return redirect303(req, "/admin/members");
}
