// src/app/api/kiosk/visitor/checkin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

type VisitorCheckinBody = {
  firstName?: string;
  lastName?: string;
  mobile?: string;
  agency?: string;
  purpose?: string;
};

function normMobileAU(input: string | undefined | null): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return null;

  // Best-effort AU normalisation:
  // - handle +61 / 61 -> 0
  // - keep 04xxxxxxxx
  if (digits.startsWith("61") && digits.length >= 11) {
    const rest = digits.slice(2);
    return rest.startsWith("0") ? rest : `0${rest}`;
  }
  if (digits.startsWith("0")) return digits;
  // If someone types 4xxxxxxxx (missing leading 0), prepend it.
  if (digits.startsWith("4") && digits.length === 9) return `0${digits}`;

  return digits; // fallback
}

function makeVisitormember(): string {
  // Must satisfy Member.memberNumber required + unique per organisation.
  // Keep it short-ish but collision-resistant.
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VIS-${ts}-${rnd}`;
}

export async function POST(req: NextRequest) {
  const device = await requireKiosk(req);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as VisitorCheckinBody;

  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const mobile = body.mobile ? String(body.mobile).trim() : null;
  const mobileNormalized = normMobileAU(mobile);
  const visitorAgency = String(body.agency || "").trim() || null;
  const visitorPurpose = String(body.purpose || "").trim() || null;

  if (!firstName) return NextResponse.json({ error: "missing_firstName" }, { status: 400 });

  try {
    // IMPORTANT: visitors are separate entities even if mobile matches a member.
    // Only search within visitor records.
    let visitorMember =
      mobileNormalized
        ? await prisma.member.findFirst({
            where: {
              organisationId: device.organisationId,
              isVisitor: true,
              mobileNormalized,
            },
          })
        : null;

    // Create visitor member if not found (or no mobile provided)
    if (!visitorMember) {
      // Ensure we don't collide on memberNumber unique constraint
      // Retry a couple of times in the (very unlikely) event of collision.
      let memberNumber = makeVisitormember();
      for (let i = 0; i < 3; i++) {
        const exists = await prisma.member.findFirst({
          where: { organisationId: device.organisationId, memberNumber },
          select: { id: true },
        });
        if (!exists) break;
        memberNumber = makeVisitormember();
      }

      visitorMember = await prisma.member.create({
        data: {
          organisationId: device.organisationId,
          memberNumber,
          firstName,
          lastName: lastName || "Visitor",
          mobile: mobile,
          mobileNormalized: mobileNormalized,
          isVisitor: true,
          status: "active",
        },
      });
    } else {
      // Keep visitor profile fresh (non-destructive)
      await prisma.member.update({
        where: { id: visitorMember.id },
        data: {
          firstName,
          lastName: lastName || visitorMember.lastName || "Visitor",
          mobile: mobile ?? visitorMember.mobile,
          mobileNormalized: mobileNormalized ?? visitorMember.mobileNormalized,
          status: "active",
        },
      });
    }

    // If already open at this station, just return it (prevents duplicates from double-submit)
    const existingOpen = await prisma.session.findFirst({
      where: {
        organisationId: device.organisationId,
        stationId: device.stationId,
        memberId: visitorMember.id,
        status: "open",
      },
      select: { id: true, startTime: true },
      orderBy: { startTime: "desc" },
    });

    if (existingOpen) {
      return NextResponse.json({
        status: "already_in",
        sessionId: existingOpen.id,
        firstName: visitorMember.firstName,
        startTime: existingOpen.startTime.toISOString(),
        isVisitor: true,
      });
    }

    const now = new Date();

    const session = await prisma.session.create({
      data: {
        memberId: visitorMember.id,
        organisationId: device.organisationId,
        stationId: device.stationId,
        deviceId: device.id,
        startTime: now,
        rawCheckinAt: now,
        status: "open",
        editLevel: "none",
        visitorAgency,
        visitorPurpose,
      },
      select: { id: true, startTime: true },
    });

    return NextResponse.json({
      status: "checked_in",
      sessionId: session.id,
      firstName: visitorMember.firstName,
      startTime: session.startTime.toISOString(),
      isVisitor: true,
    });
  } catch (err) {
    console.error("visitor checkin error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
