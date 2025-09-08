import { NextRequest, NextResponse } from "next/server";

type Params = { id: string };

/**
 * POST /api/admin/categories/[id]
 * Next.js 15: context.params is a Promise — await it before using.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { id } = await context.params;

  // ─── PASTE YOUR EXISTING POST LOGIC BELOW ───────────────────────────────
  // Example:
  // const body = await req.json();
  // const updated = await updateCategory(id, body);
  // return NextResponse.json(updated);
  // ────────────────────────────────────────────────────────────────────────

  // TEMP placeholder: remove once your logic is pasted back in.
  return NextResponse.json({ ok: true, id, method: "POST" });
}

/**
 * GET /api/admin/categories/[id]
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { id } = await context.params;

  // ─── PASTE YOUR EXISTING GET LOGIC BELOW ────────────────────────────────
  // const category = await getCategoryById(id);
  // return NextResponse.json(category);
  // ────────────────────────────────────────────────────────────────────────

  return NextResponse.json({ ok: true, id, method: "GET" });
}

/**
 * PUT /api/admin/categories/[id]
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { id } = await context.params;

  // ─── PASTE YOUR EXISTING PUT LOGIC BELOW ────────────────────────────────
  // const body = await req.json();
  // const updated = await replaceCategory(id, body);
  // return NextResponse.json(updated);
  // ────────────────────────────────────────────────────────────────────────

  return NextResponse.json({ ok: true, id, method: "PUT" });
}

/**
 * DELETE /api/admin/categories/[id]
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  const { id } = await context.params;

  // ─── PASTE YOUR EXISTING DELETE LOGIC BELOW ─────────────────────────────
  // await deleteCategory(id);
  // return NextResponse.json({ ok: true });
  // ────────────────────────────────────────────────────────────────────────

  return NextResponse.json({ ok: true, id, method: "DELETE" });
}
