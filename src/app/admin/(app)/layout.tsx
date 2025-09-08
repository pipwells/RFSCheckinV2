// src/app/admin/(app)/layout.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AuthedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  const user = session.user;
  if (!user) redirect("/admin/login");

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="bg-gray-50 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="font-semibold">Check-in Admin</div>
          <div className="text-xs text-gray-500">v0.1</div>
        </div>
        <nav className="p-3 space-y-1">
          <Link href="/admin" className="block rounded px-3 py-2 hover:bg-gray-100">Dashboard</Link>
          <Link href="/admin/members" className="block rounded px-3 py-2 hover:bg-gray-100">Members</Link>
          <Link href="/admin/categories" className="block rounded px-3 py-2 hover:bg-gray-100">Categories</Link>
	  <Link href="/admin/kiosks" className="block rounded px-3 py-2 hover:bg-gray-100">Kiosks</Link>
        </nav>
        <div className="mt-auto p-4 text-xs text-gray-500">
          <div>Signed in</div>
          <form action="/api/auth/logout" method="POST" className="mt-2">
            <button className="rounded px-3 py-1 border hover:bg-gray-100">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
