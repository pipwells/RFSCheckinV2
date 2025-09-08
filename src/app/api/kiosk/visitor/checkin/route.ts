// src/app/api/kiosk/visitor/checkin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireKiosk } from '@/lib/kioskAuth';
import { normalizeAUMobile } from '@/lib/phone';

export async function POST(req: NextRequest) {
  try {
    const device = await requireKiosk(req);
    const body = await req.json().catch(() => ({}));

    const firstName = String(body?.firstName || '').trim();
    const lastName  = String(body?.lastName  || '').trim();
    const mobileRaw = String(body?.mobile    || '').trim();
    const agency    = String(body?.agency    || '').trim();
    const purpose   = String(body?.purpose   || '').trim();

    if (!firstName || !lastName || !mobileRaw || !purpose) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const norm = normalizeAUMobile(mobileRaw);
    if (!norm) return NextResponse.json({ error: 'invalid_mobile' }, { status: 400 });

    // Block member mobiles
    const clash = await prisma.member.findFirst({
      where: { organisationId: device.organisationId, isVisitor: false, mobileNormalized: norm },
      select: { id: true },
    });
    if (clash) return NextResponse.json({ error: 'mobile_belongs_to_member' }, { status: 409 });

    // Always create a fresh visitor
    const visitor = await prisma.member.create({
      data: {
        organisationId: device.organisationId,
        isVisitor: true,
        firstName,
        lastName,
        mobile: mobileRaw,
        mobileNormalized: norm,
        status: 'active',
      },
      select: { id: true },
    });

    const now = new Date();
    const session = await prisma.session.create({
      data: {
        organisationId: device.organisationId,
        stationId: device.stationId,
        memberId: visitor.id,
        startTime: now,
        status: 'open',
        visitorAgency: agency || null,
        visitorPurpose: purpose,
        rawCheckinAt: now,
      },
      select: { id: true },
    });

    return NextResponse.json({ status: 'checked_in', sessionId: session.id });
  } catch (err: any) {
    if (err instanceof Response) return err; // from requireKiosk
    console.error('visitor checkin error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
