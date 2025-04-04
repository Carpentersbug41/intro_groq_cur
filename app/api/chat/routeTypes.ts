import { SessionCookieData } from '@/lib/session'; // Keep dependency on session types
import { NamedMemory } from './memoryUtils'; // Keep dependency on memory types

// --- Interfaces used by both route.ts and nonStreamingFlow.ts ---
export type ConversationEntry = { role: string; content: string };

export interface ChatRequestBody {
    messages: ConversationEntry[];
    stream?: boolean;
}

export interface ConversationProcessingInput {
  messagesFromClient: ConversationEntry[];
  sessionData: SessionCookieData;
}

export interface HandlerResult {
    content: string | null;
    updatedSessionData: Partial<SessionCookieData> | null;
}

// You might move other shared types here later if needed 