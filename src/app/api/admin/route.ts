import { NextRequest, NextResponse } from 'next/server';
import { getLocalDb } from '@/lib/localDb';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'stars';

function isAuthenticated(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7) === ADMIN_PASSWORD;
  }
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    return decoded.split(':')[1] === ADMIN_PASSWORD;
  }
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getLocalDb();
  if (db) {
    try {
      const rows = db.prepare(
        'SELECT id, court_id, player_name, player_phone, date, start_time, end_time, duration, status, created_at FROM bookings ORDER BY date DESC, start_time DESC'
      ).all();
      return NextResponse.json(rows);
    } catch (err) {
      console.error('Admin GET error:', err);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
  }

  return NextResponse.json([]);
}

export async function DELETE(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const db = getLocalDb();
  if (db) {
    try {
      db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(id);
      return NextResponse.json({ success: true, id, status: 'cancelled' });
    } catch (err) {
      console.error('Admin DELETE error:', err);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, id, status: 'cancelled' });
}
