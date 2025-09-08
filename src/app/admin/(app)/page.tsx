// src/app/admin/page.tsx
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [memberCount, sessionOpenCount, categoryCount] = await Promise.all([
    prisma.member.count({ where: { isVisitor: false } }),
    prisma.session.count({ where: { status: "open" } }),
    prisma.category.count(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Members" value={memberCount} />
        <Stat label="Open sessions" value={sessionOpenCount} />
        <Stat label="Categories" value={categoryCount} />
      </div>
      <div className="text-sm text-gray-600">
        Use the navigation to manage members and categories. Kiosk registration and
        visitor configurations will be added next.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-gray-500 text-sm">{label}</div>
      <div className="text-3xl font-semibold">{value}</div>
    </div>
  );
}
