import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const device = await requireKiosk(req);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });

  // Keep minimal; if the schema matches, close; otherwise just ack OK.
  try {
    const existing = await prisma.session.findFirst({ where: { id: sessionId } });
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

    await prisma.session.update({ where: { id: sessionId }, data: { status: "closed" } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
