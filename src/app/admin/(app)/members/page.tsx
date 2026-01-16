import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import type { Member } from "@prisma/client";

export const dynamic = "force-dynamic";

type MemberRow = {
  id: string;
  firegroundNumber: string;
  name: string;
  mobile: string;
  status: string;
};

async function getData(orgId: string): Promise<MemberRow[]> {
  const members: Member[] = await prisma.member.findMany({
    where: { organisationId: orgId, isVisitor: false },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return members.map((m) => ({
    id: m.id,
    firegroundNumber: (m as any).firegroundNumber ?? "",
    name: `${m.firstName} ${m.lastName}`.trim(),
    mobile: m.mobile ?? "",
    status: (m as any).status ?? "active",
  }));
}

export default async function MembersAdminPage() {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId!;
  const rows = await getData(orgId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Members</h1>
        <Link
          href="/admin/members/new"
          className="rounded-lg bg-black text-white px-4 py-2 hover:bg-gray-900"
        >
          New member
        </Link>
      </div>

      <div className="rounded-xl ring-1 ring-gray-200 bg-white divide-y">
        {rows.length === 0 ? (
          <div className="p-4 text-gray-600">No members found.</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">
                  {row.name || "—"}{" "}
                  <span className="text-sm text-gray-500 ml-2">
                    #{row.firegroundNumber || "—"}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {row.mobile ? `Mobile: ${row.mobile}` : "Mobile: —"} · Status: {row.status}
                </div>
              </div>

              <div className="flex gap-3">
                <button className="text-sm text-blue-600 hover:underline" disabled>
                  Edit
                </button>
                <button className="text-sm text-red-600 hover:underline" disabled>
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
