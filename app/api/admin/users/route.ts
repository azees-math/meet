import { requireAdminSession } from '@/lib/admin-session';
import { createMeetUser, listMeetUsersPage, normalizeUsername } from '@/lib/meet-users';
import { NextRequest, NextResponse } from 'next/server';

type CreateUserPayload = {
  username?: string;
  password?: string;
  userType?: 'admin' | 'user';
};

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

    const result = await listMeetUsersPage({ page, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load users.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const body = (await request.json()) as CreateUserPayload;
    const username = normalizeUsername(body.username ?? '');
    const password = body.password?.trim() ?? '';
    const userType = body.userType;

    if (!username) {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }
    if (userType !== 'admin' && userType !== 'user') {
      return NextResponse.json({ error: 'User type is required.' }, { status: 400 });
    }

    const user = await createMeetUser({
      username,
      password,
      userType,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Unable to create user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
