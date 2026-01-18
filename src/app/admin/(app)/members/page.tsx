import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import type { Member } from "@prisma/client";

export const dynamic = "force-dynamic";

type MemberRow = {
  id: string;
  firegroundNumber: string;
  firstName: string;
  lastName: string;
  name: string;
  mobile: string;
  status: string;
};

function norm(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

async function getData(orgId: string): Promise<MemberRow[]> {
  const members: Member[] = await prisma.member.findMany({
    where: { organisationId: orgId, isVisitor: false },
    // Keep DB ordering simple; we’ll do the active/disabled grouping in JS.
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return members.map((m) => ({
    id: m.id,
    firegroundNumber: (m as any).firegroundNumber ?? "",
    firstName: m.firstName ?? "",
    lastName: m.lastName ?? "",
    name: `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim(),
    mobile: m.mobile ?? "",
    status: (m as any).status ?? "active",
  }));
}

export default async function MembersAdminPage({
  searchParams,
}: {
  searchParams?: { showDisabled?: string };
}) {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) return null;

  const showDisabled = (searchParams?.showDisabled ?? "") === "1";

  const allRows = await getData(orgId);

  const active = allRows
    .filter((r) => r.status === "active")
    .sort((a, b) => {
      const ln = norm(a.lastName).localeCompare(norm(b.lastName));
      if (ln !== 0) return ln;
      return norm(a.firstName).localeCompare(norm(b.firstName));
    });

  const disabled = allRows
    .filter((r) => r.status !== "active")
    .sort((a, b) => {
      const ln = norm(a.lastName).localeCompare(norm(b.lastName));
      if (ln !== 0) return ln;
      return norm(a.firstName).localeCompare(norm(b.firstName));
    });

  const rows = showDisabled ? [...active, ...disabled] : active;

  const toggleHref = showDisabled ? "/admin/members" : "/admin/members?showDisabled=1";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Members</h1>

        <div className="flex items-center gap-3">
          <Link
            href={toggleHref}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            {showDisabled ? "Hide disabled" : "Show disabled"}
          </Link>

          <Link
            href="/admin/members/new"
            className="rounded-lg bg-black text-white px-4 py-2 hover:bg-gray-900"
          >
            New member
          </Link>
        </div>
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
                <Link
                  href={`/admin/members/${row.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
