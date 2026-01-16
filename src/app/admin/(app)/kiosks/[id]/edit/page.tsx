import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-session";
import { redirect } from "next/navigation";
import { EditKioskForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function EditKioskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (!session.user?.organisationId) redirect("/admin/login");

  const { id } = await params;

  const kiosk = await prisma.device.findFirst({
    where: { id, organisationId: session.user.organisationId },
    select: { id: true, name: true },
  });

  if (!kiosk) redirect("/admin/kiosks");

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">Edit kiosk</h1>
      <EditKioskForm id={kiosk.id} initialName={kiosk.name} />
    </div>
  );
}
