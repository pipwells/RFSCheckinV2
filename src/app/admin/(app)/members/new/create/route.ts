// src/app/admin/(app)/members/new/create/route.ts
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
    return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.redirect(new URL("/admin/members/new?error=invalid", req.url), 303);
  }

  const memberNumber = String(form.get("memberNumber") || "").trim();
  const firstName = String(form.get("firstName") || "").trim();
  const lastName = String(form.get("lastName") || "").trim();
  const mobile = String(form.get("mobile") || "").trim();
  const rfidTag = String(form.get("rfidTag") || "").trim();

  if (!memberNumber || !firstName || !lastName || !mobile) {
    return NextResponse.redirect(new URL("/admin/members/new?error=missing", req.url), 303);
  }

  // Member number: exactly 8 digits
  if (!/^\d{8}$/.test(memberNumber)) {
    return NextResponse.redirect(new URL("/admin/members/new?error=member_invalid", req.url), 303);
  }

  const mobileNormalized = normaliseAUMobile(mobile);
  if (!mobileNormalized) {
    return NextResponse.redirect(new URL("/admin/members/new?error=mobile_invalid", req.url), 303);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.member.create({
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
        await tx.memberTag.upsert({
          where: { organisationId_tagValue: { organisationId: orgId, tagValue: rfidTag } },
          create: {
            organisationId: orgId,
            memberId: created.id,
            tagValue: rfidTag,
            active: true,
          },
          update: {
            memberId: created.id,
            active: true,
          },
        });
      }
    });
  } catch (e: unknown) {
    const err = e as { code?: string };

    // Prisma unique constraint violations (member number/mobile or tag)
    if (err?.code === "P2002") {
      // We can't reliably distinguish which constraint from the transaction here without parsing meta.
      // Default to a clean UX message that covers the RFID case.
      return NextResponse.redirect(new URL("/admin/members/new?error=duplicate", req.url), 303);
    }

    return NextResponse.redirect(new URL("/admin/members/new?error=failed", req.url), 303);
  }

  return NextResponse.redirect(new URL("/admin/members", req.url), 303);
}
