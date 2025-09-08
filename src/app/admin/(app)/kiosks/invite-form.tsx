"use client";

import { useState } from "react";
import type { StationLite } from "./types";

export default function NewInviteForm({ stations }: { stations: StationLite[] }) {
  const [stationId, setStationId] = useState(stations[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/kiosks/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed with ${res.status}`);
      }

      const body = await res.json().catch(() => ({}));
      setSuccess(body?.message ?? "Invite created.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="stationId" className="block text-sm font-medium">
          Station
        </label>
        <select
          id="stationId"
          name="stationId"
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        >
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting || !stationId}
        className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {submitting ? "Creating…" : "Create Invite"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
    </form>
  );
}
