// src/app/api/kiosk/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeAUMobile } from "@/lib/phone";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1) Verify kiosk cookie -> device
    const kioskKey = req.cookies.get("kiosk_key")?.value ?? null;
    if (!kioskKey) {
      // No kiosk cookie — tell the client cleanly
      return NextResponse.json({ error: "no_kiosk" }, { status: 401 });
    }

    const device = await prisma.device.findUnique({
      where: { kioskKey },
      select: { id: true, active: true, organisationId: true, stationId: true },
    });

    if (!device || !device.active) {
      return NextResponse.json({ error: "invalid_kiosk" }, { status: 401 });
    }

    // 2) Read input (accepts { mobile } … legacy { token } tolerated)
    const body = (await req.json().catch(() => ({}))) as {
      mobile?: string;
      token?: string;
    };
    const raw = (body.mobile ?? body.token ?? "").trim();

    // If nothing entered, or badly formed, return "unknown" (not 500)
    const norm = normalizeAUMobile(raw);
    if (!norm) {
      return NextResponse.json({ status: "unknown" }); // invalid format
    }

    // 3) Look up a NON-VISITOR, ACTIVE member by normalized mobile
    const member = await prisma.member.findFirst({
      where: {
        organisationId: device.organisationId,
        isVisitor: false,
        status: "active",
        mobileNormalized: norm,
      },
      select: { id: true, firstName: true, status: true },
    });

    if (!member) {
      // Not recognized as a member
      return NextResponse.json({ status: "unknown" });
    }

    // Safety: if member is disabled (status != active), block
    if (member.status !== "active") {
      return NextResponse.json({ error: "disabled" }, { status: 200 });
    }

    // 4) If they already have an open session anywhere, treat as "already_in"
    const open = await prisma.session.findFirst({
      where: {
        memberId: member.id,
        status: "open",
      },
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

    // 5) Otherwise create a new session at this kiosk’s station
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
    // Never throw raw errors to the client from the kiosk; keep it clean
    console.error("kiosk scan error", err);
    return NextResponse.json({ error: "server_error" }, { status: 200 });
  }
}
