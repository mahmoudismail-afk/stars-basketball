import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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

// GET /api/courts
export async function GET() {
  try {
    const db = getCloudflareDB();

    if (!db) {
      return NextResponse.json([
        { id: 'court-1', name: 'Indoor Court 1', type: 'indoor' },
        { id: 'court-2', name: 'Indoor Court 2', type: 'indoor' },
        { id: 'court-3', name: 'Outdoor Court 1', type: 'outdoor' },
        { id: 'court-4', name: 'Outdoor Court 2', type: 'outdoor' },
        { id: 'court-5', name: 'Basketball Court', type: 'indoor' },
        { id: 'court-6', name: 'Volleyball Court', type: 'indoor' },
      ]);
    }

    const { results } = await db.prepare('SELECT * FROM courts ORDER BY name').all();
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([
      { id: 'court-1', name: 'Indoor Court 1', type: 'indoor' },
      { id: 'court-2', name: 'Indoor Court 2', type: 'indoor' },
      { id: 'court-3', name: 'Outdoor Court 1', type: 'outdoor' },
      { id: 'court-4', name: 'Outdoor Court 2', type: 'outdoor' },
      { id: 'court-5', name: 'Basketball Court', type: 'indoor' },
      { id: 'court-6', name: 'Volleyball Court', type: 'indoor' },
    ]);
  }
}
