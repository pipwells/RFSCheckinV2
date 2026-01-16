import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import type { Device, Station } from "@prisma/client";

import Link from "next/link";

<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-semibold">Kiosks</h1>

  <Link
    href="/admin/kiosks/invite"
    className="rounded-lg bg-black text-white px-4 py-2 hover:bg-gray-900"
  >
    Invite kiosk
  </Link>
</div>


type DeviceRow = {
  id: string;
  name: string;
  stationId: string | null;
  stationName?: string | null;
};

type DeviceWithStation = Device & { station: Station | null };

async function getData(orgId: string): Promise<DeviceRow[]> {
  const devices: DeviceWithStation[] = await prisma.device.findMany({
    where: { organisationId: orgId },
    include: { station: true },
    orderBy: { name: "asc" },
  });

  const rows: DeviceRow[] = devices.map((d: DeviceWithStation) => ({
    id: d.id,
    name: d.name,
    stationId: d.stationId,
    stationName: d.station?.name ?? null,
  }));

  return rows;
}

export default async function KiosksAdminPage() {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId!;
  const deviceRows: DeviceRow[] = await getData(orgId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Kiosks</h1>

      <div className="rounded-xl ring-1 ring-gray-200 bg-white divide-y">
        {deviceRows.length === 0 ? (
          <div className="p-4 text-gray-600">No kiosks found.</div>
        ) : (
          deviceRows.map((row: DeviceRow) => (
            <div key={row.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{row.name}</div>
                <div className="text-sm text-gray-600">
                  Station: {row.stationName ?? "—"}{" "}
                  <span className="ml-2 text-gray-400">
                    (ID: {row.stationId ?? "—"})
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button className="text-sm text-blue-600 hover:underline">
                  Edit
                </button>
                <button className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
