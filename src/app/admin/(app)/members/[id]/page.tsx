// src/app/admin/(app)/members/[id]/page.tsx
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
      firegroundNumber: true,
    } as any,
  });

  if (!m) return notFound();

  const fullName = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim();
  const fireground = (m as any).firegroundNumber ?? "";
  const confirmPhrase = `${fullName} #${fireground}`.trim();

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit member</h1>
        <p className="text-gray-600">{fullName || "—"}</p>
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
            defaultValue={m.mobile ?? ""}
            className="border rounded-lg px-3 py-2 w-full"
            placeholder="04xxxxxxxx"
          />
          <p className="text-xs text-gray-500 mt-1">Can be shared with other members and visitors.</p>
        </div>

        <button className="rounded-lg px-4 py-2 bg-black text-white">Save changes</button>
      </form>

      {/* Enable/Disable controls */}
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
          <button name="status" value="disabled" className="rounded-lg px-4 py-2 border hover:bg-gray-50">
            Disable
          </button>
        ) : (
          <button name="status" value="active" className="rounded-lg px-4 py-2 border hover:bg-gray-50">
            Enable
          </button>
        )}
      </form>

      {/* Guarded delete */}
      <div id="delete" className="rounded-xl border p-4 bg-white space-y-3">
        <div>
          <div className="text-lg font-semibold text-red-700">Permanent delete</div>
          <div className="text-sm text-gray-600">
            Only available when the member is not active. This may fall back to a soft-delete if history exists.
          </div>
        </div>

        {m.status === "active" ? (
          <div className="text-sm text-gray-700">
            Disable this member first before permanent delete is permitted.
          </div>
        ) : (
          <form action={`/api/admin/members/${m.id}`} method="POST" className="space-y-3">
            <input type="hidden" name="_method" value="DELETE" />
            <input type="hidden" name="redirect" value="/admin/members" />

            <div className="text-sm text-gray-700">
              Type this to confirm:
              <div className="mt-1 font-mono text-xs bg-gray-50 border rounded-lg px-2 py-2">{confirmPhrase}</div>
            </div>

            <input
              name="confirm"
              className="border rounded-lg px-3 py-2 w-full"
              placeholder="Type the confirmation text exactly"
              required
            />

            <button className="rounded-lg px-4 py-2 bg-red-600 text-white hover:bg-red-700">
              Permanently delete member
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
