import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// GET /api/courts
export async function GET() {
  try {
    // Use the global DB binding injected by Cloudflare / wrangler dev
    const db: D1Database = (globalThis as any).__env__?.DB || process.env.DB_BINDING;

    if (!db) {
      // Fallback: return hardcoded courts for local Next dev without wrangler
      return NextResponse.json([
        { id: 'court-1', name: 'Indoor Court 1', type: 'indoor' },
        { id: 'court-2', name: 'Indoor Court 2', type: 'indoor' },
        { id: 'court-3', name: 'Outdoor Court 1', type: 'outdoor' },
        { id: 'court-4', name: 'Outdoor Court 2', type: 'outdoor' },
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
    ]);
  }
}
