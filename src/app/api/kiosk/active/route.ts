// src/app/api/kiosk/active/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireKiosk } from '@/lib/kioskAuth';

export async function GET(req: NextRequest) {
  try {
    const device = await requireKiosk(req);

    // Fetch all open sessions for this kiosk’s station
    const rows = await prisma.session.findMany({
      where: {
        organisationId: device.organisationId,
        stationId: device.stationId,
        status: 'open',
      },
      select: {
        id: true,
        startTime: true,
        member: {
          select: {
            firstName: true,
            lastName: true,
            isVisitor: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const active = rows.map((r) => ({
      sessionId: r.id,
      startTime: r.startTime.toISOString(),
      firstName: r.member?.firstName ?? null,
      lastName: r.member?.lastName ?? null,
      isVisitor: Boolean(r.member?.isVisitor),
    }));

    return NextResponse.json({ active });
  } catch (err) {
    if (err instanceof Response) return err; // thrown by requireKiosk
    console.error(err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
