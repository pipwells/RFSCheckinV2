// src/app/api/kiosk/active/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

/**
 * Kiosk Active Sessions
 * Returns a stable shape that the kiosk UI can render without guessing.
 */
export async function GET(req: NextRequest) {
  const device = await requireKiosk(req);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { organisationId, stationId } = device;

  try {
    const rows = await prisma.session.findMany({
      where: { organisationId, stationId, status: "open" },
      orderBy: { startTime: "desc" },
      select: {
        id: true,
        memberId: true,
        startTime: true,
        member: {
          select: {
            firstName: true,
            lastName: true,
            isVisitor: true,
          },
        },
      },
    });

    // Normalise to the shape the kiosk expects
    const shaped = rows.map((s) => ({
      id: s.id,
      memberId: s.memberId,
      firstName: s.member?.firstName ?? "",
      lastName: s.member?.lastName ?? "",
      isVisitor: !!s.member?.isVisitor,
      startTime: s.startTime.toISOString(),
    }));

    return NextResponse.json(shaped);
  } catch (err) {
    console.error("kiosk active error", err);
    return NextResponse.json([]);
  }
}
