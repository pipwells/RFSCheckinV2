import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const device = await requireKiosk(req);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Minimal ack to unblock builds; restore your detailed task logging later.
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, received: body });
}
