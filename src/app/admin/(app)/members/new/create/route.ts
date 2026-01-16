import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const form = await req.formData();

  const firegroundNumber = String(form.get("firegroundNumber") || "");
  const firstName = String(form.get("firstName") || "");
  const lastName = String(form.get("lastName") || "");
  const mobile = String(form.get("mobile") || "");

  const res = await fetch(new URL("/api/admin/members", req.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ firegroundNumber, firstName, lastName, mobile }),
  });

  if (res.ok) {
    return NextResponse.redirect(new URL("/admin/members", req.url), 303);
  }

  const j = await res.json().catch(() => ({}));
  const code = encodeURIComponent(j?.error || "create_failed");
  return NextResponse.redirect(new URL(`/admin/members/new?error=${code}`, req.url), 303);
}
