// src/app/api/kiosk/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

function hashPassphrase(passphrase: string) {
  const pepper = process.env.KIOSK_INVITE_PEPPER;
  if (!pepper) {
    throw new Error("KIOSK_INVITE_PEPPER is not set");
  }

  return crypto
    .createHash("sha256")
    .update(`${pepper}:${passphrase}`)
    .digest("hex");
}

export async function POST(req: NextRequest) {
  let phrase = "";

  const ct = req.headers.get("content-type") || "";

  // Accept JSON or form posts
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    phrase = String(
      body?.passphrase ??
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
        form.get("passphrase") ??
          form.get("phrase") ??
          form.get("code") ??
          form.get("key") ??
          form.get("registrationKey") ??
          ""
      );
    }
  }

  if (!phrase) {
    return NextResponse.redirect(
      new URL("/register-kiosk?error=missing", req.url),
      303
    );
  }

  const hash = hashPassphrase(phrase);

  const invite = await prisma.kioskInvite.findFirst({
    where: {
      passphraseHash: hash,
    },
  });

  if (!invite) {
    return NextResponse.redirect(
      new URL("/register-kiosk?error=invalid", req.url),
      303
    );
  }

  if (invite.used) {
    return NextResponse.redirect(
      new URL("/register-kiosk?error=used", req.url),
      303
    );
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.redirect(
      new URL("/register-kiosk?error=invalid", req.url),
      303
    );
  }

  // Create the kiosk device
  const device = await prisma.device.create({
    data: {
      organisationId: invite.organisationId,
      stationId: invite.stationId,
      name: "Kiosk",
      kioskKey: crypto.randomUUID(),
      active: true,
    },
  });

  // Mark invite as used
  await prisma.kioskInvite.update({
    where: { id: invite.id },
    data: {
      used: true,
      usedAt: new Date(),
    },
  });

  // Redirect to kiosk UI with device key
  return NextResponse.redirect(
    new URL(`/kiosk?device=${device.kioskKey}`, req.url),
    303
  );
}
