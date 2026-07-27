import { touchUserSession } from '@/lib/user-session';
import { NextRequest, NextResponse } from 'next/server';

type SessionHeartbeatPayload = {
  sessionId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SessionHeartbeatPayload;

    if (!body.sessionId) {
      return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
    }

    const session = await touchUserSession({
      sessionId: body.sessionId,
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    return NextResponse.json({
      sessionId: session.sessionId,
      status: session.status,
      lastSeenAt: session.lastSeenAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update session.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
