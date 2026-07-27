import { createUserSession } from '@/lib/user-session';
import { NextRequest, NextResponse } from 'next/server';

type StartSessionPayload = {
  username?: string;
  userType?: 'admin' | 'user';
  authMethod?: 'google' | 'password';
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StartSessionPayload;

    if (!body.username || !body.userType || !body.authMethod) {
      return NextResponse.json({ error: 'username, userType, and authMethod are required.' }, { status: 400 });
    }

    const session = await createUserSession({
      username: body.username,
      userType: body.userType,
      authMethod: body.authMethod,
    });

    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start session.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
