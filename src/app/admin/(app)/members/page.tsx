// src/app/admin/(app)/members/[id]/page.tsx
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({ params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session.user?.organisationId) redirect("/admin/login");
  const orgId = session.user.organisationId;

  const m = await prisma.member.findFirst({
    where: { id: params.id, organisationId: orgId, isVisitor: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mobile: true,
      status: true,
      firegroundNumber: true,
    },
  });
  if (!m) return notFound();

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit member</h1>
        <p className="text-gray-600">
          {m.firstName} {m.lastName}{" "}
          <span className="text-sm text-gray-500 ml-2">#{m.firegroundNumber || "—"}</span>
        </p>
      </div>

      {/* Save field changes */}
      <form
        action={`/api/admin/members/${m.id}`}
        method="POST"
        className="space-y-3 rounded-xl border p-4 bg-white"
      >
        <input type="hidden" name="_method" value="PATCH" />
        <input type="hidden" name="redirect" value={`/admin/members/${m.id}`} />

        <div>
          <label className="block text-sm font-medium">First name</label>
          <input
            name="firstName"
            defaultValue={m.firstName ?? ""}
            className="border rounded-lg px-3 py-2 w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Last name</label>
          <input
            name="lastName"
            defaultValue={m.lastName ?? ""}
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
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave blank to clear. Visitors can share a mobile with a member (separate records).
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <a href="/admin/members" className="rounded-lg border px-4 py-2 text-sm">
            Back
          </a>
          <button className="rounded-lg px-4 py-2 bg-black text-white">Save changes</button>
        </div>
      </form>

      {/* Enable/Disable controls */}
      <form
        action={`/api/admin/members/${m.id}`}
        method="POST"
        className="rounded-xl border p-4 bg-white flex items-center justify-between"
      >
        <input type="hidden" name="_method" value="PATCH" />
        <input type="hidden" name="redirect" value={`/admin/members/${m.id}`} />

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

      {/* Delete (anchored) */}
      <div id="delete" className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="font-semibold text-red-800">Delete member</div>
        <div className="text-sm text-red-700 mt-1">
          This permanently deletes the member record. Recommended: disable instead.
        </div>

        <form action={`/api/admin/members/${m.id}`} method="POST" className="mt-3">
          <input type="hidden" name="_method" value="DELETE" />
          <input type="hidden" name="redirect" value="/admin/members" />

          <button
            type="submit"
            className="rounded-lg px-4 py-2 bg-red-700 text-white hover:bg-red-800"
          >
            Confirm delete
          </button>
        </form>
      </div>
    </div>
  );
}
