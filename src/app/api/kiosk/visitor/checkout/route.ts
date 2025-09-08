import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

type Device = {
  id: string;
  organisationId: string;
  stationId: string;
};

function isDevice(x: unknown): x is Device {
  return (
    !!x &&
    typeof x === "object" &&
    "organisationId" in x &&
    "stationId" in x &&
    "id" in x
  );
}

export async function POST(req: NextRequest) {
  // Resolve kiosk/device context
  const device = await requireKiosk(req);
  if (device instanceof Response) return device; // forward auth errors
  if (!isDevice(device)) {
    return NextResponse.json({ error: "Invalid device context" }, { status: 400 });
  }
  const { organisationId, stationId } = device;

  // Expect { sessionId } in body
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  // Ensure the open session belongs to this org/station
  const existing = await prisma.session.findFirst({
    where: {
      id: sessionId,
      organisationId,
      stationId,
      status: "open",
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Session not found or already closed" }, { status: 404 });
  }

  // Close the session; keep this minimal to avoid schema mismatches
  await prisma.session.update({
    where: { id: sessionId },
    data: { status: "closed" },
  });

  return NextResponse.json({ ok: true });
}
