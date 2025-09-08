// src/app/admin/(app)/kiosks/page.tsx
import { prisma } from "@/lib/db";
import NewInviteForm from "./invite-form";
import DeviceTable, { type DeviceRow, type StationLite } from "./device-table";

export const dynamic = "force-dynamic";

export default async function KiosksPage() {
  const [stations, devices, invites] = await Promise.all([
    prisma.station.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, organisationId: true },
    }),
    prisma.device.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        kioskKey: true,
        stationId: true,
        lastSeenAt: true,
        active: true,
      },
      take: 100,
    }),
    prisma.kioskInvite.findMany({
      where: { used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, phraseDisplay: true, expiresAt: true, stationId: true },
      take: 20,
    }),
  ]);

  const stationsLite = stations as StationLite[];

  // ✅ Server-side, deterministic formatting (avoid hydration mismatches)
  const fmt = new Intl.DateTimeFormat("en-AU", {
    dateStyle: "short",
    timeStyle: "medium",
    hour12: true,
    timeZone: "Australia/Sydney",
  });

  const deviceRows: DeviceRow[] = devices.map((d) => ({
    id: d.id,
    name: d.name,
    stationId: d.stationId,
    active: d.active,
    lastSeenLabel: d.lastSeenAt ? fmt.format(d.lastSeenAt) : null,
  }));

  const byId = Object.fromEntries(stations.map((s) => [s.id, s]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Kiosks</h1>
        <p className="text-gray-600">
          Register new kiosks with a registration key, or review active devices.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">Create registration key</h2>
          <NewInviteForm stations={stationsLite} />
          {invites.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium mb-2">Active keys</h3>
              <ul className="space-y-2">
                {invites.map((iv) => (
                  <li
                    key={iv.id}
                    className="rounded-lg border p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono">{iv.phraseDisplay}</div>
                      <div className="text-xs text-gray-500">
                        Station: {byId[iv.stationId]?.name ?? iv.stationId} • Expires:{" "}
                        {fmt.format(iv.expiresAt)}
                      </div>
                    </div>
                    <a className="text-sm underline" href="/register-kiosk" target="_blank">
                      Registration page
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="font-medium mb-3">Devices (latest 100)</h2>
          <DeviceTable devices={deviceRows} stations={stationsLite} />
        </div>
      </div>
    </div>
  );
}
