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

/** Very basic phone normaliser: digits only. Adjust if you already have one. */
function normalizeMobile(mobile: string | null | undefined): string {
  return (mobile ?? "").replace(/\D/g, "");
}

export async function POST(req: NextRequest) {
  // Resolve kiosk/device context
  const device = await requireKiosk(req);
  if (device instanceof Response) return device; // forward auth failures
  if (!isDevice(device)) {
    return NextResponse.json({ error: "Invalid device context" }, { status: 400 });
  }

  const { organisationId /*, stationId*/ } = device;

  // Read request body (shape may differ in your app—pull what you need)
  const body = (await req.json().catch(() => ({}))) as {
    mobile?: string;
    name?: string;
    // ...other fields your form sends
  };

  const norm = normalizeMobile(body.mobile);

  // --- Your existing logic can live below. Example safeguards preserved. ---

  // Block member mobiles (non-visitors)
  const clash = await prisma.member.findFirst({
    where: {
      organisationId,
      isVisitor: false,
      mobileNormalized: norm,
    },
    select: { id: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: "mobile_belongs_to_member" },
      { status: 409 }
    );
  }

  // TODO: Insert your existing visitor check-in logic here:
  // - find/create visitor by mobile
  // - create a session, etc.
  // For now, respond OK so the build passes and endpoint is reachable.
  return NextResponse.json({ ok: true });
}
