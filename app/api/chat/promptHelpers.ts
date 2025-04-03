// promptHelpers.ts
import PROMPT_LIST from "./prompts";

export function RollbackOnValidationFailure(currentIndex: number): number {
  const fallbackIndex = PROMPT_LIST[currentIndex]?.fallbackIndex;
  if (fallbackIndex !== undefined) {
    const newIndex = Math.max(0, currentIndex - fallbackIndex);
    console.log(
      `[ROLLBACK DEBUG] Rolling back currentIndex from ${currentIndex} by ${fallbackIndex} to ${newIndex}`
    );
    return newIndex;
  }
  console.log(
    `[ROLLBACK DEBUG] No fallbackIndex property found for currentIndex ${currentIndex}. No rollback applied.`
  );
  return currentIndex;
}

export function getModelForCurrentPrompt(index: number): string {
  const prompt = PROMPT_LIST[index];
  console.log(`[MODEL DEBUG] Prompt at index ${index}:`, prompt);
  if (prompt && (prompt as any).model) {
    const customModel = (prompt as any).model;
    console.log(`[MODEL DEBUG] Custom model found at index ${index}: ${customModel}`);
    return customModel;
  }
  console.log(
    `[MODEL DEBUG] No custom model at index ${index}. Using default model: llama-3.3-70b-versatile`
  );
  return "llama-3.3-70b-versatile";
}
