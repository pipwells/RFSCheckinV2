import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

async function findOpenSession(memberId: string) {
  return prisma.session.findFirst({
    where: { memberId, status: "open" },
    select: { id: true, startTime: true },
  });
}

export async function POST(req: NextRequest) {
  try {
    const device = await requireKiosk(req);
    if (!device) return NextResponse.json({ error: "no_kiosk" }, { status: 401 });

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

    const open = await findOpenSession(member.id);
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
