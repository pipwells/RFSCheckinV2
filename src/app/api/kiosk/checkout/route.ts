// src/app/api/kiosk/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireKiosk } from "@/lib/kioskAuth";

export const dynamic = "force-dynamic";

type CheckoutTaskInput = {
  categoryId: string;
};

type CheckoutBody = {
  sessionId: string;
  endTime?: string; // ISO
  minutes?: number; // optional (we will recompute if missing/invalid)
  tasks?: CheckoutTaskInput[];
};

type CategoryRow = {
  id: string;
  code: string;
  name: string;
};

function safeInt(n: unknown): number | null {
  if (typeof n !== "number") return null;
  if (!Number.isFinite(n)) return null;
  const v = Math.round(n);
  return v >= 0 ? v : null;
}

export async function POST(req: NextRequest) {
  const device = await requireKiosk(req);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });

  const end = body.endTime ? new Date(body.endTime) : new Date();
  if (Number.isNaN(end.getTime())) return NextResponse.json({ error: "invalid_endTime" }, { status: 400 });

  try {
    // Load session scoped to this kiosk (org + station)
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        organisationId: device.organisationId,
        stationId: device.stationId,
      },
      select: {
        id: true,
        status: true,
        startTime: true,
      },
    });

    if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (session.status !== "open") {
      return NextResponse.json({ status: "already_closed" }, { status: 200 });
    }

    // Compute duration in minutes (authoritative from DB startTime)
    const computed = Math.max(0, Math.round((end.getTime() - session.startTime.getTime()) / 60000));
    const provided = safeInt(body.minutes);
    const minutes = provided !== null ? Math.min(Math.max(provided, 0), computed + 5) : computed; // small tolerance

    const tasksIn = Array.isArray(body.tasks) ? body.tasks : [];
    const categoryIds = Array.from(
      new Set(tasksIn.map((t) => String(t.categoryId || "").trim()).filter(Boolean))
    );

    // Preload categories for snapshots (scoped to org)
    const cats: CategoryRow[] = categoryIds.length
      ? ((await prisma.category.findMany({
          where: { organisationId: device.organisationId, id: { in: categoryIds } },
          select: { id: true, code: true, name: true },
        })) as CategoryRow[])
      : [];

    const catMap = new Map<string, CategoryRow>(cats.map((c: CategoryRow) => [c.id, c]));

    // Allocate minutes across tasks (even split)
    const taskCount = categoryIds.length;
    const perTask = taskCount > 0 ? Math.max(0, Math.floor(minutes / taskCount)) : 0;
    const remainder = taskCount > 0 ? minutes - perTask * taskCount : 0;

    // Build transactional operations (no callback param => no implicit any)
    const ops: any[] = [];

    ops.push(
      prisma.session.update({
        where: { id: session.id },
        data: {
          endTime: end,
          rawCheckoutAt: end,
          duration: minutes,
          status: "closed",
          editLevel: "self",
        },
      })
    );

    if (taskCount > 0) {
      categoryIds.forEach((categoryId, idx) => {
        const c = catMap.get(categoryId);
        ops.push(
          prisma.sessionTask.create({
            data: {
              sessionId: session.id,
              categoryId,
              minutes: perTask + (idx < remainder ? 1 : 0),
              notes: null,
              categoryCodeSnapshot: c?.code ?? "",
              categoryNameSnapshot: c?.name ?? "",
            },
          })
        );
      });
    }

    await prisma.$transaction(ops);

    return NextResponse.json({ status: "checked_out", sessionId: session.id });
  } catch (err) {
    console.error("kiosk checkout error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
