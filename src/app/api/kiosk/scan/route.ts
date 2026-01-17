import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeAUMobile } from "@/lib/phone";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

function isProbablyTag(raw: string) {
  // If any letters are present, treat as RFID tag.
  return /[a-z]/i.test(raw);
}

function looksLikeAuMobile(raw: string) {
  const s = raw.trim();
  if (!s) return false;
  if (s.startsWith("+61")) return true;
  if (s.startsWith("61")) return true;
  if (s.startsWith("04")) return true;
  // If someone types just digits, common mobile lengths are 9–10 (04xxxxxxxx or 4xxxxxxxxx)
  const digits = s.replace(/\D/g, "");
  return digits.length >= 9;
}

async function findOpenSession(memberId: string) {
  return prisma.session.findFirst({
    where: { memberId, status: "open" },
    select: { id: true, startTime: true },
    // NO orderBy: let the index do the work
  });
}

async function createSession(device: { organisationId: string; stationId: string; id: string }, memberId: string) {
  const now = new Date();
  return prisma.session.create({
    data: {
      organisationId: device.organisationId,
      stationId: device.stationId,
      memberId,
      deviceId: device.id,
      startTime: now,
      rawCheckinAt: now,
      status: "open",
    },
    select: { id: true },
  });
}

/**
 * Kiosk scan supports:
 * - RFID tag (keyboard wedge value -> MemberTag.tagValue)
 * - Fireground number (digits)
 * - Mobile number (AU) with ambiguity resolution
 */
export async function POST(req: NextRequest) {
  try {
    // 1) Verify kiosk
    const device = await requireKiosk(req);
    if (!device) return NextResponse.json({ error: "no_kiosk" }, { status: 401 });

    // 2) Read input
    const body = (await req.json().catch(() => ({}))) as {
      identifier?: string;
      mobile?: string;
      token?: string;
    };

    const raw = String(body.identifier ?? body.mobile ?? body.token ?? "").trim();
    if (!raw) return NextResponse.json({ status: "unknown" });

    // -----------------------------
    // 3) Routing heuristics to avoid extra queries
    // -----------------------------
    const treatAsTag = isProbablyTag(raw);
    const treatAsMobile = !treatAsTag && looksLikeAuMobile(raw);

    // -----------------------------
    // 4) Tag path (fast 1 query + open check + create)
    // -----------------------------
    if (treatAsTag) {
      const tag = await prisma.memberTag.findFirst({
        where: {
          organisationId: device.organisationId,
          active: true,
          tagValue: raw,
        },
        select: {
          member: {
            select: { id: true, firstName: true, status: true, isVisitor: true },
          },
        },
      });

      const member = tag?.member;
      if (!member || member.isVisitor) return NextResponse.json({ status: "unknown" });

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

      const session = await createSession(device, member.id);
      return NextResponse.json({
        status: "checked_in",
        sessionId: session.id,
        firstName: member.firstName ?? "",
      });
    }

    // -----------------------------
    // 5) Mobile path (skip tag query)
    // -----------------------------
    if (treatAsMobile) {
      const mobileNorm = normalizeAUMobile(raw);
      if (!mobileNorm) return NextResponse.json({ status: "unknown" });

      // Probe first: cheap ambiguity check
      const probe = await prisma.member.findMany({
        where: {
          organisationId: device.organisationId,
          isVisitor: false,
          status: "active",
          mobileNormalized: mobileNorm,
        },
        select: { id: true },
        take: 2,
      });

      if (probe.length === 0) return NextResponse.json({ status: "unknown" });

      if (probe.length > 1) {
        // Only now fetch the full candidate list (UI needs names)
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

        return NextResponse.json({ status: "ambiguous", candidates: matches });
      }

      // Exactly one match: fetch minimal member fields and proceed
      const member = await prisma.member.findFirst({
        where: {
          id: probe[0].id,
          organisationId: device.organisationId,
          isVisitor: false,
        },
        select: { id: true, firstName: true, status: true },
      });

      if (!member || member.status !== "active") return NextResponse.json({ status: "unknown" });

      const open = await findOpenSession(member.id);
      if (open) {
        return NextResponse.json({
          status: "already_in",
          sessionId: open.id,
          startTime: open.startTime.toISOString(),
          firstName: member.firstName ?? "",
        });
      }

      const session = await createSession(device, member.id);
      return NextResponse.json({
        status: "checked_in",
        sessionId: session.id,
        firstName: member.firstName ?? "",
      });
    }

    // -----------------------------
    // 6) Fireground path first, tag fallback (digits-only or short codes)
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
        select: { id: true, firstName: true },
      });

      if (member) {
        const open = await findOpenSession(member.id);
        if (open) {
          return NextResponse.json({
            status: "already_in",
            sessionId: open.id,
            startTime: open.startTime.toISOString(),
            firstName: member.firstName ?? "",
          });
        }

        const session = await createSession(device, member.id);
        return NextResponse.json({
          status: "checked_in",
          sessionId: session.id,
          firstName: member.firstName ?? "",
        });
      }
    }

    // Fallback: digits-only tag (some RFID readers output numeric-only)
    const tag = await prisma.memberTag.findFirst({
      where: {
        organisationId: device.organisationId,
        active: true,
        tagValue: raw,
      },
      select: {
        member: { select: { id: true, firstName: true, status: true, isVisitor: true } },
      },
    });

    const member = tag?.member;
    if (!member || member.isVisitor) return NextResponse.json({ status: "unknown" });
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

    const session = await createSession(device, member.id);
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
