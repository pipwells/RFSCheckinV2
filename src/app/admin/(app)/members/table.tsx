"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export type MemberRow = {
  id: string;
  name: string;
  mobile: string;
  status: "active" | "disabled" | string;
  updatedLabel: string;
};

export default function MembersTable({ rows }: { rows: MemberRow[] }) {
  const router = useRouter();

  async function setStatus(id: string, status: "active" | "disabled") {
    const res = await fetch(`/api/admin/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Failed to update status");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Mobile</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Updated</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2">{r.mobile || "—"}</td>
              <td className="px-3 py-2">{r.status}</td>
              <td className="px-3 py-2">{r.updatedLabel}</td>
              <td className="px-3 py-2 text-right space-x-2">
                <Link
                  href={`/admin/members/${r.id}`}
                  className="rounded px-3 py-1 border hover:bg-gray-100"
                >
                  Edit
                </Link>
                {r.status === "active" ? (
                  <button
                    className="rounded px-3 py-1 border hover:bg-gray-100"
                    onClick={() => setStatus(r.id, "disabled")}
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    className="rounded px-3 py-1 border hover:bg-gray-100"
                    onClick={() => setStatus(r.id, "active")}
                  >
                    Enable
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                No members yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
