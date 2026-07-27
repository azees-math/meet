import { getMeetUser, updateMeetUser, validateMeetUserProfile } from '@/lib/meet-users';
import { getActiveUserSession } from '@/lib/user-session';
import { NextRequest, NextResponse } from 'next/server';

type UpdateProfilePayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phoneno?: string;
};

async function requireActiveSession(request: NextRequest) {
  const sessionId = request.headers.get('x-session-id');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing active session.' }, { status: 401 });
  }

  const session = await getActiveUserSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Active session not found.' }, { status: 403 });
  }

  return session;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireActiveSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    if (session.authMethod !== 'password') {
      return NextResponse.json({ error: 'Google account profile is read-only here.' }, { status: 400 });
    }

    const user = await getMeetUser(session.username);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireActiveSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    if (session.authMethod !== 'password') {
      return NextResponse.json({ error: 'Google account profile is read-only here.' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateProfilePayload;
    const profileError = validateMeetUserProfile(body);
    if (profileError) {
      return NextResponse.json({ error: profileError }, { status: 400 });
    }
    const updatedUser = await updateMeetUser({
      username: session.username,
      first_name: body.first_name ?? '',
      last_name: body.last_name ?? '',
      email: body.email ?? '',
      phoneno: body.phoneno ?? '',
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
