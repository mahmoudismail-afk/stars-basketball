import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

function getCloudflareDB(): any | null {
  try {
    const ctx = getRequestContext();
    if (ctx && ctx.env && (ctx.env as any).DB) return (ctx.env as any).DB;
  } catch { /* noop */ }
  
  try {
    if (typeof (globalThis as any).__env__?.DB !== 'undefined') {
      return (globalThis as any).__env__.DB;
    }
    if (typeof (globalThis as any).DB !== 'undefined') {
      return (globalThis as any).DB;
    }
  } catch { /* noop */ }
  return null;
}

// Simple authentication check
function isAuthenticated(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  
  const token = authHeader.split(' ')[1];
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  // If no password is set in env, deny access to be safe
  if (!adminPassword) return false;
  
  return token === adminPassword;
}

// ─── GET /api/admin ──────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getCloudflareDB();
  
  if (!db) {
    // In local dev, read from the shared in-memory array created by the public API
    const localBookings = (globalThis as any).localBookings || [];
    const results = [...localBookings]
      // Sort oldest date first, then earliest time (chronological)
      .sort((a: any, b: any) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return a.start_time < b.start_time ? -1 : 1;
      });
    return NextResponse.json(results);
  }

  try {
    // Fetch all bookings (including cancelled) ordered chronologically
    const { results } = await db
      .prepare(`SELECT * FROM bookings ORDER BY date ASC, start_time ASC`)
      .all();
      
    return NextResponse.json(results);
  } catch (error) {
    console.error('D1 GET Admin error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// ─── DELETE /api/admin?id=booking-xxx ─────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getCloudflareDB();
  if (!db) {
    const localBookings = (globalThis as any).localBookings || [];
    const idx = localBookings.findIndex((b: any) => b.id === id);
    if (idx !== -1) localBookings[idx].status = 'cancelled';
    return NextResponse.json({ success: true });
  }

  try {
    await db.prepare('UPDATE bookings SET status = ? WHERE id = ?').bind('cancelled', id).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('D1 DELETE Admin error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
