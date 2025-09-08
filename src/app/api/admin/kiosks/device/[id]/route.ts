import { NextRequest, NextResponse } from "next/server";

type Params = { id: string };

/**
 * GET /api/admin/kiosks/device/[id]
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { id } = await context.params;

  // ─── PASTE YOUR EXISTING GET LOGIC HERE ────────────────────────────────
  return NextResponse.json({ ok: true, id, method: "GET" });
}

/**
 * POST /api/admin/kiosks/device/[id]
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { id } = await context.params;

  // ─── PASTE YOUR EXISTING POST LOGIC HERE ───────────────────────────────
  return NextResponse.json({ ok: true, id, method: "POST" });
}

/**
 * PUT /api/admin/kiosks/device/[id]
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { id } = await context.params;

  // ─── PASTE YOUR EXISTING PUT LOGIC HERE ────────────────────────────────
  return NextResponse.json({ ok: true, id, method: "PUT" });
}

/**
 * DELETE /api/admin/kiosks/device/[id]
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { id } = await context.params;

  // ─── PASTE YOUR EXISTING DELETE LOGIC HERE ─────────────────────────────
  return NextResponse.json({ ok: true, id, method: "DELETE" });
}
