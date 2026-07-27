import { requireAdminSession } from '@/lib/admin-session';
import { deleteMeetingRoom, updateMeetingRoom } from '@/lib/meeting-rooms';
import { NextRequest, NextResponse } from 'next/server';

type UpdateMeetingRoomPayload = {
  password?: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> },
) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const body = (await request.json()) as UpdateMeetingRoomPayload;
    const password = body.password?.trim();

    if (!password) {
      return NextResponse.json({ error: 'Meeting room password is required.' }, { status: 400 });
    }

    const { roomName } = await params;
    const room = await updateMeetingRoom({ roomName, password });
    if (!room) {
      return NextResponse.json({ error: 'Meeting room not found.' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update meeting room.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomName: string }> },
) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { roomName } = await params;
    const deletedRoom = await deleteMeetingRoom(roomName);
    if (!deletedRoom) {
      return NextResponse.json({ error: 'Meeting room not found.' }, { status: 404 });
    }

    return NextResponse.json({ roomName: deletedRoom.roomName });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete meeting room.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
