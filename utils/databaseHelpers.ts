// /utils/databaseHelpers.ts

import { storeDataInFirestore } from "./storeInFirestore"; 
import { PROMPT_LIST } from "../app/api/chat/prompts/prompts";

/**
 * handleDatabaseStorageIfNeeded
 *
 * @param promptIndex - The index of the current prompt in PROMPT_LIST
 * @param assistantText - The LLM's final response (existing behavior)
 * @param userInput - (NEW, optional) The user's raw input, if you want to store that too
 */
export async function handleDatabaseStorageIfNeeded(
  promptIndex: number,
  assistantText: string,
  userInput?: string
): Promise<void> {
  const prompt = PROMPT_LIST[promptIndex];
  if (!prompt || !prompt.addToDatabase) {
    console.log("[DB-DEBUG] Prompt does not have addToDatabase or is undefined. Skipping DB storage.");
    return;
  }

  const { dbOptions } = prompt;
  if (!dbOptions) {
    console.log("[DB-DEBUG] No dbOptions provided. Skipping DB storage.");
    return;
  }

  const {
    collectionName,
    documentId,
    fields = {},
    timestamp = false,
  } = dbOptions;

  if (!collectionName) {
    console.warn("[DB] No collectionName specified. Skipping DB storage.");
    return;
  }

  const data: Record<string, any> = {};

  console.log("[DB-DEBUG] userInput passed in:", userInput);
  console.log("[DB-DEBUG] fields object:", fields);

  // If we have userInput and a "userresult" field in dbOptions, store it.
  if (userInput && fields.userresult) {
    console.log(`[DB-DEBUG] Storing user input in field "${fields.userresult}":`, userInput);
    data[fields.userresult] = userInput;
  }

  // LLM response in "result" field.
  if (fields.result) {
    console.log(`[DB-DEBUG] Storing LLM response in field "${fields.result}":`, assistantText);
    data[fields.result] = assistantText;
  } else {
    console.log('[DB-DEBUG] No "result" field specified; defaulting to "result" key.');
    data["result"] = assistantText;
  }

  if (timestamp) {
    data.createdAt = new Date().toISOString();
  }

  console.log("[DB-DEBUG] Final data object to store:", JSON.stringify(data, null, 2));
  await storeDataInFirestore(collectionName, documentId, data);
}
