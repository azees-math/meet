import { requireAdminSession } from '@/lib/admin-session';
import { listMeetingRoomAccessLogsPage } from '@/lib/meeting-rooms';
import { NextRequest, NextResponse } from 'next/server';

function escapeCsv(value: string | null | undefined) {
  const normalized = value ?? '';
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const roomName = request.nextUrl.searchParams.get('roomName') ?? undefined;
    const firstPage = await listMeetingRoomAccessLogsPage({
      page: 1,
      pageSize: 100,
      roomName,
    });

    let logs = [...firstPage.logs];
    for (let page = 2; page <= firstPage.totalPages; page += 1) {
      const nextPage = await listMeetingRoomAccessLogsPage({
        page,
        pageSize: 100,
        roomName,
      });
      logs = logs.concat(nextPage.logs);
    }

    const header = ['createdAt', 'roomName', 'accessType', 'participantName', 'userType', 'username'];
    const rows = logs.map((log) =>
      [
        log.createdAt,
        log.roomName,
        log.accessType,
        log.participantName,
        log.userType ?? '',
        log.username ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    );

    const csv = [header.join(','), ...rows].join('\n');
    const suffix = roomName ? `-${roomName}` : '';

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="meeting-room-access${suffix}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export meeting room access logs.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
