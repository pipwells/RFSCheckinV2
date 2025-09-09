import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const device = await requireKiosk(req);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";

  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  try {
    const row = await prisma.session.findFirst({ where: { id: id } });
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
