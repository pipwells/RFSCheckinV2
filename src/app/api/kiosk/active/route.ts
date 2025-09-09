import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const device = await requireKiosk(req);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { organisationId, stationId } = device;

  // Keep minimal to avoid schema drift during dev; return open sessions if shape matches,
  // otherwise return an empty list.
  try {
    const rows = await prisma.session.findMany({
      where: { organisationId, stationId, status: "open" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}
