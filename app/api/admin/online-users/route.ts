import { requireAdminSession } from '@/lib/admin-session';
import { listOnlineUserSessionsPage } from '@/lib/user-session';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const pageValue = Number(request.nextUrl.searchParams.get('page') ?? '1');
    const pageSizeValue = Number(request.nextUrl.searchParams.get('pageSize') ?? '10');
    const page = Number.isFinite(pageValue) ? Math.max(pageValue, 1) : 1;
    const pageSize = Number.isFinite(pageSizeValue) ? Math.min(Math.max(pageSizeValue, 1), 100) : 10;

    const result = await listOnlineUserSessionsPage({ page, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load online users.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
