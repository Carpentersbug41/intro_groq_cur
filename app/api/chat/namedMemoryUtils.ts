/**
 * Inserts an important memory entry into the conversation history.
 * (Renamed from insertImportantMemory to avoid conflict.)
 *
 * @param conversationHistory - The conversation history array.
 * @param content - The content to be saved as important memory.
 */
export function insertImportantMemoryEntry(
    conversationHistory: { role: string; content: string }[],
    content: string
  ): void {
    const systemIndex = conversationHistory.findIndex(
      (msg) => msg.role === "system"
    );
    let insertIndex = systemIndex + 1;
  
    // Ensure important memory lines are stored in order
    while (
      insertIndex < conversationHistory.length &&
      conversationHistory[insertIndex].role === "assistant" &&
      conversationHistory[insertIndex].content.trim().startsWith("Important_memory:")
    ) {
      insertIndex++;
    }
  
    // Insert the important memory entry
    conversationHistory.splice(insertIndex, 0, {
      role: "assistant",
      content: `Important_memory: ${content}`,
    });
  
    console.log("[DEBUG] Important_memory entry inserted at index:", insertIndex);
  }
  
  /**
   * Injects named memory entries into a base prompt.
   *
   * @param basePrompt - The initial system prompt.
   * @param memoryKeys - An array of keys whose memory content should be injected.
   * @param memory - The memory object storing responses by key.
   * @returns The enriched prompt with the named memory injected.
   */
  export function injectNamedMemory(
    basePrompt: string,
    memoryKeys: string[],
    memory: Record<string, string>
  ): string {
    let enriched = basePrompt;
    for (const key of memoryKeys) {
      if (memory[key]) {
        enriched += `\n\n# ${key.toUpperCase()}:\n${memory[key]}`;
      }
    }
    return enriched;
  }
  