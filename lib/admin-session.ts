import { getActiveUserSession } from '@/lib/user-session';
import { NextRequest, NextResponse } from 'next/server';

export async function requireAdminSession(request: NextRequest) {
  const sessionId = request.headers.get('x-session-id');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing admin session.' }, { status: 401 });
  }

  const session = await getActiveUserSession(sessionId);
  if (!session || session.userType !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  return session;
}
