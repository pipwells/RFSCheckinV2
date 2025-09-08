// src/app/api/admin/members/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { normalizeAUMobile } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Create a new member from a standard HTML form POST.
 * On success, redirects to /admin/members (Post/Redirect/Get).
 */
export async function POST(req: NextRequest) {
  // Require admin session
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) {
    return NextResponse.redirect(
      new URL("/admin/login?next=/admin/members/new", req.url),
      { status: 302 }
    );
  }

  // Accept either JSON or form-data
  const contentType = req.headers.get("content-type") || "";
  let body: Record<string, any> = {};
  try {
    if (contentType.includes("application/json")) {
      body = (await req.json()) ?? {};
    } else {
      const fd = await req.formData();
      body = Object.fromEntries(fd.entries());
    }
  } catch {
    // ignore; we'll validate below
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const mobile = String(body.mobile ?? "").trim();

  if (!firstName || !mobile) {
    return NextResponse.redirect(
      new URL("/admin/members/new?error=missing_fields", req.url),
      { status: 303 }
    );
  }

  const mobileNormalized = normalizeAUMobile(mobile) ?? null;

  try {
    await prisma.member.create({
      data: {
        organisationId: orgId,
        firstName,
        lastName,
        mobile,
        mobileNormalized,
        isVisitor: false,
        status: "active",
      },
    });

    return NextResponse.redirect(new URL("/admin/members", req.url), {
      status: 303,
    });
  } catch (err) {
    console.error("create member error", err);
    return NextResponse.redirect(
      new URL("/admin/members/new?error=failed", req.url),
      { status: 303 }
    );
  }
}
