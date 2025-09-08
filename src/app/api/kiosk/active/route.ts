import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";            // ← named import per Turbopack hint
import { requireKiosk } from "@/lib/kioskAuth"; // ← named import per Turbopack hint

type Device = {
  id: string;
  organisationId: string;
  stationId: string;
};

/** Type guard to ensure object is a Device */
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
  // Your auth helper appears to return either a Response (on failure) or a device-like object.
  const device = await requireKiosk(req);

  // If the helper returned a Response (e.g., 401/403), forward it as-is.
  if (device instanceof Response) {
    return device;
  }

  // Defensive: ensure we have the expected shape
  if (!isDevice(device)) {
    return NextResponse.json({ error: "Invalid device context" }, { status: 400 });
  }

  const { organisationId, stationId } = device;

  const rows = await prisma.session.findMany({
    where: {
      organisationId,
      stationId,
      status: "open",
    },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json(rows);
}
