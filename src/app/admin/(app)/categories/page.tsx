// src/app/admin/(app)/categories/page.tsx
import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type CategoryLite = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  children?: CategoryLite[];
};

type CategoryWithChildren = Prisma.CategoryGetPayload<{
  include: { children: true };
}>;

async function getData(orgId: string): Promise<CategoryLite[]> {
  const cats: CategoryWithChildren[] = await prisma.category.findMany({
    where: { organisationId: orgId, parentId: null },
    include: { children: true },
    orderBy: { code: "asc" },
  });

  return cats.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    active: c.active,
    children: c.children.map((ch) => ({
      id: ch.id,
      code: ch.code,
      name: ch.name,
      active: ch.active,
    })),
  }));
}

export default async function CategoriesAdminPage() {
  const session = await getAdminSession();
  const orgId = session.user?.organisationId;
  if (!orgId) redirect("/admin/login");

  const data = await getData(orgId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Categories</h1>

      {data.map((top) => (
        <div
          key={top.id}
          className="rounded-xl ring-1 ring-gray-200 bg-white p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="font-semibold">
              {top.code} — {top.name}{" "}
              {top.active ? "" : <span className="text-gray-500">(inactive)</span>}
            </div>
            <div className="flex gap-2">
              <button className="text-sm text-blue-600 hover:underline" type="button">
                Edit
              </button>
              <button className="text-sm text-red-600 hover:underline" type="button">
                Delete
              </button>
            </div>
          </div>

          <h3 className="font-semibold mb-2">Subcategories</h3>
          <div className="space-y-2">
            {(top.children ?? []).map((ch) => (
              <div
                key={ch.id}
                className="flex items-center justify-between rounded border px-3 py-2"
              >
                <div>
                  {ch.code} — {ch.name}{" "}
                  {ch.active ? "" : <span className="text-gray-500">(inactive)</span>}
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-blue-600 hover:underline" type="button">
                    Edit
                  </button>
                  <button className="text-sm text-red-600 hover:underline" type="button">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
