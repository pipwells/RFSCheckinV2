import { NextRequest, NextResponse } from "next/server";

type Params = { id: string };

/**
 * DELETE /api/admin/kiosks/device/[id]
 * Next.js 15 route handler signature: await context.params
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { id } = await context.params;

  // ─── PASTE YOUR EXISTING DELETE LOGIC BELOW ─────────────────────────────
  // Example:
  // await prisma.kioskDevice.delete({ where: { id } });
  // return NextResponse.json({ ok: true });
  // ────────────────────────────────────────────────────────────────────────

  // TEMP placeholder so the build passes; replace with your real logic.
  return NextResponse.json({ ok: true, id });
}
