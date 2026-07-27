import { requireAdminSession } from '@/lib/admin-session';
import { endUserSession } from '@/lib/user-session';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { sessionId } = await params;
    if (session.sessionId === sessionId) {
      return NextResponse.json({ error: 'Admin cannot end the current session.' }, { status: 400 });
    }

    const endedSession = await endUserSession({
      sessionId,
      reason: 'admin_terminated',
    });

    if (!endedSession) {
      return NextResponse.json({ error: 'Online session not found.' }, { status: 404 });
    }

    return NextResponse.json({ sessionId: endedSession.sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to end online session.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
