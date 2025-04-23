// src/app/api/chat/openaiApiUtils.ts

// --- IMPORTS ---
// Import constants needed
import {
  ConversationEntry
} from './route'; // Assuming constants are exported from route.ts

// Import validation instructions if needed (only default is used below)
import {
  defaultValidationInstruction
} from './validationInstructions';

// --- TYPES (Define if not imported) ---
// Define the type for conversation history entries if not globally available/imported
type ConversationMessage = { role: string; content: string };

// --- Define and Export Constants Here ---
export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"; // Moved from route.ts
// export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini-2025-04-14";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-2024-07-18";
export const BUFFER_SIZE = 8; // Moved from route.ts

// --- FUNCTIONS ---

/**
* Validates user input against the current prompt using an LLM call.
* @param userInput The user's input string.
* @param currentPrompt The current system prompt text.
* @param customValidation Optional custom validation instruction template.
* @returns True if valid, false if invalid, or an error message string.
*/
export async function validateInput(
userInput: string,
currentPrompt: string,
customValidation?: string
): Promise<boolean | string> { // Return boolean for success/fail, string for errors
// Check for the API key in the server's environment
if (!process.env.OPENAI_API_KEY) {
  console.error("[ERROR] Missing OpenAI API key. Check your .env file.");
  return "API key is missing. Cannot validate input.";
}

// Prepare the instruction string
let finalInstruction: string;
if (customValidation) {
  console.log("[DEBUG] Using custom validation instruction.");
  finalInstruction = customValidation
    .replace("{CURRENT_PROMPT}", currentPrompt)
    .replace("{USER_INPUT}", userInput);
} else {
  console.log("[DEBUG] Using default validation instruction.");
  finalInstruction = defaultValidationInstruction
    .replace("{CURRENT_PROMPT}", currentPrompt)
    .replace("{USER_INPUT}", userInput);
}

console.log("[DEBUG] Final validation instruction:", finalInstruction);

// Build payload
const payload = {
  model: DEFAULT_OPENAI_MODEL,
  temperature: 0,
  messages: [{ role: "system", content: finalInstruction }],
};

try {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ERROR] Validation API call failed:", response.status, errorText);
    return "There was an issue validating your input. Please try again.";
  }

  const responseData = await response.json();
  const validationResult = responseData.choices?.[0]?.message?.content?.trim().toUpperCase() || "INVALID";
  console.log("[DEBUG] Validation Result:", validationResult);

  // Check for explicit VALID response
  return validationResult === "VALID";
} catch (error: any) {
  console.error("[ERROR] Failed to validate input:", error.message);
  return "An error occurred while validating input. Please try again.";
}
}

/**
* Generates a retry message when user input fails validation.
* @param userInput The invalid user input.
* @param currentPrompt The prompt the user was responding to (potentially after rollback).
* @param history The current conversation history (excluding system prompt).
* @returns A string containing the retry message.
*/
export async function generateRetryMessage(
userInput: string, // Keep this
currentPrompt: string, // Keep this
history: ConversationMessage[] // ADD history argument
): Promise<string> {
console.log("\n[DEBUG] Generating Retry Message for invalid input:", userInput);

if (!process.env.OPENAI_API_KEY) {
  console.error("[ERROR] Missing OpenAI API key.");
  return "API key is missing. Cannot generate retry message.";
}

// Build payload using the passed-in history
const payload = {
  model: DEFAULT_OPENAI_MODEL,
  temperature: 0, // Consider slightly higher temp for varied retries?
  messages: [
    { role: "system", content: currentPrompt },
    // Use the passed-in history argument, filtering system prompt just in case
    ...history.filter((entry) => entry.role !== "system"),
    // Maybe add the invalid user input back here? Depends on desired retry behavior.
    // { role: "user", content: userInput } // Optional: include the invalid input
  ],
};
console.log("[DEBUG] generateRetryMessage payload:", JSON.stringify(payload, null, 2));

try {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
     const errorText = await response.text();
     console.error("[ERROR] Retry API call failed:", response.status, errorText);
    return "I didn't quite get that. Can you try rephrasing your answer?"; // Fallback
  }

  const responseData = await response.json();
  const retryContent = responseData.choices?.[0]?.message?.content?.trim();

  if (!retryContent) {
    console.warn("[WARNING] No retry content returned. Using fallback message.");
    return "Hmm, I still didn't understand. Can you clarify?"; // Fallback
  }

  console.log("[DEBUG] Retry Message Generated:\n", retryContent);
  return retryContent;
} catch (error: any) {
  console.error("[ERROR] Failed to generate retry message:", error.message);
  return "Something went wrong generating the retry message. Please try again."; // Fallback
}
}

/**
* Makes a basic API call to the OpenAI endpoint.
* @param payload The request payload (model, messages, etc.).
* @returns The assistant's response content string, or an error message string, or null on severe error.
*/
export async function fetchApiResponse(payload: any): Promise<string | null> {
console.log(
  "\n[DEBUG] Basic fetchApiResponse call with payload (messages count: " + (payload?.messages?.length ?? 0) + ")"
  // Avoid logging full payload if messages are large
  // JSON.stringify(payload, null, 2)
);

if (!process.env.OPENAI_API_KEY) {
  console.warn("[WARNING] Missing OpenAI API key. Cannot make API call.");
  return "API key is missing. Please configure the server environment.";
}

try {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData: any = {};
    let errorText = await response.text(); // Get raw error text first
    try {
      errorData = JSON.parse(errorText); // Try to parse as JSON
    } catch (e) {
      console.error("[ERROR] Failed to parse error response as JSON:", errorText);
      errorData = { error: { message: errorText } }; // Use raw text if not JSON
    }
    console.error("[ERROR] fetchApiResponse call failed:", response.status, JSON.stringify(errorData, null, 2));

    if (errorData.error?.code === "rate_limit_exceeded") {
      return `Rate limit reached: ${errorData.error.message}`;
    }
    // Return a generic error message including the status if possible
    return `OpenAI API request failed (${response.status}): ${errorData.error?.message || 'Unknown error'}`;
  }

  const responseData = await response.json();
  const responseContent = responseData.choices?.[0]?.message?.content?.trim();

  // console.log("[DEBUG - API RESPONSE] Raw response data:", JSON.stringify(responseData, null, 2));
  console.log("[DEBUG - API RESPONSE] Parsed response content:", responseContent ? responseContent.substring(0,100)+"..." : "[EMPTY/NULL]");

  if (!responseContent) {
    console.warn("[WARNING] API response returned no content.");
    // Return null instead of an error string here, let retry handle it
    return null;
    // Original: return "I didn't get a response from the API. Please try again.";
  }

  return responseContent;
} catch (error: any) {
  console.error("[ERROR] in fetchApiResponse:", error.message);
  // Return null on network/fetch error, let retry handle it
  return null;
  // Original: return "An error occurred while fetching the response. Please try again.";
}
}

/**
* Calls fetchApiResponse with retry logic.
* @param payload The request payload.
* @param retries Number of retry attempts.
* @param delayMs Delay between retries in milliseconds.
* @returns The assistant's response content string, or an error message string if all retries fail.
*/
export async function fetchApiResponseWithRetry(
payload: { model?: string; messages: ConversationEntry[]; temperature?: number }, // Ensure model is optional here if sometimes omitted intentionally before default is applied
retries = 3,
delay = 500
): Promise<string | null> {
    // console.log("[DEBUG] fetchApiResponseWithRetry called with payload model:", payload.model); // Debug log
    const effectivePayload = {
        ...payload,
        // Apply default model *here* if it's missing in the payload
        model: payload.model || DEFAULT_OPENAI_MODEL,
    };
    // console.log("[DEBUG] Effective payload for API:", JSON.stringify(effectivePayload, null, 2)); // Debug log

if (!process.env.OPENAI_API_KEY) {
  console.warn("[WARNING] Missing OpenAI API key. Cannot attempt API call.");
  return "API key is missing. Please configure the server environment.";
}

let attempt = 0;
while (attempt <= retries) { // Use <= to allow initial attempt + retries
  attempt++;
  if (attempt > 1) {
      console.warn(`[WARN] Retrying API call. Attempt ${attempt}/${retries + 1}. Delaying ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
  } else {
      console.log(`[DEBUG] API Call Attempt: ${attempt}/${retries + 1}`);
  }

  const response = await fetchApiResponse(effectivePayload);

  // Check for immediate failure like missing key
  if (response === "API key is missing. Please configure the server environment.") {
      return response; // Don't retry if key is missing
  }

  // Check if we got valid content (not null, not an error message)
  if (response !== null && !response.startsWith("OpenAI API request failed") && !response.startsWith("Rate limit reached")) {
      return response; // Success!
  }

  // Log the failure if it wasn't a success
  console.warn(`[WARN] Attempt ${attempt} failed or returned null/error. Response: ${response}`);

} // End while loop

// If all retries failed
console.error(`[ERROR] API request failed after ${retries + 1} attempts.`);
return "The request failed after multiple attempts. Please try again later.";
}


/**
* Cleans the raw LLM response content by removing <think> tags and trimming whitespace.
* @param rawContent The raw string content from the LLM.
* @returns The cleaned string content, or an empty string if input is null/undefined.
*/
export function cleanLlmResponse(rawContent: string | null | undefined): string {
  if (!rawContent) {
      return "";
  }
  // Remove content within <think>...</think> tags and trim whitespace
  return rawContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}