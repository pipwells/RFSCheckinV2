// src/app/api/kiosk/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanPassphrase(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, "");
}

function hashPassphrase(passphrase: string) {
  const pepper = process.env.KIOSK_INVITE_PEPPER;
  if (!pepper) throw new Error("KIOSK_INVITE_PEPPER is not set");
  return crypto.createHash("sha256").update(`${pepper}:${passphrase}`).digest("hex");
}

function makeKioskKey() {
  return crypto.randomBytes(32).toString("hex"); // 64 chars
}

export async function POST(req: NextRequest) {
  try {
    let passphrase = "";

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      passphrase = String(
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
        passphrase = String(
          form.get("passphrase") ??
            form.get("phrase") ??
            form.get("code") ??
            form.get("key") ??
            form.get("registrationKey") ??
            ""
        );
      }
    }

    passphrase = cleanPassphrase(passphrase);

    if (!passphrase) {
      return NextResponse.redirect(new URL("/register-kiosk?error=missing", req.url), 303);
    }

    const passphraseHash = hashPassphrase(passphrase);
    const now = new Date();

    // Transaction: either everything succeeds, or nothing changes.
const { kioskKey } = await prisma.$transaction(async (tx: PrismaClient) => {
      const invite = await tx.kioskInvite.findFirst({
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

      if (!invite) throw new Error("invalid_or_expired");

      const kioskKey = makeKioskKey();

      await tx.device.create({
        data: {
          organisationId: invite.organisationId,
          stationId: invite.stationId,
          name:
            invite.kioskName && invite.kioskName.trim().length > 0
              ? invite.kioskName.trim()
              : "Kiosk",
          kioskKey,
          active: true,
          lastSeenAt: now,
        },
      });

      await tx.kioskInvite.update({
        where: { id: invite.id },
        data: { used: true, usedAt: now },
      });

      return { kioskKey };
    });

    // Persist kiosk identity + redirect to /kiosk
    const url = new URL("/kiosk", req.url);

    // Backwards compatible: some kiosk UIs look for ?device=...
    url.searchParams.set("device", kioskKey);

    const res = NextResponse.redirect(url, 303);

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    };

    // Cover common cookie names (in case kiosk code expects a different one)
    res.cookies.set("kioskKey", kioskKey, cookieOpts);
    res.cookies.set("kiosk_key", kioskKey, cookieOpts);
    res.cookies.set("device", kioskKey, cookieOpts);
    res.cookies.set("deviceKey", kioskKey, cookieOpts);

    return res;
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "invalid_or_expired") {
      return NextResponse.redirect(new URL("/register-kiosk?error=invalid", req.url), 303);
    }
    console.error("kiosk register failed:", e);
    return NextResponse.redirect(new URL("/register-kiosk?error=server", req.url), 303);
  }
}
