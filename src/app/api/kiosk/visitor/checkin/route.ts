import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const device = await requireKiosk(req);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // For dev build: accept payload and return OK without heavy logic
  // (You can reinsert full check-in workflow later)
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, received: body });
}
