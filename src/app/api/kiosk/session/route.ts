// src/app/api/kiosk/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireKiosk } from '@/lib/kioskAuth';

export async function GET(req: NextRequest) {
  try {
    const device = await requireKiosk(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

    const s = await prisma.session.findFirst({
      where: {
        id,
        organisationId: device.organisationId,
        stationId: device.stationId,
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        visitorPurpose: true,
        member: { select: { firstName: true, lastName: true, isVisitor: true } },
      },
    });
    if (!s) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    return NextResponse.json({ session: s });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
