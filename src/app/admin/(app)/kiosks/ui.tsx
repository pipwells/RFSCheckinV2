"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function KioskRowActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onEdit() {
    const nextName = prompt("Kiosk name", name);
    if (nextName == null) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/kiosks/device/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error ? `Edit failed: ${j.error}` : "Edit failed");
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this kiosk?")) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/kiosks/device/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error ? `Delete failed: ${j.error}` : "Delete failed");
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={onEdit}
        className="text-sm text-blue-600 hover:underline disabled:opacity-50"
      >
        Edit
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className="text-sm text-red-600 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
