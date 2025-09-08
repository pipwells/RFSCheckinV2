"use client";

import { useRouter } from "next/navigation";

export type DeviceRow = {
  id: string;
  name: string | null;
  stationId: string;
  active: boolean;
  // ✅ Pre-formatted label from the server (no client date formatting)
  lastSeenLabel: string | null;
};

export type StationLite = {
  id: string;
  name: string;
  code: string;
  organisationId: string;
};

export default function DeviceTable({
  devices,
  stations,
}: {
  devices: DeviceRow[];
  stations: StationLite[];
}) {
  const router = useRouter();
  const byId = Object.fromEntries(stations.map((s) => [s.id, s]));

  async function onDeregister(id: string) {
    if (!confirm("Deregister this kiosk? It will require a new registration key.")) return;
    const res = await fetch(`/api/admin/kiosks/device/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to deregister.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Station</th>
            <th className="px-3 py-2">Active</th>
            <th className="px-3 py-2">Last seen</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.id} className="border-t">
              <td className="px-3 py-2">{d.name || d.id.slice(0, 8)}</td>
              <td className="px-3 py-2">{byId[d.stationId]?.name ?? d.stationId}</td>
              <td className="px-3 py-2">{d.active ? "Yes" : "No"}</td>
              <td className="px-3 py-2">{d.lastSeenLabel ?? "—"}</td>
              <td className="px-3 py-2">
                {d.active ? (
                  <button
                    onClick={() => onDeregister(d.id)}
                    className="rounded px-3 py-1 border hover:bg-gray-100"
                  >
                    Deregister
                  </button>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
          {devices.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                No devices.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
