"use client";

import { useState } from "react";
import type { StationLite } from "./page";

export default function NewInviteForm({ stations }: { stations: StationLite[] }) {
  const [stationId, setStationId] = useState(stations[0]?.id ?? "");
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<{ display?: string; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/admin/kiosks/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationId, expiresDays: days }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setResult({ error: data?.error || "Failed to create invite" });
      return;
    }
    setResult({ display: data.display });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm">Station</label>
      <select
        className="border rounded-lg px-3 py-2 w-full"
        value={stationId}
        onChange={(e) => setStationId(e.target.value)}
      >
        {stations.map(s => (
          <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
        ))}
      </select>

      <label className="block text-sm mt-2">Expires (days)</label>
      <input
        type="number"
        min={1}
        max={30}
        className="border rounded-lg px-3 py-2 w-32"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
      />

      <button className="rounded-lg px-4 py-2 bg-black text-white">
        {loading ? "Creating…" : "Create invite"}
      </button>

      {result?.display && (
        <div className="mt-3 rounded-lg border p-3 bg-gray-50">
          <div className="text-sm text-gray-600">Passphrase (share with kiosk):</div>
          <div className="font-mono text-lg">{result.display}</div>
          <div className="text-xs text-gray-500 mt-1">Use at /register-kiosk</div>
        </div>
      )}
      {result?.error && (
        <div className="mt-3 text-sm text-red-600">{result.error}</div>
      )}
    </form>
  );
}

