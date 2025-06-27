export type PromptType = {
  prompt_text?: string; // Remains for LLM-based prompts, now optional
  directOutput?: string; // NEW: For non-LLM prompts, this is the exact text to output

  // Include ALL other existing fields from current definitions:
  validation?: boolean | string;
  important_memory?: boolean;
  autoTransitionHidden?: boolean;
  autoTransitionVisible?: boolean;
  chaining?: boolean;
  temperature?: number;
  buffer_memory?: number;
  wait_time?: number;
  addToDatabase?: boolean;
  model?: string;
  fallbackIndex?: number;
  saveUserInputAs?: string;
  saveAssistantOutputAs?: string;
  appendTextAfterResponse?: string;
  dbOptions?: {
    collectionName: string;
    documentId?: string;
    fields?: {
      result?: string;
      userresult?: string;
      [key: string]: string | undefined;
    };
    timestamp?: boolean;
  };
  // Add any other fields you find in existing PromptType definitions
}; 