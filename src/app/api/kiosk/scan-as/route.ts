import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Used after an "ambiguous" mobile scan: kiosk selects the member explicitly.
 *
 * Body: { memberId: string }
 * Responses mirror /api/kiosk/scan: checked_in | already_in | unknown | disabled
 */
export async function POST(req: NextRequest) {
  try {
    const kioskKey = req.cookies.get("kiosk_key")?.value ?? null;
    if (!kioskKey) return NextResponse.json({ error: "no_kiosk" }, { status: 401 });

    const device = await prisma.device.findUnique({
      where: { kioskKey },
      select: { id: true, active: true, organisationId: true, stationId: true },
    });

    if (!device || !device.active) {
      return NextResponse.json({ error: "invalid_kiosk" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { memberId?: string };
    const memberId = String(body.memberId ?? "").trim();
    if (!memberId) return NextResponse.json({ status: "unknown" });

    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        organisationId: device.organisationId,
        isVisitor: false,
      },
      select: { id: true, firstName: true, status: true },
    });

    if (!member) return NextResponse.json({ status: "unknown" });
    if (member.status !== "active") return NextResponse.json({ error: "disabled" }, { status: 200 });

    const open = await prisma.session.findFirst({
      where: { memberId: member.id, status: "open" },
      select: { id: true, startTime: true },
      orderBy: { startTime: "desc" },
    });

    if (open) {
      return NextResponse.json({
        status: "already_in",
        sessionId: open.id,
        startTime: open.startTime.toISOString(),
        firstName: member.firstName ?? "",
      });
    }

    const now = new Date();
    const session = await prisma.session.create({
      data: {
        organisationId: device.organisationId,
        stationId: device.stationId,
        memberId: member.id,
        deviceId: device.id,
        startTime: now,
        rawCheckinAt: now,
        status: "open",
      },
      select: { id: true },
    });

    return NextResponse.json({
      status: "checked_in",
      sessionId: session.id,
      firstName: member.firstName ?? "",
    });
  } catch (err) {
    console.error("kiosk scan-as error", err);
    return NextResponse.json({ error: "server_error" }, { status: 200 });
  }
}
