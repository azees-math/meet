import { ensureSampleMeetUsers, verifyMeetUser } from '@/lib/meet-users';
import { NextRequest, NextResponse } from 'next/server';

type LoginPayload = {
  username?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    await ensureSampleMeetUsers();

    const body = (await request.json()) as LoginPayload;
    const username = body.username?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!username) {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }

    const result = await verifyMeetUser(username, password);
    if (result.status === 'not-found') {
      return NextResponse.json(
        { error: 'User not found. New users can only be created by an admin.' },
        { status: 404 },
      );
    }

    if (result.status === 'invalid-password') {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    return NextResponse.json({
      username,
      userType: result.userType,
      status: result.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete login.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
