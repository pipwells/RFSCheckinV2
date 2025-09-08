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

export async function GET(req: NextRequest) {
  // Auth/device context
  const device = await requireKiosk(req);
  if (device instanceof Response) return device;
  if (!isDevice(device)) {
    return NextResponse.json({ error: "Invalid device context" }, { status: 400 });
  }

  // Session id from query string: /api/kiosk/session?id=...
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  const { organisationId, stationId } = device;

  const row = await prisma.session.findFirst({
    where: {
      id,
      organisationId,
      stationId,
    },
    // If you need fields trimmed down, add `select: { ... }` here.
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}
