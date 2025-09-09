import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import type { Member } from "@prisma/client";

type MemberRow = {
  id: string;
  name: string;
  mobile: string;
  role: string | null;
  active: boolean;
};

async function getData(orgId: string): Promise<MemberRow[]> {
  const members: Member[] = await prisma.member.findMany({
    where: { organisationId: orgId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows: MemberRow[] = members.map((m: Member) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`.trim(),
    mobile: m.mobile ?? "",
    role: (m as any).role ?? null, // if your schema has `role`; safe fallback otherwise
    active: (m as any).active ?? true, // safe default if missing in schema
  }));

  return rows;
}

export default async function MembersAdminPage() {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId!;
  const rows: MemberRow[] = await getData(orgId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Members</h1>

      <div className="rounded-xl ring-1 ring-gray-200 bg-white divide-y">
        {rows.length === 0 ? (
          <div className="p-4 text-gray-600">No members found.</div>
        ) : (
          rows.map((row: MemberRow) => (
            <div
              key={row.id}
              className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-2 sm:items-center"
            >
              <div className="sm:col-span-2">
                <div className="font-semibold">{row.name || "—"}</div>
                <div className="text-sm text-gray-600">
                  {row.mobile ? `Mobile: ${row.mobile}` : "Mobile: —"}
                </div>
              </div>

              <div className="text-sm text-gray-800">
                Role: {row.role ?? "—"}
              </div>

              <div className="text-sm">
                Status:{" "}
                {row.active ? (
                  <span className="text-green-700">Active</span>
                ) : (
                  <span className="text-gray-500">Inactive</span>
                )}
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
