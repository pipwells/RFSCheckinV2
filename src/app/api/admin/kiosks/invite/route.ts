// src/app/api/admin/kiosks/invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { generatePassphrase, sha256Hex } from "@/lib/passphrase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const stationId = String(body?.stationId || "");
  const expiresDays = Math.max(1, Math.min(30, Number(body?.expiresDays || 7)));

  if (!stationId) {
    return NextResponse.json({ error: "missing_station" }, { status: 400 });
  }

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { id: true, organisationId: true },
  });
  if (!station) {
    return NextResponse.json({ error: "invalid_station" }, { status: 404 });
  }

  const { phrase, display } = generatePassphrase();
  const passphraseHash = sha256Hex(phrase);
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  await prisma.kioskInvite.create({
    data: {
      organisationId: station.organisationId,
      stationId: station.id,
      passphraseHash,
      phraseDisplay: display,
      expiresAt,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ display });
}
