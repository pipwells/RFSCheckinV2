import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";             // ✅ alias @/ -> ./src
import { kioskAuth } from "@/lib/kioskAuth";

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
  const device = await kioskAuth(req);

  // If kioskAuth returned a Response (e.g. 401), forward it
  if (device instanceof Response) {
    return device;
  }

  // Defensive: ensure we have the device shape
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
