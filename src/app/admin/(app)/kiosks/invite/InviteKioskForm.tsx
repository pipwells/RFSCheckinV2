// src/app/admin/(app)/kiosks/invite/InviteKioskForm.tsx
"use client";

import { useMemo, useState } from "react";

type StationItem = { id: string; name: string; code: string };

type InviteResponse = {
  phraseDisplay: string;
  expiresAt: string;
};

export default function InviteKioskForm({ stations }: { stations: StationItem[] }) {
  const defaultStationId = useMemo(() => stations[0]?.id ?? "", [stations]);
  const [stationId, setStationId] = useState(defaultStationId);
  const [kioskName, setKioskName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResponse | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/kiosks/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stationId, kioskName }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as Partial<InviteResponse> & { error?: string };
      if (!data.phraseDisplay || !data.expiresAt) {
        throw new Error(data.error || "Invite API did not return phraseDisplay/expiresAt");
      }

      setResult({ phraseDisplay: data.phraseDisplay, expiresAt: data.expiresAt });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate invite";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const stationLabel = (id: string) => {
    const s = stations.find((x) => x.id === id);
    return s ? `${s.name} (${s.code})` : id;
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Station</label>
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
          required
          disabled={stations.length === 0}
        >
          {stations.length === 0 ? (
            <option value="">No stations available</option>
          ) : (
            stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Kiosk name</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="e.g. Watchroom iPad, Front Desk, Training Room"
          value={kioskName}
          onChange={(e) => setKioskName(e.target.value)}
          required
        />
      </div>

      <button
        className="rounded-lg px-4 py-2 bg-black text-white disabled:opacity-50"
        disabled={busy || !stationId || kioskName.trim().length === 0}
      >
        {busy ? "Generating..." : "Generate registration code"}
      </button>

      {result && (
        <div className="rounded-xl border p-4">
          <div className="text-sm text-gray-600 mb-1">Station</div>
          <div className="font-medium mb-3">{stationLabel(stationId)}</div>

          <div className="text-sm text-gray-600 mb-1">Kiosk name</div>
          <div className="font-medium mb-3">{kioskName}</div>

          <div className="text-sm text-gray-600 mb-1">Registration code</div>
          <div className="text-2xl font-mono font-semibold">{result.phraseDisplay}</div>

          <div className="text-sm text-gray-600 mt-2">
            Expires:{" "}
            {new Date(result.expiresAt).toLocaleString(undefined, {
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>

          <div className="text-sm text-gray-600 mt-3">
            Enter this code on the kiosk device at{" "}
            <code className="px-1 py-0.5 rounded bg-black/5">/register-kiosk</code>.
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
