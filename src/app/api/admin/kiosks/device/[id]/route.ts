import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
): Promise<Response> {
  const session = await getAdminSession();
  if (!session.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.device.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}
