import { IeltsEssayConfig } from "../prompt_configs/config_types";
import {
    customValidationInstructionForQuestion,
    customValidationInstructionForOption, // Assuming this might be needed later
    customValidationInstructionForintroduction // Assuming this might be needed later
} from "./validationInstructions"; // Corrected path: Already in prompts directory

// Define the structure for individual prompts (assuming it's defined elsewhere, e.g., in a types file or imported)
// If not, define it here:
// Moved PromptType definition to a shared types file? Assuming it's imported or defined elsewhere now.
// type PromptType = { ... };
// If PromptType is not globally available, uncomment and define it OR import from types file.

// Helper function to format the question list - moved here for central logic
const formatQuestionList = (questions: string[]): string => {
    return questions.map((q) => `   ${q}`).join('\n        ');
};

/**
 * Generates a list of prompts for an IELTS introduction practice session,
 * tailored to a specific essay type using the provided configuration.
 * @param config - The configuration object for the specific essay type.
 * @returns An array of PromptType objects representing the conversation flow.
 */
export const createIeltsIntroductionPrompts = (config: IeltsEssayConfig): /* PromptType[] */ any[] => { // Changed return type to any[] temporarily
    const prompts: /* PromptType[] */ any[] = []; // Changed type to any[] temporarily

    // Index 0: Readiness Check
    prompts.push({
        prompt_text: config.readinessPromptText,
        validation: customValidationInstructionForQuestion,
    });

    // Index 1: Select Question
    const questionListFormatted = formatQuestionList(config.sampleQuestions);
    const selectQuestionPrompt = config.selectQuestionPromptTextTemplate
        .replace('{essayTypeFullName}', config.essayTypeFullName)
        .replace('{essayTypeShortName}', config.essayTypeShortName)
        .replace('{questionList}', questionListFormatted);
    prompts.push({
        prompt_text: selectQuestionPrompt,
        autoTransitionVisible: true,
    });

    // Index 2: Confirm Question Choice
    prompts.push({
        prompt_text: config.questionConfirmationPromptText,
        validation: customValidationInstructionForQuestion,
        fallbackIndex: 1, // Fallback to re-selecting question
    });

    // Index 3: Display Confirmed Question
    // This prompt text is generic enough not to need config, assuming "[chosen_question]" is always available
     prompts.push({
        prompt_text: `# System message:
You are an expert in outputting the User's Chosen Question from the conversation history, exactly as it was selected and confirmed. Do not modify or rephrase the chosen question; always include the original question statement and any accompanying task instruction exactly as provided. Never use the example!

## Task Instructions:
1. **Retrieve the question the user *confirmed* they want to use from the conversation history** (e.g., from memory key \`[chosen_question]\` if saved previously or infer from preceding turns).
2. **Output the confirmed question using the exact format below:**
    - "This is your chosen question: **<User's Confirmed Question Text>**."
    - Ensure the **full question text**, including instructions like "To what extent..." or "Discuss both views...", is included within the bold tags.
3. **Do not add any extra text, explanations, or commentary.**
    - Only output exactly: "This is your chosen question: **<User's Confirmed Question Text>**."
4. Never output a different question or invent your own. ALWAYS use the question confirmed by the user!

### Example Output (Using Opinion Example):
This is your chosen question: **It has been suggested that cars and public transport should be banned from city centres, and only bicycles should be allowed.
To what extent do you agree or disagree?**

### Example Output (Using Discussion Example):
This is your chosen question: **Some people think it is better to raise children in the city, while others believe the countryside is more suitable.
Discuss both views and give your opinion.**

### Additional Rules:
- ALWAYS use the question confirmed by the user! Never use the example!
- Preserve the exact phrasing and formatting.
- Do not modify or correct any part of the chosen question.
- Use the exact phrasing as shown.
- Do not include any additional instructions or commentary.
- The output must match exactly.
- Do not deviate or add any extra content.
- NEVER ask anything else!
`,
        temperature: 0,
        autoTransitionVisible: true,
        // Note: We save the *assistant's* output (which is the chosen Q) later at index 6
    });

    // Index 4: Ask for Introduction
    prompts.push({
        prompt_text: config.askForIntroductionPromptText,
        // Validation happens based on formula later
    });

    // Index 5: Display User Introduction
    // Generic prompt referencing [user_introduction] which is saved by the framework based on user input to prompt 4
     prompts.push({
        prompt_text: `# System message:
You are an expert in outputting the essay introduction written by the user, exactly as they have written it. Do not correct or modify the user's introduction.

## Task Instructions:
1. **Retrieve the introduction submitted by the user in the previous step.** This is available as {[user_raw_input]}.
2. **Output the user's introduction using the exact format below:**
    - "**User's Introduction**: <User Introduction Text>"
3. **Do not add any extra text, explanations, or commentary.**
    - Only output exactly: "**User's Introduction**: <User Introduction Text>"
4. Never output a different introduction or modify/add to the user's. ALWAYS use the introduction exactly as written by the user!

### Example Output:
**User's Introduction**: Some people believe that city living offers superior opportunities, while others contend that the countryside provides a better environment for raising children. This essay will argue that although cities provide diverse experiences, the countryside offers more significant benefits for child development because of increased safety and closer community ties.

### Additional Rules:
- Preserve the exact phrasing and formatting provided by the user.
- Do not modify or correct any part of the user's introduction.
- Only output the label "**User's Introduction**: " followed by the user's exact text from {[user_raw_input]}.
`,
        autoTransitionVisible: true,
        important_memory: true,
        temperature: 0,
        saveAssistantOutputAs: "[user_introduction]", // Save the formatted output
    });


    // Index 6: Retrieve/Display Chosen Question Again (Save it this time)
    // Generic text, relying on previous context/memory for the actual question text.
    prompts.push({
        prompt_text: `# System message:
You are an AI assistant trained to retrieve and output specific information exactly as requested.

## Task Instructions:
1.  Retrieve the **exact IELTS question chosen by the user** (including both the statement and the task instruction like "To what extent..." or "Discuss both views...") from the conversation history (it should be the output of prompt index 3).
2.  Output this question using the **exact format** below, with no modifications:
    **User's Chosen Question**: <The full chosen question text>

### Example Output (Opinion):
**User's Chosen Question**: It has been suggested that cars and public transport should be banned from city centres, and only bicycles should be allowed.
To what extent do you agree or disagree?

### Example Output (Discussion):
**User's Chosen Question**: Some people think it is better to raise children in the city, while others believe the countryside is more suitable.
Discuss both views and give your opinion.


### Additional Rules:
- Output **ONLY** the text in the specified format ("User's Chosen Question: ...").
- Do **NOT** add any introductory text, explanations, apologies, commentary, or reasoning.
- Do **NOT** modify, paraphrase, shorten, or reword the chosen question in **ANY** way.
- Ensure the output is retrieved exactly as it was displayed in prompt index 3.`,
        autoTransitionVisible: true,
        temperature: 0,
        saveAssistantOutputAs: "[chosen_question]", // Save it now
        important_memory: true,
    });

    // Index 7: Extract Original Question Statement
    // Prompt text is specific to the essay type's structure (e.g., ignoring "To what extent..." vs "Discuss both views...")
    prompts.push({
        prompt_text: config.extractOriginalStatementPromptText.replace('{output_label}', config.originalStatementOutputLabel), // Inject label if needed, or keep it hardcoded in config prompt
        autoTransitionVisible: true,
        important_memory: true,
        temperature: 0,
        saveAssistantOutputAs: config.originalStatementMemoryKey,
    });

    // Index 8: Extract User's Paraphrased Statement(s)
    // Prompt text is specific to the essay type (e.g., extracting background vs. first sentence view paraphrase)
     const extractUserParaphrasePrompt = config.extractUserParaphrasePromptText
        .replace('{output_label}', config.userParaphraseOutputLabel); // Inject label if needed

    prompts.push({
        prompt_text: extractUserParaphrasePrompt,
        autoTransitionVisible: true,
        important_memory: true,
        temperature: 0,
        saveAssistantOutputAs: config.userParaphraseMemoryKey,
    });

    // Index 9: Extract User's Supporting Ideas/Reasons
    // Prompt text might need minor adjustments based on essay type (e.g., "because Idea 1 and Idea 2" vs. "although... because...")
    prompts.push({
        prompt_text: config.extractUserIdeasPromptText,
        // autoTransitionVisible: true, // Let's align by removing this like in disc.ts
        important_memory: true,
        temperature: 0,
        saveAssistantOutputAs: "[user_extracted_ideas]", // Keep consistent key for now
    });

    // Index 10: Readiness Check for Analysis
    prompts.push({
        prompt_text: config.readyCheckPromptText, // Use standard text
        buffer_memory: 1,
    });

    // Index 11: Explain Formula Structure Check
    prompts.push({
        prompt_text: config.formulaExplanationPromptText,
         // buffer_memory: 10, // Adding buffer based on disc.ts index 11
    });

    // Index 12: Display User Introduction (for Formula Check)
    // Generic prompt text referencing [user_introduction]
     prompts.push({
        prompt_text: `# System message:
You are an AI assistant expert in outputting text **exactly** as instructed, without adding any extra content.

## Task Instructions:

1. Retrieve the user's full introduction from memory key \`[user_introduction]\`.
2. Output **ONLY** the following text, replacing the placeholder with the retrieved introduction:
    "Your introduction:\\n-  **{[user_introduction]}**"
3. Ensure the output matches the format exactly, including the line break and the bold formatting around the user's text.


### Additional Rules:
- Output **ONLY** the text specified in the format "Your introduction:\\n- **<User's Introduction Text>**".
- Do **NOT** add any greetings, explanations, commentary, apologies, or any other text.
- Do **NOT** modify the retrieved introduction text in any way.
- Ensure the output matches the example format exactly.`,
        autoTransitionVisible: true, // Opinion had this, Discussion didn't - let's add for consistency? Reverted based on diff
        temperature: 0,
        // Removed validation/fallback based on diff between ops/disc versions
    });

    // Index 13: Break Down User Introduction Components
    // Prompt is specific to the formula being analyzed
    prompts.push({
        prompt_text: config.breakdownAnalysisPromptText,
        saveAssistantOutputAs: config.introductionBreakdownKey,
        important_memory: true,
        autoTransitionVisible: true,
    });

    // Index 14: Readiness Check After Breakdown
    prompts.push({
        prompt_text: config.readyCheckPromptText.replace('continue?', 'continue with the next step?'), // Use slight variant text like original files
         buffer_memory: 1, // Added buffer based on ops.ts index 14
    });

    // --- Formula Evaluation Steps ---

    // Index 15: Evaluate Formula Component 1
    prompts.push({
        prompt_text: config.formulaCheckPromptText_Step15,
        temperature: 0,
        autoTransitionVisible: true,
        appendTextAfterResponse: "....................................................................................................................",
    });

    // Index 16: Evaluate Formula Component 2
    prompts.push({
        prompt_text: config.formulaCheckPromptText_Step16,
        temperature: 0,
        autoTransitionVisible: true,
        appendTextAfterResponse: "....................................................................................................................",
    });

    // Index 17: Evaluate Formula Component 3
    prompts.push({
        prompt_text: config.formulaCheckPromptText_Step17,
        temperature: 0,
        autoTransitionVisible: true,
        appendTextAfterResponse: "....................................................................................................................",
    });

    // Index 18: Evaluate Formula Component 4 (Optional)
    if (config.formulaCheckPromptText_Step18) {
        prompts.push({
            prompt_text: config.formulaCheckPromptText_Step18,
            temperature: 0,
            autoTransitionVisible: true,
            // appendTextAfterResponse: "...", // Optional: Add separator if desired
        });
    }
    // Note: If step 18 exists, subsequent indices shift. For now, assume it might not, keeping original indices for parity.

    // Index 19: Provide & Save Correction (if needed)
     // Needs to reference the breakdown key and potentially a new key for feedback errors
    prompts.push({
        prompt_text: config.provideCorrectionPromptText.replace('[user_introduction_breakdown]', `{${config.introductionBreakdownKey}}`), // Adjust key reference
        autoTransitionVisible: true,
        temperature: 0.1, // Slightly higher temp for generation like in disc.ts
        // saveAssistantOutputAs: "[formula_corrected_version]", // Optional: save if needed later
        appendTextAfterResponse: "....................................................................................................................",
    });


    // Index 20: Readiness Check After Correction/Formula
     // Use slightly different wording like ops.ts index 20
    prompts.push({
        prompt_text: config.readyCheckPromptText.replace('continue?', 'continue?'),
        buffer_memory: 1,
    });

    // --- Paraphrasing Section ---

    // Index 21: Explain Paraphrasing Check
    prompts.push({
        prompt_text: config.paraphraseCheckExplanationText,
        buffer_memory: 6,
        autoTransitionVisible: true,
        appendTextAfterResponse: "....................................................................................................................",
    });

    // Index 22: Display Original and User Paraphrased Statements
    // Generic structure, specific keys/labels from config
    prompts.push({
        prompt_text: `# System message:
You are an expert in outputting all text EXACTLY as you have been instructed to do. You never deviate from the instructions.
# Never confuse the user paraphrase statement with the user's full introduction!
# Only output the text in the exact format below. Never add any other text or commentary! Use a DOUBLE NEWLINE between the two lines.

## Task Instructions:
1. Only ever output the original statement and the user's paraphrase statement in the exact format below, separated by a double newline (\`\\n\\n\`).
2. Use the labels defined in the configuration.
"${config.originalStatementOutputLabel} {${config.originalStatementMemoryKey}}"
"${config.userParaphraseOutputLabel} {${config.userParaphraseMemoryKey}}"

## Example Output (Using Discussion Config):
**Original Discussion Question Statement:** Some people think it is better to raise children in the city, while others believe the countryside is more suitable.

**User's Paraphrased Views Statement:** Certain individuals advocate for raising offspring in urban environments, whereas other groups maintain that rural settings are preferable.


## Additional Rules:
- **Use the exact text and structure as shown.**
- **A double newline MUST separate the two lines.**
- **Do not include any additional instructions or commentary.**
- **The output must match exactly.**
- **Do not deviate or add any extra content.**
- **NEVER ask anything else!**
`,
        autoTransitionVisible: true,
        appendTextAfterResponse: "....................................................................................................................",
    });


    // Index 23: Extract Keywords from Original Statement
    // Generic prompt text structure, references original statement key from config
    prompts.push({
        prompt_text: `# System message:
You are an AI language model trained to extract key parts of speech (nouns, adjectives, verbs) ONLY from the Original Statement provided below.

## Original Statement to Analyze:
{${config.originalStatementMemoryKey}}

## Task Instructions:
1. **Explain the task:** Output exactly:
    "Above is the ${config.originalStatementOutputLabel}. We are now going to extract the key parts of speech—specifically, the nouns, adjectives, and verbs—that might be replaced with synonyms."
2. **Extract Key Words:** Analyze ONLY the Original Statement text provided above ({${config.originalStatementMemoryKey}}).
3. Identify and list all important **nouns, adjectives, and verbs** found within that text.
4. Organize the output under three headings: **Nouns**, **Adjectives**, and **Verbs** (each heading in bold text), listing the words (e.g., as JSON arrays).

## Example Output (Illustrative - Based on Opinion config):

Above is the Original Question Statement:. We are now going to extract the key parts of speech—specifically, the nouns, adjectives, and verbs—that might be replaced with synonyms.

**Nouns:** ["companies", "fuels", "taxes", "energy"]
**Adjectives:** ["fossil", "renewable"]
**Verbs:** ["rely", "face", "use"]

### Additional Rules:
- Extract words ONLY from the {${config.originalStatementMemoryKey}} text.
- List words under the correct bold heading.
- Use JSON array format for the lists of words.
- Do not include extra explanations or comments beyond the initial sentence.
- ONLY extract words from the {${config.originalStatementMemoryKey}} text, never from the user's paraphrase statement, user's introduction, or anything else.`,
        autoTransitionVisible: true,
        temperature: 0,
        appendTextAfterResponse: "....................................................................................................................",
    });


    // Index 24: Extract Changed Keywords (Synonyms) from User Statement
    // Generic prompt text structure, references original and user keys from config
     prompts.push({
        prompt_text: `# System message:
You are an AI language model trained to analyze and extract differences in key parts of speech in IELTS writing. Your task is to compare the user's paraphrase statement with the original statement (both provided below) and list all the **nouns**, **adjectives**, and **verbs** that the user appears to have changed (i.e., replaced with synonyms or different phrasing).

## Original Statement:
{${config.originalStatementMemoryKey}}

## User's Paraphrase Statement:
{${config.userParaphraseMemoryKey}}

## Task Instructions:
1. **Explain the task to the user:**
    - ALWAYS tell the user in these exact words before listing the changed words:
        **"Below is a list of the key words (nouns, adjectives, verbs) from the ${config.originalStatementOutputLabel} that appear to have been changed in your ${config.userParaphraseOutputLabel}."**

2. **Identify Changed Words:**
    - Compare the User's Paraphrase Statement ({${config.userParaphraseMemoryKey}}) with the Original Statement ({${config.originalStatementMemoryKey}}).
    - Identify important nouns, adjectives, and verbs from the original statement that seem to have a corresponding but different word/phrase in the user's paraphrase statement.

3. **List the Changed Word Mappings:**
    - Under the headings **Nouns**, **Adjectives**, and **Verbs**, list the mappings for each identified change using the format:
        **"original word/phrase" → "user's word/phrase"**
    - Focus on direct substitutions or clear rephrasing of key concepts.
    - If a key word from the original seems unchanged, do not list it.
    - If a key word from the original seems omitted, you *can optionally* note it like: \`\\"original word\\" → [Omitted]\`

## Example Output (Based on Discussion config):

Below is a list of the key words (nouns, adjectives, verbs) from the Original Discussion Question Statement: that appear to have been changed in your User's Paraphrased Views Statement:.

**Nouns:** ["people" → "individuals", "children" → "offspring", "city" → "urban environments", "countryside" → "rural settings"]
**Adjectives:** ["better" → [Omitted], "suitable" → "preferable"]
**Verbs:** ["think" → "advocate for", "raise" → "raising", "believe" → "maintain"]


### Additional Rules:
- Only compare the two statements provided above.
- Only list apparent changes/synonyms for nouns, adjectives, and verbs.
- Use the exact introductory sentence and output format ("original" → "user's").
- Do not provide any evaluation or commentary on the quality of the synonyms here.`,
        autoTransitionVisible: true,
        temperature: 0,
        appendTextAfterResponse: "....................................................................................................................",
    });

    // Index 25: Evaluate Paraphrasing Quality
    // Prompt text is specific to the type of paraphrasing being evaluated
     prompts.push({
        prompt_text: config.evaluateParaphrasingQualityPromptText
            .replace('{original_statement_key}', `{${config.originalStatementMemoryKey}}`) // Inject keys if needed in prompt
            .replace('{user_paraphrase_key}', `{${config.userParaphraseMemoryKey}}`),
        autoTransitionVisible: true,
        appendTextAfterResponse: "....................................................................................................................",
    });

    // Index 26: Suggest Improved Paraphrase
    // Prompt text is specific to the type of paraphrasing required
    prompts.push({
        prompt_text: config.suggestImprovedParaphrasePromptText
             .replace('{original_statement_key}', `{${config.originalStatementMemoryKey}}`) // Inject key
             .replace('{[oqs]}', `{${config.originalStatementMemoryKey}}`), // Replace hardcoded key if present
        temperature: 0.1,
        autoTransitionVisible: true,
        // No appendTextAfterResponse in originals
    });

    // Index 27: Final Readiness Check? (Seems consistent)
    prompts.push({
        prompt_text: `#System message:
You are an expert in asking the user whether they are ready to continue. Yes or OK etc = Valid. No = INVALID.

##Task:
### Always follow these steps:

Step 1: Ask the user '${config.readyCheckPromptText}'. If they say yes or OK, this is VALID
Step 2: If they are not ready it is invalid.

Step 3: Only ask '${config.readyCheckPromptText}'. Never add extra information such as valid or invalid.
`,
        buffer_memory: 1,
    });

    return prompts;
}; 