import { NextRequest, NextResponse } from 'next/server';
import { getLocalDb } from '@/lib/localDb';

const FALLBACK_COURTS = [
  { id: 'court-1', name: 'Indoor Court 1', type: 'indoor' },
  { id: 'court-2', name: 'Indoor Court 2', type: 'indoor' },
  { id: 'court-3', name: 'Outdoor Court 1', type: 'outdoor' },
  { id: 'court-4', name: 'Outdoor Court 2', type: 'outdoor' },
  { id: 'court-5', name: 'Basketball Court', type: 'indoor' },
  { id: 'court-6', name: 'Volleyball Court', type: 'indoor' },
];

export async function GET(_req: NextRequest) {
  const db = getLocalDb();
  if (db) {
    try {
      const rows = db.prepare('SELECT * FROM courts ORDER BY name').all();
      return NextResponse.json(rows);
    } catch {
      // fall through to fallback
    }
  }
  return NextResponse.json(FALLBACK_COURTS);
}
