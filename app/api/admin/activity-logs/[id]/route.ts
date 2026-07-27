import { requireAdminSession } from '@/lib/admin-session';
import { deleteUserActivityLog } from '@/lib/user-session';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdminSession(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { id } = await params;
    const deletedLog = await deleteUserActivityLog(id);

    if (!deletedLog) {
      return NextResponse.json({ error: 'Activity log not found.' }, { status: 404 });
    }

    return NextResponse.json({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete activity log.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
