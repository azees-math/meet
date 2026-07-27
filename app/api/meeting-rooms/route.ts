import { ensureSampleMeetingRooms, listMeetingRooms } from '@/lib/meeting-rooms';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    await ensureSampleMeetingRooms();
    const publicOnly = request.nextUrl.searchParams.get('publicOnly') === 'true';
    const rooms = publicOnly
      ? (await listMeetingRooms()).filter((room) => room.meetType === 'public')
      : await listMeetingRooms();
    return NextResponse.json({ rooms });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load meeting rooms.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
