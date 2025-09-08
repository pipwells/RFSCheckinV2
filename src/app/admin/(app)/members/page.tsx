// src/app/admin/(app)/members/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import MembersTable, { type MemberRow } from "./table";

export const dynamic = "force-dynamic";

export default async function MembersAdminPage() {
  const session = await getAdminSession();
  if (!session.user?.organisationId) {
    // layout will redirect too, but guard anyway
    return null;
  }
  const orgId = session.user.organisationId;

  const members = await prisma.member.findMany({
    where: { organisationId: orgId, isVisitor: false },
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, mobile: true, mobileNormalized: true, status: true, updatedAt: true },
    take: 1000,
  });

  // Format dates on the server to avoid hydration mismatches
  const fmt = new Intl.DateTimeFormat("en-AU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
    hour12: true,
  });

  const rows: MemberRow[] = members.map((m) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`,
    mobile: m.mobile ?? "",
    status: m.status,
    updatedLabel: fmt.format(m.updatedAt),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-gray-600">Add, edit, or disable members for your organisation.</p>
        </div>
        <Link
          href="/admin/members/new"
          className="rounded-lg px-4 py-2 bg-black text-white"
        >
          Add member
        </Link>
      </div>

      <MembersTable rows={rows} />
    </div>
  );
}
