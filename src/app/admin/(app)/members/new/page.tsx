// src/app/admin/(app)/members/new/page.tsx
import { redirect } from "next/navigation";

export default async function NewMemberPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">Add member</h1>
      <form action="/api/admin/members" method="POST" className="space-y-3 rounded-xl border p-4 bg-white">
        <div>
          <label className="block text-sm font-medium">First name</label>
          <input name="firstName" className="border rounded-lg px-3 py-2 w-full" required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium">Last name</label>
          <input name="lastName" className="border rounded-lg px-3 py-2 w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Mobile</label>
          <input name="mobile" className="border rounded-lg px-3 py-2 w-full" placeholder="04xxxxxxxx" required />
        </div>
        {/* If you add email to schema, uncomment:
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input name="email" className="border rounded-lg px-3 py-2 w-full" />
        </div>
        */}
        <button className="rounded-lg px-4 py-2 bg-black text-white">Create member</button>
      </form>
    </div>
  );
}
