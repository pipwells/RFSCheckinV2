// src/app/kiosk/layout.tsx
import { prisma } from "@/lib/db";
import { cookies as getCookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await getCookies();
  const kioskKey = cookieStore.get("kiosk_key")?.value;

  // No cookie? Send to registration.
  if (!kioskKey) {
    redirect("/register-kiosk");
  }

  // Cookie exists, but ensure device is still active.
  const device = await prisma.device.findFirst({
    where: { kioskKey, active: true },
    select: { id: true },
  });

  if (!device) {
    // We can't delete cookies here (layouts can't mutate cookies).
    // Just redirect—this keeps the UX correct and is safe.
    redirect("/register-kiosk");
  }

  return <>{children}</>;
}
