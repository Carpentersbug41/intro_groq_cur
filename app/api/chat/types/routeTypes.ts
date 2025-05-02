import { SessionCookieData } from '@/lib/session'; // Keep dependency on session types
import { NamedMemory } from '../utils/memoryUtils'; // Corrected path: Go up one level, then into utils

// --- Interfaces used by both route.ts and nonStreamingFlow.ts ---
export type ConversationEntry = { role: string; content: string };
export type { NamedMemory };

export interface ChatRequestBody {
    messages: ConversationEntry[];
    stream?: boolean;
    essayType?: "opinion" | "ads_type1" | "discussion" | string;
}

export interface ConversationProcessingInput {
  messagesFromClient: ConversationEntry[];
  sessionData: SessionCookieData;
  essayType: "opinion" | "ads_type1" | "discussion" | string;
}

export interface HandlerResult {
    content: string | null;
    updatedSessionData: Partial<SessionCookieData> | null;
}

// You might move other shared types here later if needed 