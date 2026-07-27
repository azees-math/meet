import { endUserSession } from '@/lib/user-session';
import { NextRequest, NextResponse } from 'next/server';

type EndSessionPayload = {
  sessionId?: string;
  reason?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EndSessionPayload;

    if (!body.sessionId) {
      return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
    }

    const session = await endUserSession({
      sessionId: body.sessionId,
      reason: body.reason,
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    return NextResponse.json({
      sessionId: session.sessionId,
      status: session.status,
      endedAt: session.endedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to end session.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
