import { prisma } from "./db";
import { cookies as getCookies } from "next/headers";
import type { NextRequest } from "next/server";

export type Device = {
  id: string;
  organisationId: string;
  stationId: string;
  name: string;
};

export async function requireKiosk(req: NextRequest): Promise<Device | null> {
  const cookieStore = await getCookies();
  const fromHeader = req.headers.get("x-kiosk-key") || "";
  const fromCookie = cookieStore.get("kiosk_key")?.value || "";
  const kioskKey = (fromHeader || fromCookie).trim();

  if (!kioskKey) return null;

  const device = await prisma.device.findFirst({
    where: { kioskKey, active: true },
    select: { id: true, name: true, organisationId: true, stationId: true },
  });

  if (!device) return null;

  // best-effort heart-beat
  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

  return device;
}
