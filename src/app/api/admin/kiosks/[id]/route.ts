import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session.user?.organisationId) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const updated = await prisma.device.updateMany({
    where: { id, organisationId: session.user.organisationId },
    data: { name },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session.user?.organisationId) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const deleted = await prisma.device.deleteMany({
    where: { id, organisationId: session.user.organisationId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
