// D:\vercel\intro_groq m6\lib\session.ts
// AFTER (Relevant parts)

import { getIronSession, IronSession, SessionOptions } from 'iron-session';
// REMOVE direct import of cookies from 'next/headers'
// import { cookies } from 'next/headers';
// ADD import for the cookie store type
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

// Correct the import: Import SessionData and alias it
import { sessionOptions, SessionData as OriginalSessionCookieData } from './sessionConfig'; // Adjust path if needed

// --- Define the default buffer size constant HERE ---
const DEFAULT_BUFFER_SIZE = 12;

// --- Use the imported type directly --- 
// Remove the redundant interface definition:
// export interface SessionCookieData extends OriginalSessionCookieData {}

// --- Define the default values for the cookie data --- 
// Use the imported type for annotation and add missing optional property
export const defaultSessionCookieData: OriginalSessionCookieData = {
  currentIndex: 0,
  namedMemory: {}, // Default is an empty object
  currentBufferSize: DEFAULT_BUFFER_SIZE,
  conversationHistory: undefined, // Explicitly set optional property
  promptIndexThatAskedLastQuestion: null, // <-- ADDED: Default to null or -1 initially
};

// --- getSessionCookieData --- 
/**
 * Retrieves the session data from the request cookie using the provided cookie store.
 * Applies default values for any missing properties.
 * @param {ReadonlyRequestCookies} cookieStore - The cookie store instance from the request context.
 * @returns {Promise<OriginalSessionCookieData>} The session data. // <-- Use imported type
 */
// Add cookieStore parameter
export async function getSessionCookieData(cookieStore: ReadonlyRequestCookies): Promise<OriginalSessionCookieData> { // <-- Use imported type
  // Pass the cookieStore to getIronSession
  const session = await getIronSession<OriginalSessionCookieData>(cookieStore, sessionOptions); // <-- Use imported type

  // +++ LOGGING BEFORE DEFAULTS +++
  console.log(`>>> [getSessionCookieData] BEFORE defaults: session.currentIndex = ${session.currentIndex}, typeof session.namedMemory = ${typeof session.namedMemory}, Value = ${JSON.stringify(session.namedMemory)}, session.currentBufferSize = ${session.currentBufferSize}, session.conversationHistory = ${JSON.stringify(session.conversationHistory)}, session.promptIndexThatAskedLastQuestion = ${session.promptIndexThatAskedLastQuestion}`);

  // Apply default values robustly
  session.currentIndex = session.currentIndex ?? defaultSessionCookieData.currentIndex;

  // Explicitly check for null/undefined/non-object for namedMemory
  if (session.namedMemory === null || typeof session.namedMemory !== 'object' || Array.isArray(session.namedMemory)) {
      console.warn(`>>> [getSessionCookieData] session.namedMemory was invalid (${typeof session.namedMemory}). Resetting to default: {}`);
      session.namedMemory = { ...defaultSessionCookieData.namedMemory }; // Assign a new empty object
  } else {
       console.log(`>>> [getSessionCookieData] session.namedMemory was already a valid object.`);
  }

  session.currentBufferSize = session.currentBufferSize ?? DEFAULT_BUFFER_SIZE;
  // Apply default for conversationHistory if needed (though it's optional)
  session.conversationHistory = session.conversationHistory ?? defaultSessionCookieData.conversationHistory;

  // Apply default for promptIndexThatAskedLastQuestion if needed (though it's optional)
  session.promptIndexThatAskedLastQuestion = session.promptIndexThatAskedLastQuestion ?? defaultSessionCookieData.promptIndexThatAskedLastQuestion;

  // +++ LOGGING AFTER DEFAULTS +++
  console.log(`>>> [getSessionCookieData] AFTER defaults: session.currentIndex = ${session.currentIndex}, typeof session.namedMemory = ${typeof session.namedMemory}, Value = ${JSON.stringify(session.namedMemory)}, session.currentBufferSize = ${session.currentBufferSize}, session.conversationHistory = ${JSON.stringify(session.conversationHistory)}, session.promptIndexThatAskedLastQuestion = ${session.promptIndexThatAskedLastQuestion}`);

  // Return a plain object matching the type
  const returnData: OriginalSessionCookieData = {
      currentIndex: session.currentIndex,
      namedMemory: session.namedMemory,
      currentBufferSize: session.currentBufferSize,
      conversationHistory: session.conversationHistory,
      promptIndexThatAskedLastQuestion: session.promptIndexThatAskedLastQuestion,
  };

  // +++ LOGGING RETURN VALUE +++
  console.log(`>>> [getSessionCookieData] Returning: ${JSON.stringify(returnData)}`);

  return returnData;
}

// --- updateSessionCookieData --- 
/**
 * Updates specified properties in the session data and saves the session cookie
 * using the provided cookie store.
 * Only updates properties that are explicitly provided in the updateData object.
 * @param {ReadonlyRequestCookies} cookieStore - The cookie store instance from the request context.
 * @param {Partial<OriginalSessionCookieData>} updateData - An object containing the properties to update. // <-- Use imported type
 * @returns {Promise<void>}
 */
// Add cookieStore parameter
export async function updateSessionCookieData(
    cookieStore: ReadonlyRequestCookies, // Add parameter
    updateData: Partial<OriginalSessionCookieData> // <-- Use imported type
): Promise<void> {
    // Pass the cookieStore to getIronSession
    const session = await getIronSession<OriginalSessionCookieData>(cookieStore, sessionOptions); // <-- Use imported type

    // +++ LOGGING UPDATE DATA +++
    console.log(`>>> [updateSessionCookieData] Received updateData: ${JSON.stringify(updateData)}`);

    if (updateData.currentIndex !== undefined) {
        session.currentIndex = updateData.currentIndex;
    }
    // Ensure namedMemory is always an object when updating
    if (updateData.namedMemory !== undefined) {
        // Check if the provided value is a non-null, non-array object
        session.namedMemory = (typeof updateData.namedMemory === 'object' && updateData.namedMemory !== null && !Array.isArray(updateData.namedMemory))
                               ? updateData.namedMemory
                               : {}; // Default to {} if updateData provides non-object/null/array
         console.log(`>>> [updateSessionCookieData] Updated session.namedMemory to: ${JSON.stringify(session.namedMemory)}`);
    } else {
         console.log(`>>> [updateSessionCookieData] updateData did not include namedMemory.`);
         // Ensure namedMemory still exists on the session object if it wasn't updated
         // If it somehow became null/undefined/invalid before this save, reset it.
         if (session.namedMemory === null || typeof session.namedMemory !== 'object' || Array.isArray(session.namedMemory)) {
             console.warn(`>>> [updateSessionCookieData] session.namedMemory was invalid before save (and not updated). Resetting to {}.`);
             session.namedMemory = {};
         }
    }
    if (updateData.currentBufferSize !== undefined) {
        session.currentBufferSize = updateData.currentBufferSize;
    }
    // Handle updating optional conversationHistory
    if (updateData.conversationHistory !== undefined) {
        session.conversationHistory = updateData.conversationHistory;
    }

    // Apply default for promptIndexThatAskedLastQuestion if needed (though it's optional)
    if (updateData.promptIndexThatAskedLastQuestion !== undefined) {
        session.promptIndexThatAskedLastQuestion = updateData.promptIndexThatAskedLastQuestion;
    }

    // +++ LOGGING BEFORE SAVE +++
    console.log(`>>> [updateSessionCookieData] State BEFORE save: ${JSON.stringify({ currentIndex: session.currentIndex, namedMemory: session.namedMemory, currentBufferSize: session.currentBufferSize, conversationHistory: session.conversationHistory, promptIndexThatAskedLastQuestion: session.promptIndexThatAskedLastQuestion })}`);

    await session.save(); // session.save() uses the internal cookie store reference provided via getIronSession
    console.log("Session cookie data saved/updated via updateSessionCookieData.");
}

// --- destroySession --- 
/**
 * Destroys the current session using the provided cookie store.
 * @param {ReadonlyRequestCookies} cookieStore - The cookie store instance from the request context.
 * @returns {Promise<void>}
 */
// Add cookieStore parameter
export async function destroySession(cookieStore: ReadonlyRequestCookies): Promise<void> {
    // Pass the cookieStore to getIronSession
    const session = await getIronSession<OriginalSessionCookieData>(cookieStore, sessionOptions); // <-- Use imported type
    session.destroy();
    console.log("Session destroyed via destroySession.");
}

// --- Export the type again for easy import elsewhere --- 
// Export the imported type alias directly
export type { OriginalSessionCookieData as SessionCookieData }; // Re-export aliased SessionData as SessionCookieData

// --- Also export sessionOptions if needed by other parts, though often it's only used here ---
// export { sessionOptions };