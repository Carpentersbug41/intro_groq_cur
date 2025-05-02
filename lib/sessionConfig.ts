// D:\vercel\intro_groq m6\lib\sessionConfig.ts

import type { SessionOptions } from 'iron-session';

// Define the structure of your session data
export interface SessionData {
  currentIndex: number;
  conversationHistory?: { role: string; content: string }[];
  namedMemory: { [key: string]: string };
  currentBufferSize: number;
  promptIndexThatAskedLastQuestion?: number | null;
}

// Define session options
export const sessionOptions: SessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string, // MUST be set in .env! Needs to be >= 32 chars.
  cookieName: 'app-router-chat-session', // Choose a unique name
  // secure: true should be used in production (HTTPS)
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: undefined, // Session cookie (expires when browser closes) or set a duration (e.g., 60 * 60 * 24 for 1 day)
    httpOnly: true, // Recommended for security
    sameSite: 'lax', // Recommended for security
  },
};

// Ensure the password is set and secure enough
if (!process.env.SECRET_COOKIE_PASSWORD || process.env.SECRET_COOKIE_PASSWORD.length < 32) {
  console.error('FATAL: Missing or insecure SECRET_COOKIE_PASSWORD environment variable (must be >= 32 chars).');
  // Optionally throw an error to prevent startup in production
  // if (process.env.NODE_ENV === 'production') {
  //   throw new Error('Missing or insecure SECRET_COOKIE_PASSWORD environment variable.');
  // }
}