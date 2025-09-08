// src/app/api/admin/kiosks/device/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = params.id;
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Mark device inactive (we keep kioskKey for audit, but it won’t be accepted)
  await prisma.device.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}
