/** True if [aStart, aEnd) overlaps [bStart, bEnd) */
function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart;
}

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const courtId = url.searchParams.get('courtId');

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  };

  try {
    if (env.DB) {
      let query = 'SELECT id, court_id, date, start_time, end_time, duration, status FROM bookings WHERE status = ?';
      const params: any[] = ['confirmed'];
      if (date)    { query += ' AND date = ?';     params.push(date); }
      if (courtId) { query += ' AND court_id = ?'; params.push(courtId); }
      query += ' ORDER BY start_time ASC';

      const { results } = await env.DB.prepare(query).bind(...params).all();
      return new Response(JSON.stringify(results), { headers });
    }
  } catch (error) {
    console.error('D1 GET error:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), { status: 500, headers });
  }

  return new Response(JSON.stringify([]), { headers });
}

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json() as any;
    const { courtId, playerName, playerPhone, date, startTime, endTime, duration } = body;

    if (!courtId || !playerName || !playerPhone || !date || !startTime || !endTime) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    const id        = `booking-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = Date.now();
    const dur       = typeof duration === 'number' ? duration : 90;

    if (env.DB) {
      // Conflict check
      const { results: conflicts } = await env.DB
        .prepare(
          `SELECT id FROM bookings
           WHERE court_id = ? AND date = ? AND status = 'confirmed'
             AND start_time < ? AND end_time > ?
           LIMIT 1`
        )
        .bind(courtId, date, endTime, startTime)
        .all();

      if (conflicts.length > 0) {
        return Response.json(
          { error: 'This slot was just taken by someone else. Please choose another time.' },
          { status: 409 }
        );
      }

      // Insert
      await env.DB
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

      return Response.json({ success: true, booking }, { status: 201 });
    }

    return Response.json({ error: 'Database not available' }, { status: 500 });
  } catch (error) {
    console.error('POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
