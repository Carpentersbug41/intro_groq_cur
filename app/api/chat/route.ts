import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, saveSession, SessionState } from '@/lib/session';
import { executeTurn } from './flows/runner';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Flow } from '@/app/api/chat/flows/types';

export const dynamic = 'force-dynamic';

async function loadFlow(essayType: string): Promise<Flow> {
    // Basic security to prevent path traversal
    const safeEssayType = essayType.replace(/[^a-z0-9_]/gi, '');
    const flowPath = path.join(process.cwd(), `app/api/chat/flows/${safeEssayType}.yaml`);
    try {
        const flowFile = await fs.readFile(flowPath, 'utf-8');
        return yaml.load(flowFile) as Flow;
    } catch (error) {
        console.error(`Failed to load flow for essayType: ${safeEssayType}. Loading default.`);
        const defaultFlowPath = path.join(process.cwd(), `app/api/chat/flows/opinion_mbp.yaml`);
        const flowFile = await fs.readFile(defaultFlowPath, 'utf-8');
        return yaml.load(flowFile) as Flow;
    }
}

export async function POST(req: NextRequest) {
  console.log('[API /api/chat] - REQUEST RECEIVED');
  try {
    const body = await req.json();
    console.log('[API /api/chat] - Request body parsed:', body);
    const { messages, essayType } = body;

    if (!messages || !Array.isArray(messages)) {
      console.log('[API /api/chat] - Invalid messages array');
      return NextResponse.json({ message: "Invalid 'messages' array." }, { status: 400 });
    }
    console.log('[API /api/chat] - Messages and essayType extracted');

    let sessionState = await getSession();
    console.log('[API /api/chat] - Session retrieved');

    // CRITICAL LOGIC: Initialize flow for a new conversation
    if (messages.length === 1) { // A new chat starts with one user message
        const flow = await loadFlow(essayType);
        sessionState.currentStepId = flow.steps[0].id; // Start at the beginning
        sessionState.namedMemory = {}; // Reset memory
        sessionState.conversationHistory = []; // Reset history
        console.log(`[API /api/chat] - New session initiated for flow: ${essayType}. Starting at step: ${sessionState.currentStepId}`);
    }

    // Update history with the latest from the client for the current turn
    sessionState.conversationHistory = messages;
    console.log('[API /api/chat] - Conversation history updated');

    const flow = await loadFlow(essayType);
    console.log('[API /api/chat] - Flow loaded:', flow.name);

    const { messagesForUser, finalState } = await executeTurn(flow, sessionState);
    console.log('[API /api/chat] - Turn executed');

    await saveSession(finalState);
    console.log('[API /api/chat] - Session saved');

    const responseContent = messagesForUser.map(m => m.content).join('\n\n');
    console.log('[API /api/chat] - Sending response');
    return new NextResponse(responseContent, { status: 200 });
  } catch (error) {
    console.error('[API /api/chat] - CRITICAL ERROR:', error);
    return new NextResponse('An internal server error occurred.', { status: 500 });
  }
}

export async function DELETE(_req: NextRequest) {
  await destroySession();
  return NextResponse.json({ ok: true });
} 