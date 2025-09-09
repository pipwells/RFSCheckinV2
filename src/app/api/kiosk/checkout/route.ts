import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  let username = "";
  let password = "";
  let next = "/admin";

  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    username = String((body as any)?.username || "");
    password = String((body as any)?.password || "");
    next = String((body as any)?.next || next);
  } else {
    const form = await req.formData().catch(() => new FormData());
    username = String(form.get("username") || "");
    password = String(form.get("password") || "");
    next = String(form.get("next") || next);
  }

  // DEV auth: allow any non-empty user/pass. Replace with real auth later.
  const okUser = username.trim();
  if (!okUser || !password) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const org = await prisma.organisation.findFirst({ select: { id: true } }).catch(() => null);
  const session = await getAdminSession();
  session.user = {
    id: "env-superadmin",
    email: `${okUser}@local`,
    role: "super_admin",
    organisationId: org?.id,
  };
  await session.save();

  return NextResponse.redirect(new URL(next, req.url), 303);
}
