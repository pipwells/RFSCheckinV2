// src/app/admin/(app)/categories/page.tsx
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getData(orgId: string) {
  const tops = await prisma.category.findMany({
    where: { organisationId: orgId, parentId: null },
    orderBy: { sort: "asc" },
    include: { children: { orderBy: { sort: "asc" } } },
  });
  return tops;
}

export default async function CategoriesAdminPage() {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId!;
  const data = await getData(orgId);

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <Link href="/admin" className="text-sm underline">Back to admin</Link>
      </div>

      <div className="rounded-xl ring-1 ring-gray-200 bg-white p-4">
        <h2 className="font-semibold mb-2">Add top-level category</h2>
        <form method="POST" action="/api/admin/categories" className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="parentId" value="" />
          <input name="name" placeholder="Name (e.g. Training)" required className="rounded border px-3 py-2 ring-1 ring-gray-300" />
          <input name="code" placeholder="Code (blank = auto 1..8)" className="rounded border px-3 py-2 ring-1 ring-gray-300" />
          <button className="rounded bg-black text-white px-4">Create</button>
        </form>
        <p className="text-xs text-gray-600 mt-2">Max 8 active top-level categories are shown on the kiosk.</p>
      </div>

      {data.map((top, idx) => (
        <div key={top.id} className="rounded-xl ring-1 ring-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{top.code} — {top.name} {top.active ? "" : <span className="text-gray-500">(inactive)</span>}</div>
            <div className="flex gap-2">
              <form method="POST" action={`/api/admin/categories/${top.id}?action=move&dir=up`}>
                <button className="px-3 py-1 rounded ring-1 ring-gray-300">↑</button>
              </form>
              <form method="POST" action={`/api/admin/categories/${top.id}?action=move&dir=down`}>
                <button className="px-3 py-1 rounded ring-1 ring-gray-300">↓</button>
              </form>
              <form method="POST" action={`/api/admin/categories/${top.id}?action=toggle`}>
                <button className="px-3 py-1 rounded ring-1 ring-gray-300">{top.active ? "Disable" : "Enable"}</button>
              </form>
            </div>
          </div>

          <details className="rounded-lg bg-gray-50 p-3">
            <summary className="cursor-pointer">Rename or change code</summary>
            <form method="POST" action={`/api/admin/categories/${top.id}?action=update`} className="mt-3 grid gap-3 md:grid-cols-5">
              <input name="name" defaultValue={top.name} className="rounded border px-3 py-2 ring-1 ring-gray-300" />
              <input name="code" defaultValue={top.code} className="rounded border px-3 py-2 ring-1 ring-gray-300" />
              <button className="rounded bg-black text-white px-4">Save</button>
            </form>
          </details>

          <div className="pt-1">
            <h3 className="font-semibold mb-2">Subcategories</h3>
            <div className="space-y-2">
              {top.children.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <div>{ch.code} — {ch.name} {ch.active ? "" : <span className="text-gray-500">(inactive)</span>}</div>
                  <div className="flex gap-2">
                    <form method="POST" action={`/api/admin/categories/${ch.id}?action=move&dir=up`}>
                      <button className="px-3 py-1 rounded ring-1 ring-gray-300">↑</button>
                    </form>
                    <form method="POST" action={`/api/admin/categories/${ch.id}?action=move&dir=down`}>
                      <button className="px-3 py-1 rounded ring-1 ring-gray-300">↓</button>
                    </form>
                    <form method="POST" action={`/api/admin/categories/${ch.id}?action=toggle`}>
                      <button className="px-3 py-1 rounded ring-1 ring-gray-300">{ch.active ? "Disable" : "Enable"}</button>
                    </form>
                    <details>
                      <summary className="cursor-pointer px-2">Edit</summary>
                      <form method="POST" action={`/api/admin/categories/${ch.id}?action=update`} className="mt-2 flex gap-2">
                        <input name="name" defaultValue={ch.name} className="rounded border px-2 py-1 ring-1 ring-gray-300" />
                        <input name="code" defaultValue={ch.code} className="rounded border px-2 py-1 ring-1 ring-gray-300" />
                        <button className="rounded bg-black text-white px-3">Save</button>
                      </form>
                    </details>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <form method="POST" action="/api/admin/categories" className="grid gap-3 md:grid-cols-4">
                <input type="hidden" name="parentId" value={top.id} />
                <input name="name" placeholder="New subcategory name" required className="rounded border px-3 py-2 ring-1 ring-gray-300" />
                <input name="code" placeholder={`Code (blank = auto ${top.code}A..${top.code}H)`} className="rounded border px-3 py-2 ring-1 ring-gray-300" />
                <button className="rounded bg-black text-white px-4">Add subcategory</button>
              </form>
              <p className="text-xs text-gray-600 mt-2">Max 8 active subcategories per top-level are shown.</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
