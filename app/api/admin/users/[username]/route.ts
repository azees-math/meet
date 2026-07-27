import { requireAdminSession } from '@/lib/admin-session';
import { deleteMeetUser, normalizeUsername, updateMeetUser } from '@/lib/meet-users';
import { NextRequest, NextResponse } from 'next/server';

type UpdateUserPayload = {
  userType?: 'admin' | 'user';
  password?: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { username } = await params;
    const body = (await request.json()) as UpdateUserPayload;
    const payload: { userType?: 'admin' | 'user'; password?: string } = {};

    if (body.userType) {
      if (body.userType !== 'admin' && body.userType !== 'user') {
        return NextResponse.json({ error: 'Invalid user type.' }, { status: 400 });
      }
      payload.userType = body.userType;
    }

    if (body.password?.trim()) {
      payload.password = body.password.trim();
    }

    if (!payload.userType && !payload.password) {
      return NextResponse.json({ error: 'No changes submitted.' }, { status: 400 });
    }

    const updatedUser = await updateMeetUser({
      username,
      ...payload,
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { username } = await params;
    const normalizedUsername = normalizeUsername(username);

    if (normalizedUsername === session.username) {
      return NextResponse.json({ error: 'Admin cannot delete the current session user.' }, { status: 400 });
    }

    const deletedUser = await deleteMeetUser(username);
    if (!deletedUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ username: deletedUser.username });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
