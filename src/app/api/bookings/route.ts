import { NextRequest, NextResponse } from 'next/server';
import { getLocalDb } from '@/lib/localDb';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const courtId = searchParams.get('courtId');

  const db = getLocalDb();
  if (db) {
    try {
      let query = "SELECT id, court_id, date, start_time, end_time, duration, status FROM bookings WHERE status = 'confirmed'";
      const params: string[] = [];
      if (date) { query += ' AND date = ?'; params.push(date); }
      if (courtId) { query += ' AND court_id = ?'; params.push(courtId); }
      query += ' ORDER BY start_time ASC';
      const rows = db.prepare(query).all(...params);
      return NextResponse.json(rows);
    } catch (err) {
      console.error('Bookings GET error:', err);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
  }

  return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courtId, playerName, playerPhone, date, startTime, endTime, duration } = body;

    if (!courtId || !playerName || !playerPhone || !date || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    const id = `booking-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = Date.now();
    const dur = typeof duration === 'number' ? duration : 90;

    const db = getLocalDb();
    if (db) {
      // Conflict check
      const conflict = db.prepare(
        "SELECT id FROM bookings WHERE court_id = ? AND date = ? AND status = 'confirmed' AND start_time < ? AND end_time > ? LIMIT 1"
      ).get(courtId, date, endTime, startTime);

      if (conflict) {
        return NextResponse.json(
          { error: 'This slot was just taken by someone else. Please choose another time.' },
          { status: 409 }
        );
      }

      db.prepare(
        'INSERT INTO bookings (id, court_id, player_name, player_phone, date, start_time, end_time, duration, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, courtId, playerName, playerPhone, date, startTime, endTime, dur, 'confirmed', createdAt);

      const booking = { id, court_id: courtId, player_name: playerName, player_phone: playerPhone, date, start_time: startTime, end_time: endTime, duration: dur, status: 'confirmed', created_at: createdAt };
      return NextResponse.json({ success: true, booking }, { status: 201 });
    }

    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  } catch (err) {
    console.error('Bookings POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
