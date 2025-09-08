// src/app/api/kiosk/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePassphrase, sha256Hex, randomKeyHex } from "@/lib/passphrase";

export async function POST(req: NextRequest) {
  let passphrase = "";

  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    passphrase = String(body?.passphrase || "");
  } else {
    const form = await req.formData().catch(() => undefined);
    passphrase = String(form?.get("passphrase") || "");
  }

  const norm = normalizePassphrase(passphrase);
  const hash = sha256Hex(norm);

  const invite = await prisma.kioskInvite.findFirst({
    where: {
      passphraseHash: hash,
      used: false,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      organisationId: true,
      stationId: true,
    },
  });

  if (!invite) {
    return NextResponse.redirect(new URL("/register-kiosk?error=invalid", req.url), 303);
  }

  const kioskKey = randomKeyHex(32);
  const device = await prisma.device.create({
    data: {
      organisationId: invite.organisationId,
      stationId: invite.stationId,
      name: "Kiosk",
      kioskKey,
      active: true,
      lastSeenAt: new Date(),
    },
    select: { id: true },
  });

  // Mark invite used
  await prisma.kioskInvite.update({
    where: { id: invite.id },
    data: { used: true, usedAt: new Date() },
  });

  const res = NextResponse.redirect(new URL("/kiosk", req.url), 303);
  // Cookie for kiosk auth
  res.cookies.set("kiosk_key", kioskKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
  });
  return res;
}
