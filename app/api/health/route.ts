import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure it's not cached

export async function GET() {
  console.log('HEALTH CHECK ENDPOINT HIT AT:', new Date().toISOString());
  return NextResponse.json({ status: "OK", timestamp: new Date().toISOString() });
} 