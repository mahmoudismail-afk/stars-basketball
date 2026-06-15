import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// In-memory store for local Next.js dev (replaced by D1 on Cloudflare)
if (!(globalThis as any).localBookings) {
  (globalThis as any).localBookings = [];
}
if (!(globalThis as any).localLock) {
  (globalThis as any).localLock = false;
}
const getLocalBookings = () => (globalThis as any).localBookings;
const getLocalLock = () => (globalThis as any).localLock;
const setLocalLock = (v: boolean) => (globalThis as any).localLock = v;


function getCloudflareDB(): any | null {
  try {
    if (typeof (globalThis as any).DB !== 'undefined') {
      return (globalThis as any).DB;
    }
  } catch { /* noop */ }
  return null;
}

/** True if [aStart, aEnd) overlaps [bStart, bEnd) */
function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart;
}

// ─── GET /api/bookings?date=YYYY-MM-DD&courtId=court-1 ───────────────────────
// PUBLIC API: Only returns safe fields (no player names/phones)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date    = searchParams.get('date');
  const courtId = searchParams.get('courtId');

  const db = getCloudflareDB();

  if (!db) {
    let results = getLocalBookings().filter((b: any) => b.status === 'confirmed');
    if (date)    results = results.filter((b: any) => b.date     === date);
    if (courtId) results = results.filter((b: any) => b.court_id === courtId);
    
    // Strip PII
    results = results.map((b: any) => ({
      id: b.id, court_id: b.court_id, date: b.date, 
      start_time: b.start_time, end_time: b.end_time, duration: b.duration, status: b.status
    }));
    return NextResponse.json(results);
  }

  try {
    let query = 'SELECT id, court_id, date, start_time, end_time, duration, status FROM bookings WHERE status = ?';
    const params: any[] = ['confirmed'];
    if (date)    { query += ' AND date = ?';     params.push(date); }
    if (courtId) { query += ' AND court_id = ?'; params.push(courtId); }
    query += ' ORDER BY start_time ASC';

    const { results } = await db.prepare(query).bind(...params).all();
    return NextResponse.json(results);
  } catch (error) {
    console.error('D1 GET error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// ─── POST /api/bookings ───────────────────────────────────────────────────────
// First-come-first-served: performs a conflict check BEFORE inserting.
// If another booking already covers the requested window, returns 409.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as any;
    const { courtId, playerName, playerPhone, date, startTime, endTime, duration } = body;

    if (!courtId || !playerName || !playerPhone || !date || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    const id        = `booking-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = Date.now();
    const dur       = typeof duration === 'number' ? duration : 90;

    const db = getCloudflareDB();

    // ── Cloudflare D1 path ──────────────────────────────────────────────────
    if (db) {
      // Conflict check: any confirmed booking for same court+date that overlaps?
      // D1 SQLite: start_time < ? AND end_time > ?  →  [startTime, endTime) overlaps
      const { results: conflicts } = await db
        .prepare(
          `SELECT id FROM bookings
           WHERE court_id = ? AND date = ? AND status = 'confirmed'
             AND start_time < ? AND end_time > ?
           LIMIT 1`
        )
        .bind(courtId, date, endTime, startTime)
        .all();

      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: 'This slot was just taken by someone else. Please choose another time.' },
          { status: 409 }
        );
      }

      // No conflict — safe to insert
      await db
        .prepare(
          `INSERT INTO bookings
             (id, court_id, player_name, player_phone, date, start_time, end_time, duration, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, courtId, playerName, playerPhone, date, startTime, endTime, dur, 'confirmed', createdAt)
        .run();

      const booking = {
        id, court_id: courtId, player_name: playerName, player_phone: playerPhone,
        date, start_time: startTime, end_time: endTime, duration: dur,
        status: 'confirmed', created_at: createdAt,
      };

      return NextResponse.json({ success: true, booking }, { status: 201 });
    }

    // ── In-memory fallback (local dev) ─────────────────────────────────────
    // Simple spin-lock to prevent concurrent writes in local dev
    const maxWait = 500; // ms
    const start   = Date.now();
    while (getLocalLock()) {
      if (Date.now() - start > maxWait) {
        return NextResponse.json({ error: 'Server busy, please retry.' }, { status: 503 });
      }
      await new Promise(r => setTimeout(r, 10));
    }

    setLocalLock(true);
    try {
      // Conflict check in-memory
      const conflict = getLocalBookings().find((b: any) =>
        b.court_id === courtId &&
        b.date     === date &&
        b.status   === 'confirmed' &&
        timesOverlap(b.start_time, b.end_time, startTime, endTime)
      );

      if (conflict) {
        return NextResponse.json(
          { error: 'This slot was just taken by someone else. Please choose another time.' },
          { status: 409 }
        );
      }

      const booking = {
        id, court_id: courtId, player_name: playerName, player_phone: playerPhone,
        date, start_time: startTime, end_time: endTime, duration: dur,
        status: 'confirmed', created_at: createdAt,
      };

      getLocalBookings().push(booking);
      return NextResponse.json({ success: true, booking }, { status: 201 });
    } finally {
      setLocalLock(false);
    }

  } catch (error) {
    console.error('POST /api/bookings error:', error);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}

// ─── DELETE /api/bookings?id=booking-xxx ─────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getCloudflareDB();
  if (!db) {
    const idx = getLocalBookings().findIndex((b: any) => b.id === id);
    if (idx !== -1) getLocalBookings()[idx].status = 'cancelled';
    return NextResponse.json({ success: true });
  }

  await db.prepare('UPDATE bookings SET status = ? WHERE id = ?').bind('cancelled', id).run();
  return NextResponse.json({ success: true });
}
