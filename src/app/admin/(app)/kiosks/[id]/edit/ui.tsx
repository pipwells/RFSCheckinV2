"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EditKioskForm({
  id,
  initialName,
}: {
  id: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/kiosks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j?.error ? `Save failed: ${j.error}` : "Save failed");
        return;
      }

      router.push("/admin/kiosks");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Kiosk name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          required
        />
      </div>

      {err && <div className="text-sm text-red-700">{err}</div>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-black text-white px-4 py-2 hover:bg-gray-900 disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}
