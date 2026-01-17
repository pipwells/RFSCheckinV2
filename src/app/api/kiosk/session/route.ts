// src/app/api/kiosk/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

function getSessionIdFromUrl(req: NextRequest): string {
  const sp = req.nextUrl.searchParams;
  return (
    sp.get("sessionId") ||
    sp.get("id") ||
    sp.get("session") ||
    ""
  ).trim();
}

export async function GET(req: NextRequest) {
  const device = await requireKiosk(req);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sessionId = getSessionIdFromUrl(req);
  if (!sessionId) return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });

  const s = await prisma.session.findFirst({
    where: {
      id: sessionId,
      organisationId: device.organisationId,
      stationId: device.stationId,
    },
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
      memberId: true,
      visitorAgency: true,
      visitorPurpose: true,
      member: {
        select: { firstName: true, lastName: true, isVisitor: true },
      },
    },
  });

  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    id: s.id,
    status: s.status,
    startTime: s.startTime?.toISOString() ?? null,
    endTime: s.endTime?.toISOString() ?? null,
    memberId: s.memberId,
    firstName: s.member?.firstName ?? "",
    lastName: s.member?.lastName ?? "",
    isVisitor: !!s.member?.isVisitor,
    visitorAgency: s.visitorAgency ?? null,
    visitorPurpose: s.visitorPurpose ?? null,
  });
}

export async function POST(req: NextRequest) {
  // Optional: support POST for clients already coded that way.
  const device = await requireKiosk(req);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { sessionId?: string; id?: string };
  const sessionId = String(body.sessionId || body.id || "").trim();
  if (!sessionId) return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });

  // Delegate to GET logic by re-querying
  const s = await prisma.session.findFirst({
    where: {
      id: sessionId,
      organisationId: device.organisationId,
      stationId: device.stationId,
    },
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
      memberId: true,
      visitorAgency: true,
      visitorPurpose: true,
      member: {
        select: { firstName: true, lastName: true, isVisitor: true },
      },
    },
  });

  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    id: s.id,
    status: s.status,
    startTime: s.startTime?.toISOString() ?? null,
    endTime: s.endTime?.toISOString() ?? null,
    memberId: s.memberId,
    firstName: s.member?.firstName ?? "",
    lastName: s.member?.lastName ?? "",
    isVisitor: !!s.member?.isVisitor,
    visitorAgency: s.visitorAgency ?? null,
    visitorPurpose: s.visitorPurpose ?? null,
  });
}
