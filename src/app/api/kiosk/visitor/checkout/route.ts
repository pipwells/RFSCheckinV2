// src/app/api/kiosk/visitor/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireKiosk } from '@/lib/kioskAuth';

function isIsoString(s: unknown): s is string {
  return typeof s === 'string' && !Number.isNaN(Date.parse(s));
}

export async function POST(req: NextRequest) {
  try {
    // Ensure this request is coming from a valid kiosk device/session
    const device = await requireKiosk(req);

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || '').trim();
    const purpose = String(body?.purpose || '').trim();
    const startISO = body?.startTime;
    const endISO = body?.endTime;

    if (!sessionId) {
      return NextResponse.json({ error: 'missing_sessionId' }, { status: 400 });
    }
    if (!purpose) {
      return NextResponse.json({ error: 'missing_purpose' }, { status: 400 });
    }
    if (!isIsoString(startISO) || !isIsoString(endISO)) {
      return NextResponse.json({ error: 'invalid_times' }, { status: 400 });
    }

    const start = new Date(startISO);
    const end = new Date(endISO);
    const now = new Date();

    // Server-side rules (mirror the UI rules)
    if (start.getTime() > now.getTime()) {
      return NextResponse.json({ error: 'start_in_future' }, { status: 400 });
    }
    if (end.getTime() < start.getTime()) {
      return NextResponse.json({ error: 'end_before_start' }, { status: 400 });
    }
    if (end.getTime() > now.getTime() + 6 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'end_too_far_future' }, { status: 400 });
    }

    // Load the open session at this kiosk's station/org
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        organisationId: device.organisationId,
        stationId: device.stationId,
        status: 'open',
      },
      select: {
        id: true,
        member: { select: { isVisitor: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'session_not_found_or_closed' }, { status: 404 });
    }
    if (!session.member?.isVisitor) {
      // Safety check: this endpoint is only for visitor sessions
      return NextResponse.json({ error: 'not_a_visitor_session' }, { status: 400 });
    }

    // Update the session with edited times + purpose, and close it
    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        startTime: start,        // allow visitor start-time edits
        endTime: end,
        status: 'closed',
        visitorPurpose: purpose, // keep final purpose chosen/edited on checkout
        // If your schema has rawCheckoutAt, you can set it here:
        // rawCheckoutAt: now,
      },
      select: { id: true },
    });

    return NextResponse.json({ status: 'checked_out', sessionId: updated.id });
  } catch (err: any) {
    if (err instanceof Response) return err; // thrown by requireKiosk
    console.error('visitor checkout error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
