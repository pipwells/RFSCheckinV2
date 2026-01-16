import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import type { Device, Station } from "@prisma/client";
import Link from "next/link";
import { KioskRowActions } from "./ui";

export const dynamic = "force-dynamic";

type DeviceRow = {
  id: string;
  name: string;
  stationId: string;
  stationName: string | null;
};

type DeviceWithStation = Device & { station: Station | null };

async function getData(orgId: string): Promise<DeviceRow[]> {
  const devices: DeviceWithStation[] = await prisma.device.findMany({
    where: { organisationId: orgId },
    include: { station: true },
    orderBy: { name: "asc" },
  });

  return devices.map((d) => ({
    id: d.id,
    name: d.name,
    stationId: d.stationId,
    stationName: d.station?.name ?? null,
  }));
}

export default async function KiosksAdminPage() {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;

  if (!orgId) {
    // keep it simple; your admin shell likely already guards this elsewhere
    return (
      <div className="p-6">
        <div className="text-red-700">Not signed in.</div>
      </div>
    );
  }

  const deviceRows = await getData(orgId);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kiosks</h1>

        <Link
          href="/admin/kiosks/invite"
          className="rounded-lg bg-black text-white px-4 py-2 hover:bg-gray-900"
        >
          Invite kiosk
        </Link>
      </div>

      <div className="rounded-xl ring-1 ring-gray-200 bg-white divide-y">
        {deviceRows.length === 0 ? (
          <div className="p-4 text-gray-600">No kiosks found.</div>
        ) : (
          deviceRows.map((row) => (
            <div key={row.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{row.name}</div>
                <div className="text-sm text-gray-600">
                  Station: {row.stationName ?? "—"}
                  <span className="ml-2 text-gray-400">(ID: {row.stationId})</span>
                </div>
              </div>

              <KioskRowActions id={row.id} name={row.name} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
