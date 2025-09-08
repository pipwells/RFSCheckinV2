// src/lib/kioskAuth.ts
import { prisma } from "./db";
import { cookies as getCookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function requireKiosk(req: NextRequest) {
  const cookieStore = await getCookies(); // Next 15 requires await
  const fromHeader = req.headers.get("x-kiosk-key") || "";
  const fromCookie = cookieStore.get("kiosk_key")?.value || "";
  const kioskKey = (fromHeader || fromCookie).trim();

  if (!kioskKey) {
    return new Response(JSON.stringify({ error: "missing_kiosk_key" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const device = await prisma.device.findFirst({
    where: { kioskKey, active: true },
    select: {
      id: true,
      name: true,
      stationId: true,
      organisationId: true,
    },
  });

  if (!device) {
    return new Response(JSON.stringify({ error: "invalid_kiosk_key" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Optionally update lastSeenAt
  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

  return device;
}
