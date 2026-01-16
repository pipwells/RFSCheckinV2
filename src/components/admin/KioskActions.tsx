"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export function KioskActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("Delete this kiosk?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/kiosks/${id}`, { method: "DELETE" });
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
    <div className="flex gap-2 justify-end">
      <Link
        href={`/admin/kiosks/${id}/edit`}
        className="rounded-lg border px-3 py-1.5 hover:bg-gray-50"
      >
        Edit
      </Link>

      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="rounded-lg border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
