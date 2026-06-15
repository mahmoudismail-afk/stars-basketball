// Simple authentication check
function isAuthenticated(request: Request, env: any) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  
  let password = '';
  
  if (authHeader.startsWith('Bearer ')) {
    password = authHeader.split(' ')[1];
  } else if (authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    password = credentials.split(':')[1];
  } else {
    return false;
  }
  
  // Fallback to 'stars' if no env var is set
  const expectedPassword = env && env.ADMIN_PASSWORD ? env.ADMIN_PASSWORD : 'stars';
    
  return password === expectedPassword;
}

export async function onRequestGet(context: any) {
  const { request, env } = context;

  // Check authentication
  if (!isAuthenticated(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    if (env.DB) {
      const { results } = await env.DB.prepare(
        'SELECT id, court_id, player_name, player_phone, date, start_time, end_time, duration, status, created_at FROM bookings ORDER BY date DESC, start_time DESC'
      ).all();
      return Response.json(results);
    }
  } catch (error) {
    console.error('Admin GET error:', error);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }

  return Response.json([]);
}

export async function onRequestDelete(context: any) {
  const { request, env } = context;

  if (!isAuthenticated(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }

    if (env.DB) {
      await env.DB.prepare('UPDATE bookings SET status = ? WHERE id = ?')
        .bind('cancelled', id)
        .run();
        
      return Response.json({ success: true, id, status: 'cancelled' });
    }
    
    return Response.json({ success: true, id, status: 'cancelled' });
  } catch (error) {
    console.error('Admin DELETE error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
