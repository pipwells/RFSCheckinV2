import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({ params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session.user?.organisationId) return null;
  const orgId = session.user.organisationId;

  const m = await prisma.member.findFirst({
    where: { id: params.id, organisationId: orgId, isVisitor: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mobile: true,
      status: true,
    },
  });
  if (!m) return notFound();

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit member</h1>
        <p className="text-gray-600">
          {m.firstName} {m.lastName}
        </p>
      </div>

      {/* Save field changes */}
      <form
        action={`/api/admin/members/${m.id}`}
        method="POST"
        className="space-y-3 rounded-xl border p-4 bg-white"
      >
        <input type="hidden" name="_method" value="PATCH" />
        <input type="hidden" name="redirect" value="/admin/members" />

        <div>
          <label className="block text-sm font-medium">First name</label>
          <input
            name="firstName"
            defaultValue={m.firstName}
            className="border rounded-lg px-3 py-2 w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Last name</label>
          <input
            name="lastName"
            defaultValue={m.lastName}
            className="border rounded-lg px-3 py-2 w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Mobile</label>
          <input
            name="mobile"
            defaultValue={m.mobile || ""}
            className="border rounded-lg px-3 py-2 w-full"
            placeholder="04xxxxxxxx"
            required
          />
        </div>

        <button className="rounded-lg px-4 py-2 bg-black text-white">
          Save changes
        </button>
      </form>

      {/* Enable / Disable controls */}
      <form
        action={`/api/admin/members/${m.id}`}
        method="POST"
        className="rounded-xl border p-4 bg-white flex items-center justify-between"
      >
        <input type="hidden" name="_method" value="PATCH" />
        <input type="hidden" name="redirect" value="/admin/members" />

        <div>
          <div className="font-medium">Account status</div>
          <div className="text-sm text-gray-600">Current: {m.status}</div>
        </div>

        {m.status === "active" ? (
          <button
            name="status"
            value="disabled"
            className="rounded-lg px-4 py-2 border hover:bg-gray-50"
          >
            Disable
          </button>
        ) : (
          <button
            name="status"
            value="active"
            className="rounded-lg px-4 py-2 border hover:bg-gray-50"
          >
            Enable
          </button>
        )}
      </form>

      {/* Permanent delete intentionally removed.
          Archival / hard delete will be handled later with policy + safeguards. */}
    </div>
  );
}
