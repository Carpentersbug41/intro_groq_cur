import { NextRequest, NextResponse } from 'next/server';
import { getSession, saveSession, destroySession, defaultSessionData } from '@/lib/session';
import { executeTurn } from './flows/runner';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Flow } from '@/app/api/chat/flows/types';
import { SessionStoreUnavailableError } from './errors';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

// A simple allow-list is safer than regex filtering.
const ALLOWED_FLOWS = ['opinion_mbp', 'opinion', 'ads_type1', 'discussion', 'opinion_conclusion', 'action_test'];

async function loadFlow(essayType: string, log: (msg: string) => void): Promise<Flow> {
    if (!ALLOWED_FLOWS.includes(essayType)) {
        log(`Disallowed flow type "${essayType}" requested. Falling back to default.`);
        essayType = 'opinion_mbp';
    }
    const flowPath = path.join(process.cwd(), `app/api/chat/flows/${essayType}.yaml`);
    try {
        const flowFile = await fs.readFile(flowPath, 'utf-8');
        return yaml.load(flowFile) as Flow;
    } catch (error) {
        log(`Failed to load flow for essayType: ${essayType}. Loading default.`);
        const defaultFlowPath = path.join(process.cwd(), `app/api/chat/flows/opinion_mbp.yaml`);
        const flowFile = await fs.readFile(defaultFlowPath, 'utf-8');
        return yaml.load(flowFile) as Flow;
    }
}

export async function POST(req: NextRequest) {
  const requestId = nanoid(8);
  const log = (message: string) => console.log(`[req:${requestId}] ${message}`);

  log('--- REQUEST START ---');
  try {
    const body = await req.json();
    const { message, essayType } = body;

    if (!message || typeof message !== 'string' || !essayType) {
      return NextResponse.json({ error: "Invalid request body. 'message' and 'essayType' are required." }, { status: 400 });
    }
    log(`Payload: essayType=${essayType}`);

    let sessionState = await getSession();
    log(`Session ${sessionState.sessionId} retrieved.`);

    const isNewFlowRequest = sessionState.namedMemory.essayType !== essayType;

    if (isNewFlowRequest) {
        log(`New flow. Resetting state.`);
        sessionState.currentStepId = defaultSessionData.currentStepId;
        sessionState.conversationHistory = [];
        sessionState.namedMemory = { essayType: essayType };
    }

    sessionState.conversationHistory.push({ role: 'user', content: message });
    log('Appended user message to history.');

    const flow = await loadFlow(essayType, log);
    log(`Flow loaded: ${flow.name}`);

    if (sessionState.currentStepId === null) {
        sessionState.currentStepId = flow.steps[0].id;
        log(`Flow was completed. Restarting at step: ${sessionState.currentStepId}`);
    }

    const { messagesForUser, finalState } = await executeTurn(flow, sessionState, requestId);
    log(`Turn executed. ${messagesForUser.length} new assistant messages.`);

    await saveSession(finalState);
    log('Session saved.');
    
    log('--- REQUEST END ---');
    return NextResponse.json({ messages: messagesForUser }, { status: 200 });

  } catch (error) {
    if (error instanceof SessionStoreUnavailableError) {
        log(`CRITICAL: SessionStoreUnavailableError - ${error.message}`);
        return NextResponse.json({ error: 'Service is temporarily unavailable. Please try again.' }, { status: 503 });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`CRITICAL: Unhandled Error - ${errorMessage}`);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
    await destroySession();
    console.log('[API /api/chat] - Session destroyed.');
    return NextResponse.json({ ok: true });
} 