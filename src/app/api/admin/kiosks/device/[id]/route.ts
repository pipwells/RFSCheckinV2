import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";

type Params = { id: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/kiosks/device/[id]
 * Body: { name: string }
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { id } = await context.params;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const updated = await prisma.device.updateMany({
    where: { id, organisationId: orgId },
    data: { name },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/kiosks/device/[id]
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<Params> }
) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { id } = await context.params;

  const deleted = await prisma.device.deleteMany({
    where: { id, organisationId: orgId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
