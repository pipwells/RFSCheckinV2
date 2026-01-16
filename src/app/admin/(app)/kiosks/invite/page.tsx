// src/app/admin/(app)/kiosks/invite/page.tsx
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { redirect } from "next/navigation";
import InviteKioskForm from "./InviteKioskForm";

export const dynamic = "force-dynamic";

export default async function KioskInvitePage() {
  const session = await getAdminSession();
  if (!session.user) redirect("/admin/login?next=/admin/kiosks/invite");

  const organisationId = session.user.organisationId;
  if (!organisationId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Invite kiosk</h1>
        <p className="text-gray-600 mt-2">No organisation is set on your session.</p>
      </div>
    );
  }

  const stations = await prisma.station.findMany({
    where: { organisationId, active: true },
    select: { id: true, name: true, code: true },
    orderBy: [{ name: "asc" }],
  });

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold mb-2">Invite kiosk</h1>
      <p className="text-gray-600 mb-6">
        Choose a station and kiosk name, generate a registration code, then enter it on the kiosk device at{" "}
        <code className="px-1 py-0.5 rounded bg-black/5">/register-kiosk</code>.
      </p>

      <InviteKioskForm stations={stations} />
    </div>
  );
}
