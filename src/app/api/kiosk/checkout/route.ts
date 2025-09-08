// src/app/api/kiosk/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, startTime, endTime, tasks } = body as {
      sessionId: string;
      startTime?: string;
      endTime: string;
      tasks: { categoryId: string; minutes?: number; notes?: string }[];
    };

    // Basic validate
    if (!sessionId || !endTime || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, organisationId: true, startTime: true },
    });
    if (!session || session.status !== "open") {
      return NextResponse.json({ error: "not_open" }, { status: 400 });
    }

    // Optional edited start time
    const start = startTime ? new Date(startTime) : session.startTime;
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: "bad_time" }, { status: 400 });
    }

    // Fetch categories used, to snapshot code and name
    const catIds = [...new Set(tasks.map(t => t.categoryId))];
    const cats = await prisma.category.findMany({
      where: { id: { in: catIds } },
      select: { id: true, code: true, name: true, organisationId: true },
    });
    const catMap = new Map(cats.map(c => [c.id, c]));

    // Calculate minutes if not provided: split whole duration across tasks proportionally
    const totalMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    let perTaskMinutes = Math.floor(totalMinutes / tasks.length);
    let remainder = totalMinutes - perTaskMinutes * tasks.length;

    const taskCreates = tasks.map((t) => {
      const cat = catMap.get(t.categoryId);
      const minutes = typeof t.minutes === "number" && t.minutes > 0
        ? Math.round(t.minutes)
        : perTaskMinutes + (remainder-- > 0 ? 1 : 0);

      return {
        sessionId: session.id,
        categoryId: t.categoryId,
        minutes,
        notes: t.notes ?? null,
        categoryCodeSnapshot: cat?.code ?? "",   // snapshot!
        categoryNameSnapshot: cat?.name ?? "",   // snapshot!
      };
    });

    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: {
          startTime: start,
          endTime: end,
          status: "closed",
          rawCheckoutAt: new Date(),
          duration: totalMinutes,
          updatedAt: new Date(),
        },
      }),
      prisma.sessionTask.createMany({ data: taskCreates }),
    ]);

    return NextResponse.json({ status: "checked_out" });
  } catch (e) {
    console.error("kiosk checkout error", e);
    return NextResponse.json({ error: "server_error" }, { status: 200 });
  }
}
