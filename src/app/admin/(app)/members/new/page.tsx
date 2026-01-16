import Link from "next/link";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : "";

  const errorText =
    error === "missing"
      ? "Please fill in Fireground Number, First name, and Last name."
      : error === "mobile_invalid"
      ? "Mobile number format is invalid. Use an Australian mobile (04xxxxxxxx)."
      : error === "duplicate"
      ? "That Fireground Number or Mobile number is already in use."
      : error === "create_failed"
      ? "Create failed. Try again."
      : "";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New member</h1>
        <Link href="/admin/members" className="text-sm text-blue-600 hover:underline">
          Back
        </Link>
      </div>

      <div className="max-w-lg rounded-2xl bg-white p-6 shadow ring-1 ring-gray-200">
        {errorText && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 ring-1 ring-red-200">
            {errorText}
          </div>
        )}

        <form action="/admin/members/new/create" method="POST" className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Fireground Number</label>
            <input
              name="firegroundNumber"
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 ring-1 ring-gray-300"
              placeholder="e.g. 12345"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">First name</label>
              <input
                name="firstName"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2 ring-1 ring-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Last name</label>
              <input
                name="lastName"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2 ring-1 ring-gray-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Mobile (optional)</label>
            <input
              name="mobile"
              className="mt-1 w-full rounded-lg border px-3 py-2 ring-1 ring-gray-300"
              placeholder="e.g. 04xx xxx xxx"
            />
            <div className="mt-1 text-xs text-gray-500">Normalised to 04xxxxxxxx for lookup.</div>
          </div>

          <button className="w-full rounded-lg bg-black text-white py-2 hover:bg-gray-900">
            Create member
          </button>
        </form>
      </div>
    </div>
  );
}
