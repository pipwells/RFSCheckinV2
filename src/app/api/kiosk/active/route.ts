import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

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
  const device = await requireKiosk(req);

  // If the helper returned a Response (e.g., 401), forward it
  if (device instanceof Response) {
    return device;
  }

  // Defensive: ensure we have the expected shape
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
    // If your Session model has a timestamp like `createdAt`, you can sort:
    // orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rows);
}
