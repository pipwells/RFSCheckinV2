import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeAUMobile } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Kiosk scan supports:
 * - RFID tag (keyboard wedge value -> MemberTag.tagValue)
 * - Fireground number (digits)
 * - Mobile number (AU) with ambiguity resolution
 *
 * Responses:
 * - { status: "unknown" }
 * - { error: "disabled" }
 * - { status: "already_in", sessionId, startTime, firstName }
 * - { status: "checked_in", sessionId, firstName }
 * - { status: "ambiguous", candidates: [{ id, firstName, lastName, firegroundNumber }] }
 * - { error: "no_kiosk" | "invalid_kiosk" } (401)
 */
export async function POST(req: NextRequest) {
  try {
    // 1) Verify kiosk cookie -> device
    const kioskKey = req.cookies.get("kiosk_key")?.value ?? null;
    if (!kioskKey) {
      return NextResponse.json({ error: "no_kiosk" }, { status: 401 });
    }

    const device = await prisma.device.findUnique({
      where: { kioskKey },
      select: { id: true, active: true, organisationId: true, stationId: true },
    });

    if (!device || !device.active) {
      return NextResponse.json({ error: "invalid_kiosk" }, { status: 401 });
    }

    // 2) Read input (accepts { identifier } … legacy { mobile } / { token } tolerated)
    const body = (await req.json().catch(() => ({}))) as {
      identifier?: string;
      mobile?: string;
      token?: string;
    };

    const raw = String(body.identifier ?? body.mobile ?? body.token ?? "").trim();
    if (!raw) return NextResponse.json({ status: "unknown" });

    // -----------------------------
    // 3) Attempt RFID tag match
    // -----------------------------
    const tag = await prisma.memberTag.findFirst({
      where: {
        organisationId: device.organisationId,
        active: true,
        tagValue: raw,
      },
      select: {
        member: {
          select: { id: true, firstName: true, lastName: true, status: true, isVisitor: true },
        },
      },
    });

    if (tag?.member && !tag.member.isVisitor) {
      const member = tag.member;

      if (member.status !== "active") {
        return NextResponse.json({ error: "disabled" }, { status: 200 });
      }

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
    }

    // -----------------------------
    // 4) Attempt Fireground match
    // -----------------------------
    const firegroundCandidate = raw.replace(/[^0-9]/g, "");
    if (firegroundCandidate.length > 0) {
      const member = await prisma.member.findFirst({
        where: {
          organisationId: device.organisationId,
          isVisitor: false,
          status: "active",
          firegroundNumber: firegroundCandidate,
        },
        select: { id: true, firstName: true, status: true },
      });

      if (member) {
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
      }
    }

    // -----------------------------
    // 5) Attempt Mobile match (may be shared)
    // -----------------------------
    const mobileNorm = normalizeAUMobile(raw);
    if (!mobileNorm) {
      return NextResponse.json({ status: "unknown" });
    }

    const matches = await prisma.member.findMany({
      where: {
        organisationId: device.organisationId,
        isVisitor: false,
        status: "active",
        mobileNormalized: mobileNorm,
      },
      select: { id: true, firstName: true, lastName: true, firegroundNumber: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 10,
    });

    if (matches.length <= 0) {
      return NextResponse.json({ status: "unknown" });
    }

    if (matches.length > 1) {
      return NextResponse.json({
        status: "ambiguous",
        candidates: matches,
      });
    }

    // Exactly one mobile match: proceed
    const member = matches[0];

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
    console.error("kiosk scan error", err);
    return NextResponse.json({ error: "server_error" }, { status: 200 });
  }
}
