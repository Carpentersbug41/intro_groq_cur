// app/api/chat/reset/route.ts

import { NextResponse } from 'next/server';
// 1. Import cookies from next/headers
import { cookies } from 'next/headers';
// Import the destroySession function (which now expects cookieStore)
import { destroySession } from '@/lib/session'; // Adjust path if needed

// Ensure dynamic rendering if manipulating cookies
export const dynamic = 'force-dynamic';

export async function POST() { // Assuming it's a POST request
  console.log("API Route: /api/chat/reset called.");
  try {
    // 2. Get the cookie store instance
    const cookieStore = cookies();

    // 3. Pass the cookieStore to destroySession
    await destroySession(cookieStore);

    console.log("Session successfully reset.");
    return NextResponse.json({ message: "Session reset successfully." }, { status: 200 });

  } catch (error: any) {
    console.error("[ERROR] in /api/chat/reset:", error);
    // Don't expose detailed errors to the client
    return NextResponse.json({ message: "Failed to reset session." }, { status: 500 });
  }
}

// You might also want a GET handler or other methods depending on your design
// export async function GET() {
//   console.log("API Route: /api/chat/reset GET called.");
//   try {
//     const cookieStore = cookies();
//     await destroySession(cookieStore);
//     console.log("Session successfully reset via GET.");
//     return NextResponse.json({ message: "Session reset successfully via GET." }, { status: 200 });
//   } catch (error: any) {
//     console.error("[ERROR] in /api/chat/reset GET:", error);
//     return NextResponse.json({ message: "Failed to reset session via GET." }, { status: 500 });
//   }
// }