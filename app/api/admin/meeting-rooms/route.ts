import { requireAdminSession } from '@/lib/admin-session';
import {
  createMeetingRoom,
  deleteMeetingRoom,
  ensureSampleMeetingRooms,
  listMeetingRoomsPage,
  MeetingType,
  normalizeMeetingRoomName,
  updateMeetingRoom,
} from '@/lib/meeting-rooms';
import { NextRequest, NextResponse } from 'next/server';

type CreateMeetingRoomPayload = {
  roomName?: string;
  password?: string;
  meetType?: MeetingType;
};

type UpdateMeetingRoomPayload = {
  roomName?: string;
  password?: string;
  meetType?: MeetingType;
};

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    await ensureSampleMeetingRooms();

    const pageValue = Number(request.nextUrl.searchParams.get('page') ?? '1');
    const pageSizeValue = Number(request.nextUrl.searchParams.get('pageSize') ?? '10');
    const page = Number.isFinite(pageValue) ? Math.max(pageValue, 1) : 1;
    const pageSize = Number.isFinite(pageSizeValue) ? Math.min(Math.max(pageSizeValue, 1), 100) : 10;

    const result = await listMeetingRoomsPage({ page, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load meeting rooms.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const body = (await request.json()) as CreateMeetingRoomPayload;
    const roomName = normalizeMeetingRoomName(body.roomName ?? '');
    const password = body.password?.trim() ?? '';
    const meetType = body.meetType;

    if (!roomName) {
      return NextResponse.json({ error: 'Meeting room name is required.' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Meeting room password is required.' }, { status: 400 });
    }
    if (meetType !== 'public' && meetType !== 'private') {
      return NextResponse.json({ error: 'Meeting type is required.' }, { status: 400 });
    }

    const room = await createMeetingRoom({ roomName, password, meetType });
    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return NextResponse.json({ error: 'Meeting room already exists.' }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : 'Unable to create meeting room.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const body = (await request.json()) as UpdateMeetingRoomPayload;
    const roomName = normalizeMeetingRoomName(body.roomName ?? '');
    const password = body.password?.trim();
    const meetType = body.meetType;

    if (!roomName) {
      return NextResponse.json({ error: 'Meeting room name is required.' }, { status: 400 });
    }

    if (!password && meetType !== 'public' && meetType !== 'private') {
      return NextResponse.json({ error: 'No changes submitted.' }, { status: 400 });
    }

    const room = await updateMeetingRoom({ roomName, password, meetType });
    if (!room) {
      return NextResponse.json({ error: 'Meeting room not found.' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update meeting room.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const body = (await request.json()) as Pick<UpdateMeetingRoomPayload, 'roomName'>;
    const roomName = normalizeMeetingRoomName(body.roomName ?? '');

    if (!roomName) {
      return NextResponse.json({ error: 'Meeting room name is required.' }, { status: 400 });
    }

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
