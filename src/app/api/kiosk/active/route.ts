import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/db"; // ⬅️ adjust path if your prisma client lives elsewhere
import { kioskAuth } from "@/src/lib/kioskAuth"; // ⬅️ adjust to where you actually import from

type Device = {
  id: string;
  organisationId: string;
  stationId: string;
};

/** Type guard to ensure object is a Device */
function isDevice(x: unknown): x is Device {
  return !!x && typeof x === "object"
    && "organisationId" in x
    && "stationId" in x
    && "id" in x;
}

export async function GET(req: NextRequest) {
  // Resolve device from your existing auth helper
  const device = await kioskAuth(req);

  // If kioskAuth returned a Response (auth failure, etc.), just return it
  if (device instanceof Response) {
    return device;
  }

  // Defensive: check that it looks like a Device object
  if (!isDevice(device)) {
    return NextResponse.json({ error: "Invalid device context" }, { status: 400 });
  }

  const { organisationId, stationId } = device;

  // Query open sessions for this org/station
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
