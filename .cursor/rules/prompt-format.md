# Prompt Structure Rules (`prompt_text`)

This document defines the standard structure and conventions for writing the `prompt_text` property within each `PromptType` object in the `PROMPT_LIST` array (`prompts_*.ts` files or `promptFlowTemplate.ts`). Adhering to this structure ensures clarity, consistency, and reliable LLM behavior. The `Example Output` section is often the most critical part for guiding the LLM.

## 1. Purpose

The `prompt_text` provides specific instructions to the Language Model (LLM) for a single step in the conversation. A well-structured prompt clearly defines the LLM's role, task, constraints, and expected output format for that step.

## 2. Standard Sections (Order Matters)

Each `prompt_text` should ideally contain the following sections, formatted using Markdown as specified, in this order:

### 2.1. `# System message:` (Required)

-   **Format:** H1 Markdown heading (`# System message:`).
-   **Purpose:** Defines the LLM's persona, role, or core expertise *specifically for this task*. It sets the context for how the LLM should interpret the subsequent instructions.
-   **Content:** Should be concise and directly relevant to the prompt's goal (e.g., "You are an expert in...", "You are an AI trained to extract...").

### 2.2. `## Task Instructions:` (Required)

-   **Format:** H2 Markdown heading (`## Task Instructions:`).
-   **Purpose:** Clearly outlines the primary goal(s) and steps the LLM must perform.
-   **Content:**
    -   Use **numbered lists** (`1.`, `2.`, etc.) for sequential steps or distinct actions.
    -   Use clear, **actionable verbs** for instructing the LLM (e.g., "Output exactly...", "Identify...", "Extract...", "Compare...").
    -   Be specific and unambiguous.
    -   Use **bold (`**text**`)** or `ALL CAPS` (sparingly) for emphasis on critical instructions or keywords (e.g., `**ONLY**`, `**EXACTLY**`, `**NEVER** modify...`).
    -   **Clearly distinguish** between instructions *for the LLM's internal processing* and the *exact text the LLM should output to the end-user*. The latter should always be natural, context-appropriate, and maintain a suitable conversational tone.

### 2.3. `### Example Input:` (Optional, Context-Dependent)

-   **Format:** H3 Markdown heading (`### Example Input:`).
-   **Purpose:** Provides context when the LLM needs to process or analyze specific input text (e.g., analyzing a user's sentence, comparing two texts from memory).
-   **Content:** Show a realistic example of the input the LLM might encounter or need to work with for this specific task.

### 2.4. `### Example Output:` (Required)

-   **Format:** H3 Markdown heading (`### Example Output:`).
-   **Purpose:** **Crucial** for constraining the LLM's response format and content. Shows the *exact* desired output by example.
-   **Content:**
    -   Provide a **concrete, literal example** of the expected output string. This is often the most effective way to guide the LLM.
    -   If the task is complex or the LLM struggles with formatting, consider providing **multiple examples** (few-shot priming) to reinforce the desired structure.
    -   Use conceptual placeholders like `<User Input>` or `<Extracted Text>` within the example *only if* the structure requires them. When using such placeholders, ensure the `Task Instructions` clearly guide the LLM on how to obtain and insert the actual dynamic content (often from a `{memory_key}`). These placeholders in the `Example Output` show the *shape* of the output for the prompt designer's understanding.
    -   Match the formatting (bolding, line breaks, etc.) precisely.

### 2.5. `### Additional Rules:` (Required, if applicable)

-   **Format:** H3 Markdown heading (`### Additional Rules:`).
-   **Purpose:** Lists constraints, **negative constraints** (what *not* to do), and specific formatting requirements not covered elsewhere. Be explicit about unwanted behaviors, as this is key to controlling LLM output.
-   **Content:**
    -   Use **bullet points (`-`)** for individual rules.
    -   Include critical constraints like:
        -   "Do not add any extra text, explanations, or formatting."
        -   "The output must match exactly."
        -   "NEVER ask anything else!" (For prompts that shouldn't be conversational).
        -   "Preserve the exact phrasing and formatting."
        -   "Do not include commentary."
        -   "Do not offer opinions."
        -   "Do not apologize or use conversational filler."
    -   Reinforce key instructions using **bold (`**text**`)**.

## 3. Optional Sections

### 3.1. Horizontal Rule (`---`)

-   **Format:** Markdown horizontal rule (`---`).
-   **Purpose:** Can be used sparingly to visually separate major sections within very long or complex prompts, such as before a final reinforcement section.

### 3.2. Reinforcement / Final Checklist

-   **Format:** Can be plain text, bullet points, or use emojis (e.g., ✅). Often placed after `Additional Rules` or a `---`.
-   **Purpose:** In prompts requiring extreme precision (e.g., exact data retrieval from memory), this section re-emphasizes the most critical rules just before the LLM generates its response.

## 4. General Best Practices & Prompt Engineering Tips

-   **Clarity:** Use simple, direct language. Avoid jargon where possible.
-   **Specificity:** Leave no room for ambiguity in instructions or expected output.
-   **Conciseness:** Be as brief as possible while still being clear. Remove redundant instructions.
-   **Focus & Single Responsibility:** Each prompt should ideally focus on a **single, well-defined cognitive task**. If a step requires multiple distinct actions (e.g., extract data A, extract data B, compare A and B, then generate feedback), **break it down** into multiple, sequential `PromptType` objects in the `PROMPT_LIST`, often linked by `autoTransitionVisible: true`. *Flag prompts attempting multiple complex tasks for refactoring.* Simple sub-steps within a single cognitive task might be listed as numbered items in `Task Instructions` if they don't require separate LLM calls or memory states.
-   **Instruction Placement:** Place the most critical instructions early in the `Task Instructions`. Use `Additional Rules` and `Reinforcement` sections for constraints and final checks.
-   **Placeholders & Memory Keys:**
    -   For **template files** (like `promptFlowTemplate.ts`), use bracketed placeholders like `[Skill Name]`, `[Content Type]` to indicate text that needs customization in specific module files.
    -   For **dynamic data injection**, use curly braces around a descriptive key (e.g., `{user_input}`, `{original_question}`). This `{memory_key}` format is essential. The backend system (`injectNamedMemory`) replaces these placeholders with the corresponding values stored in the session's `namedMemory` object *before* the prompt is sent to the LLM. Ensure these `{memory_key}`s in the `prompt_text` precisely match the keys used in `saveAssistantOutputAs` or `saveUserInputAs` from previous `PromptType` objects, or keys pre-populated in memory.
-   **Audience Awareness:** The "System message" often sets the tone. Ensure the LLM's *output text intended for the user* (defined in instructions or examples) is appropriate for the end-user (natural, clear, not overly technical).
-   **`PromptType` Properties:** Remember that flow control (`autoTransitionVisible`, `validation`, `fallbackIndex`), state management (`saveUserInputAs`, `saveAssistantOutputAs`, `important_memory`, `buffer_memory`), and LLM parameters (`temperature`, `model`) are handled by properties *outside* the `prompt_text` string. The `prompt_text` focuses solely on the instructions *for the LLM* during its generation turn. For prompts requiring exact output or highly structured responses, ensure the corresponding `PromptType` object uses a low `temperature` (e.g., 0 or 0.1) to maximize predictability and determinism.
-   **Testing & Iteration:** Prompt engineering is iterative. **Always test** new or modified prompts thoroughly with varied inputs (including edge cases or potential errors) to ensure they produce the desired output reliably. Observe failures and refine the `prompt_text` or `PromptType` properties to improve robustness. No one writes perfect prompts on the first try.
-   **Suppressing Reasoning:** Ensure prompts guide the LLM to output only the final, desired result in the specified format, suppressing any intermediate reasoning or "thinking aloud" unless explicitly desired (which is rare in this application).

## 5. Complete Example Structure

```markdown
# System message:
[LLM Role/Persona for this specific task]

## Task Instructions:
1. [Step 1 - Clear, actionable instruction for LLM]
2. [Step 2 - Use **bold** for emphasis]
3. [Step 3 - Example instruction defining user-facing output: Ask the user "Your question here?"]

### Example Input: (If needed)
[Example of input text the LLM will process, potentially using {memory_key}]

### Example Output:
[Exact, literal example of the desired output string the LLM should produce. This is a key guide for the LLM.]
[Consider adding a second example if format is complex]

### Additional Rules:
- [Constraint 1, e.g., Output must match exactly.]
- [Negative Constraint 2, e.g., Do not add commentary or explanations.]
- [Constraint 3, e.g., **NEVER** ask follow-up questions.]

## 6 Always use \n\n when doing line breaks.  If you need a line break in the exxample do it like this:

## Example Output (If Incorrect Connecting Phrase & Missing Topic):
Initial Phrase (MBP2): Another reason why [✅] \\n\\n
Paraphrased Topic (MBP2): [Component Missing] [❌] \\n\\n
Connecting Phrase (MBP2): is that [❌] \\n\\n
Paraphrased Reason (MBP2): it offers greater flexibility. [✅] \\n\\n
❌ **MBP2 Topic Sentence Issues:** \\n\\n
**- Missing [Paraphrased Topic (MBP2)]:** Required by formula. You provided: *"[Component Missing]"*. Recommendation: Clearly state your main topic after "Another reason why". \\n\\n
**- Incorrect/Missing [Connecting Phrase (MBP2)]:** Required: "is because". You provided: *"is that"*. Recommendation: Use "is because" to connect your topic to your second reason. \\n\\n

## Example Output (If Correct):
Initial Phrase (MBP2): Another reason why [✅] \\n\\n
Paraphrased Topic (MBP2): virtual learning is beneficial [✅] \\n\\n
Connecting Phrase (MBP2): is because [✅] \\n\\n
Paraphrased Reason (MBP2): it offers greater flexibility. [✅] \\n\\n
✅ **MBP2 Topic Sentence:** Correct overall structure. \\n\\n

