// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  let username = "";
  let password = "";
  let next = "/admin";

  // Handle both JSON and form posts
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    username = String(body?.username || "");
    password = String(body?.password || "");
    next = String(body?.next || "/admin");
  } else {
    const form = await req.formData().catch(() => undefined);
    if (form) {
      username = String(form.get("username") || "");
      password = String(form.get("password") || "");
      next = String(form.get("next") || "/admin");
    }
  }

  if (!username || !password) {
    // For form posts, redirect back with error
    return NextResponse.redirect(new URL(`/admin/login?error=invalid&next=${encodeURIComponent(next)}`, req.url), 303);
  }

  const okUser = process.env.ADMIN_USERNAME;
  const okPass = process.env.ADMIN_PASSWORD;
  if (!okUser || !okPass) {
    return NextResponse.redirect(new URL(`/admin/login?error=invalid&next=${encodeURIComponent(next)}`, req.url), 303);
  }

  if (username !== okUser || password !== okPass) {
    return NextResponse.redirect(new URL(`/admin/login?error=invalid&next=${encodeURIComponent(next)}`, req.url), 303);
  }

  // Default to first organisation
  const org = await prisma.organisation.findFirst({ select: { id: true } });

  const session = await getAdminSession();
  session.user = {
    id: "env-superadmin",
    email: `${okUser}@local`,
    role: "super_admin",
    organisationId: org?.id,
  };
  await session.save();

  // Redirect POST -> GET
  return NextResponse.redirect(new URL(next, req.url), 303);
}
