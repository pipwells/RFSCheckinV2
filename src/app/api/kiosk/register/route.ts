import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashPhrase(phrase: string) {
  const pepper = process.env.KIOSK_INVITE_PEPPER ?? "";
  return crypto.createHash("sha256").update(`${pepper}:${phrase}`).digest("hex");
}

function makeKioskKey() {
  // 32 bytes -> 64 hex chars
  return crypto.randomBytes(32).toString("hex");
}

function cleanPhrase(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, "");
}

export async function POST(req: NextRequest) {
  let phrase = "";

  // Accept both JSON + form posts, with a few common field names
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    phrase = String(
      body?.phrase ??
        body?.code ??
        body?.key ??
        body?.registrationKey ??
        ""
    );
  } else {
    const form = await req.formData().catch(() => undefined);
    if (form) {
      phrase = String(
        form.get("phrase") ??
          form.get("code") ??
          form.get("key") ??
          form.get("registrationKey") ??
          ""
      );
    }
  }

  phrase = cleanPhrase(phrase);

  if (!phrase) {
    return NextResponse.json({ error: "missing_registration_key" }, { status: 400 });
  }

  const passphraseHash = hashPhrase(phrase);
  const now = new Date();

  // Find a valid, unused invite
  const invite = await prisma.kioskInvite.findFirst({
    where: {
      passphraseHash,
      used: false,
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      organisationId: true,
      stationId: true,
      kioskName: true,
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
  }

  // Create the device (your “kiosk”)
  const kioskKey = makeKioskKey();

  const device = await prisma.device.create({
    data: {
      organisationId: invite.organisationId,
      stationId: invite.stationId,
      name: invite.kioskName && invite.kioskName.length > 0 ? invite.kioskName : "Kiosk",
      kioskKey,
      active: true,
      lastSeenAt: now,
    },
    select: { id: true },
  });

  // Mark invite used
  await prisma.kioskInvite.update({
    where: { id: invite.id },
    data: { used: true, usedAt: now },
  });

  // Store kiosk key in an httpOnly cookie for the kiosk app to use
  const res = NextResponse.redirect(new URL("/kiosk", req.url), 303);
  res.cookies.set("kioskKey", kioskKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  // Optional: also include deviceId for debugging
  res.headers.set("x-kiosk-device-id", device.id);

  return res;
}
