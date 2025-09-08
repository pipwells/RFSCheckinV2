import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // In Next 15, dynamic APIs like cookies() should be awaited
    const cookieStore = await cookies();
    const kioskKey = cookieStore.get("kiosk_key")?.value ?? null;
    if (!kioskKey) return NextResponse.json({ categories: [] });

    const device = await prisma.device.findUnique({
      where: { kioskKey },
      select: { organisationId: true },
    });
    if (!device) return NextResponse.json({ categories: [] });

    // Pull top-level categories + children
    const cats = await prisma.category.findMany({
      where: { organisationId: device.organisationId, active: true, parentId: null },
      orderBy: [{ sort: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        children: {
          where: { active: true },
          orderBy: [{ sort: "asc" }, { name: "asc" }],
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Ensure at least one child (self default) if none exist
    const shaped = cats.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      children:
        c.children.length > 0
          ? c.children.map((ch) => ({ id: ch.id, name: ch.name, code: ch.code }))
          : [{ id: c.id, name: c.name, code: c.code }], // fallback
    }));

    return NextResponse.json({ categories: shaped });
  } catch (e) {
    console.error("kiosk categories error", e);
    return NextResponse.json({ categories: [] });
  }
}
