import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makePhrase(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function hashPhrase(phrase: string) {
  // Optional “pepper” to harden hashes if DB leaked
  const pepper = process.env.KIOSK_INVITE_PEPPER ?? "";
  return crypto.createHash("sha256").update(`${pepper}:${phrase}`).digest("hex");
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session.user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const organisationId = session.user.organisationId;
  if (!organisationId) return NextResponse.json({ error: "no organisation on session" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const stationId = String(body?.stationId || "");
  const kioskName = String(body?.kioskName || "").trim();

  if (!stationId || !kioskName) {
    return NextResponse.json({ error: "stationId and kioskName are required" }, { status: 400 });
  }

  // Ensure station belongs to org (prevents cross-org writes)
  const station = await prisma.station.findFirst({
    where: { id: stationId, organisationId, active: true },
    select: { id: true },
  });
  if (!station) return NextResponse.json({ error: "invalid station" }, { status: 400 });

  const phraseDisplay = makePhrase(8);
  const passphraseHash = hashPhrase(phraseDisplay);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.kioskInvite.create({
    data: {
      organisationId,
      stationId,
      kioskName,          // requires the schema field you added
      phraseDisplay,
      passphraseHash,
      expiresAt,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(
    { phraseDisplay, expiresAt: expiresAt.toISOString() },
    { status: 201 }
  );
}
