// Template for conversational flows

// Import necessary types or define them here
// For now, let's assume PromptType and custom validation instructions might be imported
// in the final implementation, but we'll define a basic PromptType here for clarity.
// You might need to adjust imports based on your final project structure.

// Placeholder for importing specific validation logic if needed in the template
// import { customValidationInstructionForQuestion } from "./validationInstructions";

type PromptType = {
  prompt_text: string;
  validation?: boolean | string; // Use boolean or a specific validation instruction string
  important_memory?: boolean;
  autoTransitionHidden?: boolean;
  autoTransitionVisible?: boolean;
  chaining?: boolean;
  temperature?: number;
  buffer_memory?: number;
  wait_time?: number;
  addToDatabase?: boolean;
  model?: string;
  fallbackIndex?: number; // Crucial for validation loops
  saveUserInputAs?: string;
  saveAssistantOutputAs?: string;
  // Potentially add more properties as needed for the template
};

// --- Master Conversation Flow Template ---

export const BASE_CONVERSATION_FLOW: PromptType[] = [

  // ==================================
  // Phase 1: Setup & Content Selection
  // ==================================

  // --- Step 1 (Index 0): Readiness Check ---
  {
    prompt_text: `# System message:
You are an expert in checking if the user is ready to begin.

## Task Instructions:
1. Output exactly the following text:
   "Are you ready to begin practicing [Skill Name]?"

2. Do not add any extra text, explanations, or formatting.
3. Wait for the user's response.

### Example Output:
Are you ready to begin practicing [Skill Name]?

### Additional Rules:
- The output must match exactly.
- Do not deviate or add any extra content.
- NEVER ask anything else!`,
    // Use a specific validation instruction (like customValidationInstructionForQuestion)
    // or a boolean 'true' if the default validation works for a simple Yes/No.
    // Using a placeholder string assuming you'll replace it or import the actual validator.
    validation: "[Standard Yes/No Validation Instruction]", // Placeholder - Replace in specific prompt files
    // If validation fails (user says "no" or something invalid),
    // fallback to index 0 to ask the readiness question again.
    fallbackIndex: 0,
  },

  // --- Step 2 (Index 1): Context Setting / Explanation ---
  {
    prompt_text: `# System message:
You are an expert in explaining tasks clearly and concisely.

## Task Instructions:
1. Output the following explanation exactly:
   "[Task Description - e.g., The next stage is focused on using an example to help you practice writing...] [Skill Name].

   You will be shown [Content Type - e.g., an example introduction / a sample question].

   Your task is to [User Action - e.g., write a conclusion / write an introduction / identify the main ideas]."

2. Do not add any extra text, explanations, or formatting beyond the text provided above.

### Example Output (Illustrative - Replace placeholders in specific files):
"The next stage is focused on using an example introduction to help you practice writing IELTS conclusions.

You will be shown an example introduction that includes both the essay question and the writer's opinion.

Your task is to write a conclusion that restates the writer's opinion using different words."

### Additional Rules:
- Use the exact phrasing provided after replacing placeholders.
- Do not include any additional instructions or commentary.
- The output must match exactly.
- Do not deviate or add any extra content.
- NEVER ask anything else!`,
    // This step provides information and moves on, so it should transition automatically.
    autoTransitionVisible: true,
  },

  // --- Step 3 (Index 2): Content Presentation / Generation ---
  {
    prompt_text: `# System message:
You are an AI language model trained to select ONE sample [Content Type - e.g., essay question / introduction] for the user to work with.

## Task Instructions:
1. Randomly select ONLY one sample [Content Type] from the list below and output it exactly as shown.
2. If the user later requests a different item, ensure a previously unseen one is chosen (review conversation history if necessary).

### Sample [Content Type] List:
(This section will be populated in the specific module file)
1. [Sample Item 1 text]
   - [Optional sub-point or instruction for item 1]
2. [Sample Item 2 text]
   - [Optional sub-point or instruction for item 2]
3. [...]

## Example Output (Illustrative - format depends on content type):
"[Example of a selected Sample Item 1 text, potentially including its sub-point]"

## Additional Rules:
- ONLY present the selected [Content Type] - nothing else!
- Do not include any additional commentary or text.
- Follow the exact formatting as provided in the list for the selected item.
- Ensure that if a new item is requested later, a previously provided item is not repeated.
- Select only ONE item.
- NEVER ask anything else!`,
    // Display the content and move to the next step (confirmation).
    autoTransitionVisible: true,
    // Consider saving the output temporarily if needed for the confirmation step, though often the next step just asks generically.
    // saveAssistantOutputAs: "[selected_content_temp]" // Optional
  },

  // --- Step 4 (Index 3): Content Confirmation ---
  {
    prompt_text: `# System message:
You are an expert in verifying user satisfaction with the generated [Content Type - e.g., question / conclusion topic].

## Task Instructions:
1. Output exactly the following text:
   "Do you want to continue with this [Content Type], or would you like another one?"

2. Do not add any extra text, explanations, or formatting.
3. Wait for the user's response.

### Example Output:
Do you want to continue with this [Content Type], or would you like another one?

### Additional Rules:
- Do not include any additional commentary or text.
- Follow the exact formatting as provided in the list.
- The output must match exactly.
- Do not deviate or add any extra content.
- NEVER ask anything else!`,
    // Use validation to understand Yes (continue) vs No (get another).
    validation: "[Standard Yes/No/Another Validation Instruction]", // Placeholder
    // If validation fails or user wants another, go back to the Content Presentation step (index 2).
    fallbackIndex: 2, // *** Points back to the previous step ***
  },

  // ==================================
  // Phase 2: User Action & Initial Processing
  // ==================================

  // --- Step 5 (Index 4): Request User Input ---
  {
    prompt_text: `# System message:
You are an expert in collecting [Skill Name] from users based on provided context.

## Task Instructions:
1. **Ask the user exactly this question:**
   - "Please write an IELTS [Skill Name] for this [Context Type - e.g., essay title / introduction]."

2. **Do not add or modify any text.**
   - Only output the exact question above.

3. **Consider any relevant text input from the user as VALID for this step** (detailed content validation happens later if needed).

### Example Output (Illustrative):
Please write an IELTS [Skill Name] for this [Context Type].

### Additional Rules:
- Preserve the exact phrasing and formatting.
- Do not modify or correct any part of the previously chosen content.
- Use the exact phrasing specified.
- Do not include any additional instructions or commentary.
- The output must match exactly.
- Do not deviate or add any extra content.
- NEVER ask anything else!`,
    // Validation here is often specific to the *type* of input expected (e.g., introduction, conclusion).
    // Use a placeholder for the specific validation instruction.
    validation: "[Specific Input Type Validation Instruction]", // Placeholder
    // Save the user's response into named memory using a placeholder key.
    saveUserInputAs: "[skill_user_input]", // Placeholder key
    // No fallback needed usually, as invalid format might be handled by validation re-prompting
    // or specific content errors are handled in the analysis phase.
  },

  // --- Step 6 (Index 5): Display User Input ---
  {
    prompt_text: `# System message:
You are an expert in accurately displaying the user's submitted text.

## Task Instructions:
1. Retrieve the user's previous input, which is their [Skill Name], from the conversation history (it should be the most recent user message).
2. Output it using the exact format below, replacing the placeholder:
   - "User's [Skill Name]: **<User's Submitted Text>**."
3. Do not add any extra text, explanations, or commentary.
4. Never modify or add to the user's submission. ALWAYS output it exactly as written by the user!

### Example Output (Illustrative):
User's [Skill Name]: **<The exact text the user wrote in the previous turn>**

### Additional Rules:
- Preserve the exact phrasing and formatting of the user's input.
- The output must match the specified format exactly.
- Do not deviate or add any extra content.
- NEVER ask anything else!`,
    autoTransitionVisible: true,
    // Save the confirmed user input under a specific key
    saveAssistantOutputAs: "[skill_user_input_displayed]", // Placeholder key
    // important_memory: true, // Often useful to make the user's full work easily accessible
  },

  // =============================================
  // Phase 3: Analysis & Feedback - Data Extraction
  // =============================================
  // These steps extract specific pieces needed for analysis.

  // --- Step 7 (Index 6): Extract Component from Original Source ---
  {
    prompt_text: `# System message:
You are an AI language model trained to extract specific components from provided text based on instructions.

## Task Instructions:
1. Identify the [Component To Extract - e.g., main question statement / original opinion] within the [Source Material - e.g., User's Chosen Question / Original Introduction] stored in conversation history (likely under a specific memory key like '[original_content_key]').
2. Ignore specific instructional phrases or context as needed (e.g., 'To what extent...', 'Discuss both views...', introduction boilerplate). Define these exclusions clearly in specific prompt files.
3. Output only the extracted component using the exact format:
   - "[Component Name]: **<Extracted Component Text>**"
4. Do not output any additional text.

## Example Input (Illustrative - from memory key '[original_content_key]'):
[Full text of the original source material]

## Example Output (Illustrative):
[Component Name]: **[The specific extracted text, e.g., the question statement without the instruction]**

### Additional Rules:
- Preserve the exact phrasing and formatting of the extracted component.
- Use the exact output format shown.
- Do not include any additional instructions or commentary.
- The output must match exactly.
- Do not deviate or add any extra content.
- NEVER ask anything else!`,
    autoTransitionVisible: true,
    saveAssistantOutputAs: "[original_component_key]", // Placeholder key
  },

  // --- Step 8 (Index 7): Extract Component from User's Submission ---
  {
    prompt_text: `# System message:
You are an AI language model trained to extract specific components from the user's submitted text based on instructions.

## Task Instructions:
1. Identify the [Component To Extract - e.g., user's paraphrased question statement / user's opinion] within the user's submitted [Skill Name] (likely stored in history under memory key '[skill_user_input_key]' or '[skill_user_input_displayed]').
2. Ignore specific parts of the user's text if needed (e.g., ignore reasons when extracting only the opinion). Define these exclusions clearly in specific prompt files.
3. Output only the extracted component using the exact format:
   - "User's [Component Name]: **<Extracted Component Text>**"
4. Do not output any additional text.

## Example Input (Illustrative - from memory key '[skill_user_input_key]'):
[Full text of the user's submitted introduction/conclusion]

## Example Output (Illustrative):
User's [Component Name]: **[The specific extracted text from the user's work]**

### Additional Rules:
- Preserve the exact phrasing and formatting of the extracted component.
- Use the exact output format shown.
- Do not include any additional instructions or commentary.
- The output must match exactly.
- Do not deviate or add any extra content.
- NEVER ask anything else!`,
    autoTransitionVisible: true,
    saveAssistantOutputAs: "[user_component_key]", // Placeholder key
  },
  // Note: Add more extraction steps here if needed (e.g., extracting supporting ideas separately)

  // --- Step 9 (Index 8): Consolidate Extracted Data ---
  {
    prompt_text: `# System message:
You are an Expert in outputting structured data EXACTLY as instructed, using values stored in memory.

## Task Instructions:
1. Retrieve the necessary values from conversation memory using the keys provided below (these keys correspond to previously extracted information).
2. Output the information using the exact format specified. Use the placeholders (e.g., {[original_component_key]}) which will be replaced by the system with the actual memory values.
3. Do NOT add any extra text, explanations, labels, or formatting beyond what is specified in the format.

### Output Format (Use this EXACTLY):

- '[Original Component Name]' as {[original_component_key]}
- '[User Component Name]' as {[user_component_key]}
- 'User Full Submission' as {[skill_user_input_displayed]}
- (Add more lines here in specific module files for other extracted components as needed, using their respective memory keys)

### Example Output (Illustrative - after system replaces placeholders):

- 'Original Question Statement' as Companies that rely on fossil fuels should face higher taxes compared to those that use renewable energy.
- 'User Question Statement' as Businesses that use fuels from the ground should be increased tax compared to those that use green fuels.
- 'User Full Submission' as Businesses that use fuels from the ground should be increased tax compared to those that use green fuels. I think this is right because fuels on the ground heat the planet and cause people illness.

### Additional Rules:
- The output structure (- 'Label' as {memory_key}) must be followed precisely.
- Only include the specified items in the output.
- Do not add any introductory or concluding text.
- Output this text exactly and never output anything else!`,
    // This consolidation step should run automatically and be visible
    autoTransitionVisible: true,
    // Mark this consolidated output as important for easy reference in subsequent analysis steps
    important_memory: true,
    // Save this formatted block under its own key
    saveAssistantOutputAs: "[consolidated_context]", // Placeholder key
    temperature: 0, // Ensure deterministic output
  },

  // =======================================================
  // Phase 3: Analysis & Feedback - Specific Analysis Blocks
  // =======================================================
  // --- Start of actual analysis blocks (Paraphrasing, Grammar, etc.) ---
  // [Prompt 9] Introduce Analysis Type (e.g., Paraphrasing)
  // [Prompt 10] Extract/Present Data for Paraphrasing Analysis
  // [Prompt 11] Perform Paraphrasing Analysis & Give Feedback
  // [Prompt 12] Suggest Paraphrasing Improvement (Optional)
  // [Prompt 13] Readiness check for next analysis (e.g., Grammar)
  // ... and so on ...

  // ==================================
  // Phase 4: Conclusion / Next Steps
  // ==================================
  // [Prompt N] Final Summary (Optional):
  // [Prompt N+1] Offer Next Action:

];

// Example of how a specific file might use this:
/*
// In prompts_introduction.ts (simplified concept)
import { BASE_CONVERSATION_FLOW } from './promptFlowTemplate';
import { customValidationInstructionForQuestion, customValidationInstructionForIntroduction } from './validationInstructions'; // Import actual validation

// Deep copy the template to avoid modifying the original
let introductionPrompts = JSON.parse(JSON.stringify(BASE_CONVERSATION_FLOW));

// --- Customize Step 1 ---
introductionPrompts[0].prompt_text = introductionPrompts[0].prompt_text.replace('[Skill Name]', 'IELTS Opinion Introductions');
introductionPrompts[0].validation = customValidationInstructionForQuestion;

// --- Customize Step 2 ---
// introductionPrompts[1].prompt_text = ... replace placeholders ...

// --- Customize Step 3 ---
// introductionPrompts[2].prompt_text = ... replace placeholders AND add the list of questions ...

// --- Customize Step 4 ---
// introductionPrompts[3].prompt_text = ... replace placeholders ...
// introductionPrompts[3].validation = customValidationInstructionForQuestion;

// --- Customize Step 5 ---
// introductionPrompts[4].prompt_text = ... replace placeholders ...
// introductionPrompts[4].validation = customValidationInstructionForIntroduction;
// introductionPrompts[4].saveUserInputAs = "user_introduction";

// --- Customize Step 6 ---
// introductionPrompts[5].prompt_text = ... replace placeholders ...
// introductionPrompts[5].saveAssistantOutputAs = "user_introduction_displayed";
// introductionPrompts[5].important_memory = true; // Maybe make this important

// --- Customize Step 7 ---
// introductionPrompts[6].prompt_text = ... fill in Component Name, Source Material, memory key ...
// introductionPrompts[6].saveAssistantOutputAs = "original_question_statement";

// --- Customize Step 8 ---
// introductionPrompts[7].prompt_text = ... fill in Component Name, Skill Name, memory key ...
// introductionPrompts[7].saveAssistantOutputAs = "user_paraphrased_statement";

// --- Customize Step 9 ---
// introductionPrompts[8].prompt_text = ... adjust output format and memory keys ...
// introductionPrompts[8].saveAssistantOutputAs = "consolidated_intro_context";


// --- Add/Customize Analysis Blocks ---
// introductionPrompts.push({ ... prompt to introduce paraphrasing analysis ... });
// introductionPrompts.push({ ... prompt to present data for paraphrasing analysis ... });
// ... etc ...

export const PROMPT_LIST = introductionPrompts;
*/ 