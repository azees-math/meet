import {
  ensureSampleMeetingRooms,
  issueMeetingRoomAccessToken,
  normalizeMeetingRoomName,
  verifyMeetingRoomPassword,
} from '@/lib/meeting-rooms';
import { NextRequest, NextResponse } from 'next/server';

type JoinMeetingRoomPayload = {
  roomName?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    await ensureSampleMeetingRooms();

    const body = (await request.json()) as JoinMeetingRoomPayload;
    const roomName = normalizeMeetingRoomName(body.roomName ?? '');
    const password = body.password?.trim() ?? '';

    if (!roomName) {
      return NextResponse.json({ error: 'Meeting ID is required.' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Meeting password is required.' }, { status: 400 });
    }

    const result = await verifyMeetingRoomPassword(roomName, password);
    if (result.status === 'not-found') {
      return NextResponse.json({ error: 'Meeting room not found.' }, { status: 404 });
    }

    if (result.status === 'invalid-password') {
      return NextResponse.json({ error: 'Invalid meeting password.' }, { status: 401 });
    }

    const access = await issueMeetingRoomAccessToken(result.roomName);
    return NextResponse.json(access);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to join meeting room.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
