// src/app/admin/(app)/members/new/page.tsx
import { getAdminSession } from "@/lib/admin-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SP = {
  error?: string;
};

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await getAdminSession();
  if (!session.user) {
    redirect("/admin/login");
  }

  const { error } = await searchParams;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Add member</h1>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 ring-1 ring-red-200">
          {error === "missing" && "All fields are required."}
          {error === "fireground_invalid" &&
            "Fireground Number must be exactly 8 digits."}
          {error === "mobile_invalid" &&
            "Mobile number is not a valid Australian mobile."}
          {error === "duplicate" &&
            "A member with this Fireground Number or mobile already exists."}
          {error === "failed" && "Failed to create member."}
        </div>
      )}

      <form
        method="POST"
        action="/admin/members/new/create"
        className="space-y-4 bg-white p-6 rounded-xl ring-1 ring-gray-200"
      >
        <div>
          <label className="block text-sm font-medium">
            Fireground Number
          </label>
          <input
            name="firegroundNumber"
            required
            pattern="\d{8}"
            maxLength={8}
            inputMode="numeric"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="8 digit number"
          />
          <p className="text-xs text-gray-500 mt-1">
            Exactly 8 digits
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">First name</label>
          <input
            name="firstName"
            required
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Last name</label>
          <input
            name="lastName"
            required
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            Mobile number
          </label>
          <input
            name="mobile"
            required
            inputMode="tel"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="04xxxxxxxx"
          />
          <p className="text-xs text-gray-500 mt-1">
            Required. Australian mobile.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a
            href="/admin/members"
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="rounded-lg bg-black text-white px-4 py-2 text-sm hover:bg-gray-900"
          >
            Create member
          </button>
        </div>
      </form>
    </div>
  );
}
