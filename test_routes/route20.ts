import PROMPT_LIST from "./prompts"; // Correct path
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const BUFFER_SIZE = 2;

let conversationHistory: { role: string; content: string }[] = [];
let currentIndex = 0;

// ---------------------------------------------------------------------------------
// Define validation instructions (only once)
// ---------------------------------------------------------------------------------
const defaultValidationInstruction = `
  You are a validation assistant.
  Your task is to assess if the user's inputs answers the question.

  if the user answers the question, it is VALID. If user doesn't answer the question, it is INVALID.
  Current prompt: '{CURRENT_PROMPT}'
  User input: '{USER_INPUT}'

  Respond with only one word: "VALID" if the user inputs answers appropriately,
  or "INVALID" if not.
  Do not provide any additional explanation or description.
`;

const customValidationInstructionForList = `
  You are a validation assistant.
  Your task is to assess if the user has answered 'red'. 
  As long as the user has answered 'red', it is VALID. 
  If not, it is INVALID.
  Current prompt: '{CURRENT_PROMPT}'
  User input: '{USER_INPUT}'

  Respond with only one word: "VALID" if the user has answered 'red',
  or "INVALID" if they have not.
  Do not provide any additional explanation or description.
`;

const PROMPT_LIST = [
  {
    prompt_text: `#System message:
Ask the user what their favorite color is.

NEVER GIVE LONG ANSWERS!`,
validation: customValidationInstructionForList,
  },

  {
    prompt_text: `#System message:
Ask the user what their favorite book is.`,
    autoTransitionVisible: true,
    validation: true,
  },

  {
    prompt_text: `#System message:
Ask the user what their favorite movie is.

NEVER GIVE LONG ANSWERS!

-Always ask about movies, not books.  Books are so lame right now`,
    autoTransitionVisible: true,
    validation: true,
  },

  {
    prompt_text: `#System message:
Ask the user what their favorite animal is.`,
    important_memory: true,
  },

  {
    prompt_text: `#System message:
Ask the user what their favorite country is.

NEVER GIVE LONG ANSWERS!`,
    autoTransitionVisible: true,
    validation: true,
  },

  {
    prompt_text: `#System message:
Ask the user what their favorite animal is.`,
    important_memory: true,
  },

  {
    prompt_text: `#System message:
Ask the user to input a number.
Step 1.  Ask the user 'Input a number?'
Step 2.  Never ask anything else only 'input a number?'
Step 3.  Only ask the user 'Input a number'.NEVER SAY ANYTHING ELSE!`,
    validation: true,
  },
  {
    prompt_text: `#System message:
Add 2 to the number you have.
#Additional rule: NEVER include the exact text '#System message:' anywhere in your assistant output.`,
    chaining: true,
  },
  {
    prompt_text: `#System message:
Multiply the number from the last result by 100 and output the result.`,
    chaining: true,
  },
  {
    prompt_text: `#System message:
Divide the number from the last result by 4 and output the result.`,
    chaining: true,
  },
  {
    prompt_text: `#System message:
Ask the user if this is correct.`,
    // chaining not set, so chain stops here.
  },
];

// ---------------------------------------------------------------------------------
// 1) MINIMAL VALIDATION CALL (MODIFIED TO ACCEPT A CUSTOM VALIDATION INSTRUCTION)
// ---------------------------------------------------------------------------------
async function validateInput(
  userInput: string,
  currentPrompt: string,
  customValidation?: string
) {
  let finalInstruction: string;
  if (customValidation) {
    finalInstruction = customValidation
      .replace("{CURRENT_PROMPT}", currentPrompt)
      .replace("{USER_INPUT}", userInput);
  } else {
    finalInstruction = defaultValidationInstruction
      .replace("{CURRENT_PROMPT}", currentPrompt)
      .replace("{USER_INPUT}", userInput);
  }

  console.log("\n[DEBUG] Validation Payload (Minimal):", { userInput, currentPrompt });

  const payload = {
    model: "llama-3.1-8b-instant",
    temperature: 0,
    messages: [{ role: "system", content: finalInstruction }],
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ERROR] Validation API call failed:\n", errorText);
    throw new Error(`Validation API error: ${response.statusText}`);
  }

  const responseData = await response.json();
  const validationResult = responseData.choices?.[0]?.message?.content?.trim() || "INVALID";
  console.log("[DEBUG] Validation Result:", validationResult);

  return validationResult === "VALID";
}

// ---------------------------------------------------------------------------------
// 2) RETRY MESSAGE GENERATOR IF INVALID (DO NOT MODIFY THIS SECTION)
// ---------------------------------------------------------------------------------
async function generateRetryMessage(
  userInput: string,
  currentPrompt: string
): Promise<string> {
  console.log("\n[DEBUG] Generating Retry Message for invalid input:", userInput);

  const payload = {
    model: "llama-3.1-8b-instant",
    temperature: 0,
    messages: [
      { role: "system", content: currentPrompt },
      ...conversationHistory.filter((entry) => entry.role !== "system"),
    ],
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ERROR] Retry API call failed:\n", errorText);
    throw new Error(`Retry API error: ${response.statusText}`);
  }

  const responseData = await response.json();
  const retryContent = responseData.choices?.[0]?.message?.content;

  if (!retryContent) {
    throw new Error("Invalid retry response: No content.");
  }

  console.log("[DEBUG] Retry Message Generated:\n", retryContent);
  return retryContent;
}

// ---------------------------------------------------------------------------------
// 3) BASIC FETCH TO THE API (UNTOUCHED)
// ---------------------------------------------------------------------------------
async function fetchApiResponse(payload: any): Promise<string | null> {
  console.log(
    "\n[DEBUG] Basic fetchApiResponse call with payload:\n",
    JSON.stringify(payload, null, 2)
  );
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ERROR] fetchApiResponse call failed:\n", errorText);
      return null;
    }

    const responseData = await response.json();
    return responseData.choices?.[0]?.message?.content || null;
  } catch (error: any) {
    console.error("[ERROR] in fetchApiResponse:\n", error.message);
    return null;
  }
}

// ---------------------------------------------------------------------------------
// Helper: Fetch API Response with Retry Logic
// ---------------------------------------------------------------------------------
async function fetchApiResponseWithRetry(
  payload: any,
  retries = 2,
  delayMs = 500
): Promise<string | null> {
  let attempt = 0;
  while (attempt < retries) {
    attempt++;
    console.log(`[DEBUG] Retry Attempt: ${attempt}/${retries}`);
    const response = await fetchApiResponse(payload);
    if (response) return response;

    console.warn(`[WARN] Attempt ${attempt} failed. Retrying in ${delayMs}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

// ---------------------------------------------------------------------------------
// 4) chainIfNeeded LOGIC (UPDATED TO UPDATE THE SYSTEM PROMPT)
// ---------------------------------------------------------------------------------
async function chainIfNeeded(assistantContent: string): Promise<string | null> {
  let chainResponse = assistantContent;

  while (
    currentIndex < PROMPT_LIST.length &&
    PROMPT_LIST[currentIndex]?.chaining
  ) {
    const nextPrompt = PROMPT_LIST[currentIndex].prompt_text;

    if (conversationHistory[0]?.content === nextPrompt) {
      console.log("[CHAIN DEBUG] Skipping duplicate chaining prompt:\n", nextPrompt);
      currentIndex++;
      continue;
    }

    conversationHistory = conversationHistory.filter(
      (entry) => entry.role !== "system"
    );
    conversationHistory.unshift({ role: "system", content: nextPrompt });
    console.log("[CHAIN DEBUG] Updated system message for chaining:\n", nextPrompt);

    // Append the last assistant output (the chainResponse) as a user message.
    conversationHistory.push({ role: "user", content: chainResponse });

    // Remove duplicates
    conversationHistory = conversationHistory.filter((entry, index, self) => {
      if (entry.role !== "assistant") return true;
      if (index < self.length - 1 && self[index + 1]?.role === "user") {
        return self[index + 1].content !== entry.content;
      }
      return true;
    });

    console.log(
      "[CHAIN DEBUG] conversationHistory AFTER removing duplicates:\n",
      JSON.stringify(conversationHistory, null, 2)
    );

    const tempHistory = [...conversationHistory];
    console.log(
      "[CHAIN DEBUG] Next chaining payload to LLM:\n",
      JSON.stringify(tempHistory, null, 2)
    );

    currentIndex++;

    const chainResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0,
        messages: tempHistory,
      }),
    });

    if (!chainResp.ok) {
      const errorText = await chainResp.text();
      console.error("[CHAIN DEBUG] Chaining request failed:\n", errorText);
      return chainResponse; // fallback
    }

    const chainData = await chainResp.json();
    const newContent = chainData.choices?.[0]?.message?.content;

    if (!newContent) {
      console.warn("[CHAIN DEBUG] No content returned from chain. Stopping chaining.");
      return chainResponse;
    }

    console.log("[CHAIN DEBUG] newAssistantContent from chain:", newContent);

    conversationHistory.push({ role: "assistant", content: newContent });
    chainResponse = newContent;
  }

  console.log("[CHAIN DEBUG] Next prompt is NOT chaining. Stopping chain here.");
  return chainResponse;
}

// ---------------------------------------------------------------------------------
// 5) Auto-TransitionHidden Helper Function (Encapsulated)
// ---------------------------------------------------------------------------------
async function handleAutoTransitionHidden(
  convHistory: { role: string; content: string }[],
  idx: number
): Promise<{
  conversationHistory: { role: string; content: string }[];
  response: string | null;
  updatedIndex: number;
}> {
  console.log("[AUTO-HIDDEN] Starting auto-transition hidden process...");

  convHistory.push({ role: "user", content: "OK" });
  console.log("[AUTO-HIDDEN] user 'OK' appended, but we won't show it to the user in final text.");

  idx++;
  const nextPrompt = PROMPT_LIST[idx]?.prompt_text || "No further prompts.";
  console.log("[AUTO-HIDDEN] Next prompt text:", nextPrompt);

  convHistory = [
    { role: "system", content: nextPrompt },
    ...convHistory.filter((e) => e.role !== "system"),
  ];

  const payload2 = {
    model: "llama-3.1-8b-instant",
    messages: convHistory,
  };

  const autoResponse = await fetchApiResponseWithRetry(payload2, 2, 500);

  if (!autoResponse) {
    console.warn("[AUTO-HIDDEN] second LLM call returned no content.");
    return { conversationHistory: convHistory, response: null, updatedIndex: idx };
  }

  convHistory.push({ role: "assistant", content: autoResponse });

  return { conversationHistory: convHistory, response: autoResponse, updatedIndex: idx };
}

// ---------------------------------------------------------------------------------
// 5b) Auto-TransitionVisible Helper Function (Encapsulated)
// ---------------------------------------------------------------------------------
async function handleAutoTransitionVisible(
  convHistory: { role: string; content: string }[],
  idx: number
): Promise<{
  conversationHistory: { role: string; content: string }[];
  response: string | null;
  updatedIndex: number;
}> {
  console.log("[AUTO-VISIBLE] Starting auto-transition visible process...");

  convHistory.push({ role: "user", content: "OK" });
  console.log("[AUTO-VISIBLE] user 'OK' appended (visible).");

  idx++;
  const nextPrompt = PROMPT_LIST[idx]?.prompt_text || "No further prompts.";
  console.log("[AUTO-VISIBLE] Next prompt text:", nextPrompt);

  convHistory = [
    { role: "system", content: nextPrompt },
    ...convHistory.filter((e) => e.role !== "system"),
  ];

  const payload2 = {
    model: "llama-3.1-8b-instant",
    messages: convHistory,
  };

  const autoResponse = await fetchApiResponseWithRetry(payload2, 2, 500);

  if (!autoResponse) {
    console.warn("[AUTO-VISIBLE] second LLM call returned no content.");
    return { conversationHistory: convHistory, response: null, updatedIndex: idx };
  }

  convHistory.push({ role: "assistant", content: autoResponse });

  return { conversationHistory: convHistory, response: autoResponse, updatedIndex: idx };
}

// ---------------------------------------------------------------------------------
// 6) MAIN POST HANDLER (WITH OPTIONAL VALIDATION CHECK + BUFFER MANAGEMENT + AUTO-TRANSITION)
// ---------------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userMessage = body.message?.trim();

    console.log("\n[INFO] Received User Input:", userMessage || "[No Input Provided]");
    if (!userMessage) {
      console.log("[WARN] No User Input Received. Returning Error.");
      return new Response("No input received. Please try again.", { status: 400 });
    }

    const currentPrompt = PROMPT_LIST[currentIndex]?.prompt_text;
    if (!currentPrompt) {
      const finalMessage = "Thank you for your responses! Goodbye.";
      conversationHistory.push({ role: "assistant", content: finalMessage });
      console.log("[INFO] Conversation Complete. Final Message Sent.");
      return new Response(finalMessage, { status: 200 });
    }

    // Figure out if the current prompt actually requires validation
    const promptValidation = PROMPT_LIST[currentIndex]?.validation;
    const promptValidationNeeded =
      (typeof promptValidation === "boolean" && promptValidation === true) ||
      (typeof promptValidation === "string");

    const isAutoTransitionHidden = PROMPT_LIST[currentIndex]?.autoTransitionHidden || false;
    const isAutoTransitionVisible = PROMPT_LIST[currentIndex]?.autoTransitionVisible || false;

    console.log("\n[DEBUG] Current Prompt:\n", currentPrompt);
    console.log("[DEBUG] Checking prompt validation property:", promptValidation);
    console.log("[DEBUG] Validation needed?", promptValidationNeeded);
    console.log("[DEBUG] AutoTransitionHidden Status:", isAutoTransitionHidden);
    console.log("[DEBUG] AutoTransitionVisible Status:", isAutoTransitionVisible);

    // 1) Insert the system prompt
    conversationHistory = [
      { role: "system", content: currentPrompt },
      ...conversationHistory.filter((entry) => entry.role !== "system"),
    ];
    console.log("[DEBUG] Updated Conversation History (System Prompt First):\n", JSON.stringify(conversationHistory, null, 2));

    // 2) Add user message
    conversationHistory.push({ role: "user", content: userMessage });
    console.log("[DEBUG] Adding User Input to Conversation History.");

    // 3) Manage buffer
    conversationHistory = manageBuffer(conversationHistory);

    // 4) If validation is needed, do it
    if (promptValidationNeeded) {
      console.log("[INFO] This prompt has validation: Checking user input now...");

      // If it's a string => custom instructions
      const customValidation =
        typeof promptValidation === "string" ? promptValidation : undefined;

      const isValid = await validateInput(userMessage, currentPrompt, customValidation);
      if (!isValid) {
        console.log("[INFO] Validation Failed. Retrying the Same Prompt.");
        const retryMsg = await generateRetryMessage(userMessage, currentPrompt);
        conversationHistory.push({ role: "assistant", content: retryMsg });
        conversationHistory = manageBuffer(conversationHistory);
        return new Response(retryMsg, { status: 200 });
      }
      console.log("[INFO] Validation Succeeded. Now incrementing currentIndex...");
      currentIndex++;
    } else {
      console.log("[INFO] No validation property found. Skipping validation. Incrementing currentIndex...");
      currentIndex++;
    }

    // 5) Overwrite system with the new prompt
    const newPrompt = PROMPT_LIST[currentIndex]?.prompt_text || "No further prompts.";
    console.log("[DEBUG] Next Prompt is now:", newPrompt);

    conversationHistory = [
      { role: "system", content: newPrompt },
      ...conversationHistory.filter((entry) => entry.role !== "system"),
    ];

    // 6) Build LLM payload
    const mainPayload = {
      model: "llama-3.1-8b-instant",
      temperature: 0,
      messages: conversationHistory,
    };
    console.log("[DEBUG] Main Payload to LLM:\n", JSON.stringify(mainPayload, null, 2));

    const mainResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(mainPayload),
    });
    if (!mainResp.ok) {
      const errorText = await mainResp.text();
      console.error("[ERROR] LLM call failed:\n", errorText);
      return new Response("I'm sorry, I couldn't process that. Please try again.", { status: 200 });
    }

    const mainData = await mainResp.json();
    const assistantContent1 = mainData.choices?.[0]?.message?.content;
    if (!assistantContent1) {
      return new Response("No content returned from the LLM. Please try again.", { status: 200 });
    }

    conversationHistory.push({ role: "assistant", content: assistantContent1 });
    console.log("[DEBUG] First API Response Added to Conversation History.");

    // 7) Manage buffer again
    conversationHistory = manageBuffer(conversationHistory);

    // 8) Possibly chain
    let finalChained: string | null = null;
    if (PROMPT_LIST[currentIndex]?.chaining) {
      finalChained = await chainIfNeeded(assistantContent1);
    }

    // 9) Auto-Transition Hidden
    if (PROMPT_LIST[currentIndex]?.autoTransitionHidden) {
      console.log("[DEBUG - AUTO-HIDDEN] autoTransitionHidden = true. Entering loop...");

      while (currentIndex < PROMPT_LIST.length && PROMPT_LIST[currentIndex]?.autoTransitionHidden) {
        console.log("[DEBUG - AUTO-HIDDEN] Next prompt also autoTransitionHidden, continuing...");
        const { conversationHistory: updatedConv, response: autoResponse, updatedIndex } =
          await handleAutoTransitionHidden(conversationHistory, currentIndex);

        conversationHistory = updatedConv;
        currentIndex = updatedIndex;

        if (!autoResponse) {
          return new Response(finalChained || assistantContent1, { status: 200 });
        }
      }
      return new Response(finalChained || assistantContent1, { status: 200 });
    }

    // 10) Auto-Transition Visible
    if (PROMPT_LIST[currentIndex]?.autoTransitionVisible) {
      console.log("[DEBUG - AUTO-VISIBLE] autoTransitionVisible = true. Entering loop...");

      let combinedVisible = finalChained || assistantContent1;

      while (currentIndex < PROMPT_LIST.length && PROMPT_LIST[currentIndex]?.autoTransitionVisible) {
        console.log("[DEBUG - AUTO-VISIBLE] Next prompt also autoTransitionVisible, continuing...");
        const { conversationHistory: updatedConv, response: autoResponse, updatedIndex } =
          await handleAutoTransitionVisible(conversationHistory, currentIndex);

        conversationHistory = updatedConv;
        currentIndex = updatedIndex;

        if (!autoResponse) {
          return new Response(combinedVisible, { status: 200 });
        }
        combinedVisible += "\n\n" + autoResponse;
      }
      return new Response(combinedVisible, { status: 200 });
    }

    // If no auto-transition, just return final
    return new Response(finalChained || assistantContent1, { status: 200 });
  } catch (error: any) {
    console.error("[ERROR] in POST handler:\n", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * ---------------------------------------------------------------------------------
 * DO NOT TOUCH: BUFFER MANAGEMENT SECTION
 * ---------------------------------------------------------------------------------
 */
function manageBuffer(conversationHistory: { role: string; content: string }[]) {
  console.log(`[DEBUG] Current Conversation History Length: ${conversationHistory.length}`);

  const systemMessage = conversationHistory.find((entry) => entry.role === "system");

  const importantMemoryLines = conversationHistory.filter(
    (entry) =>
      entry.role === "assistant" &&
      entry.content.trim().startsWith("Important_memory:")
  );

  const otherMessages = conversationHistory.filter(
    (entry) => entry !== systemMessage && !importantMemoryLines.includes(entry)
  );

  if (otherMessages.length > BUFFER_SIZE) {
    const excessCount = otherMessages.length - BUFFER_SIZE;
    console.log(`[DEBUG] Trimming ${excessCount} oldest non-system, non-important messages.`);

    const trimmed = otherMessages.slice(excessCount);

    const finalHistory = [systemMessage, ...importantMemoryLines, ...trimmed].filter(Boolean);

    console.log(
      "[DEBUG] Trimmed Conversation History (with Important Memory Kept):",
      JSON.stringify(finalHistory, null, 2)
    );
    return finalHistory;
  }
  return conversationHistory;
}
