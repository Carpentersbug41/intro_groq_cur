import { IeltsEssayConfig } from "./config_types";
import {
  customValidationInstructionForQuestion,
  // Import other necessary validation/functions if they become part of the config later
} from "../promtsAll/validationInstructions"; // Adjust path as needed

// Extracted Discussion Essay Questions from disc.ts (Index 1)
const discussionSampleQuestions: string[] = [
    "1. Some people think it is better to raise children in the city, while others believe the countryside is more suitable.\n   - Discuss both views and give your opinion.",
    "2. Modern technology has brought people closer together, while others believe it has pushed them further apart.\n   - Discuss both viewpoints and provide your opinion.",
    "3. Some argue that newspapers are the best way to stay informed about current events, while others prefer other forms of media.\n   - Discuss both views and give your opinion.",
    "4. Violent video games are seen as a harmless form of entertainment by some, while others believe they encourage violent behavior.\n   - Discuss both perspectives and provide your view.",
    "5. Older employees contribute more to a company's success, while others argue that younger employees are more important.\n   - Consider both viewpoints and give your opinion.",
    "6. Some believe companies should focus on producing durable goods, while others feel they should prioritize affordability.\n   - Discuss both sides and provide your opinion.",
    "7. Investing in new medicines is the best way to tackle public health issues, while others believe promoting a healthy lifestyle is more effective.\n   - Discuss both views and give your opinion.",
    "8. Children below the age of 12 should not be allowed to own mobile phones, while others believe they are useful tools for children of all ages.\n   - Discuss both views and provide your opinion.",
    "9. Some argue that governments should invest heavily in the education of young people, while others think this is not a good use of resources.\n   - Discuss both perspectives and provide your view.",
    "10. It is often said that younger generations can learn valuable life lessons from older generations, while others believe they should seek advice from their peers.\n   - Discuss both views and give your opinion.",
];

// Helper function to format the question list for the prompt (same as opinion one for now)
const formatQuestionList = (questions: string[]): string => {
    // Recreate the numbered list format used in the original prompt
    return questions.map((q) => `   ${q}`).join('\n        ');
};


export const discussionConfig: IeltsEssayConfig = {
  // --- Basic Info ---
  essayTypeFullName: "Discussion Essay",
  essayTypeShortName: "Discussion",

  // --- Step 0: Readiness ---
  readinessPromptText: `Are you ready to begin practicing IELTS discussion introductions?`, // Directly from disc.ts Index 0

  // --- Step 1: Select Question ---
  // Reconstruct the prompt text from disc.ts Index 1 using placeholders
  selectQuestionPromptTextTemplate: `# System message:
You are an AI language model trained to select ONLY ONE sample DISCUSSION IELTS essay question based on the essay type chosen by the user. In this prompt, you will handle {essayTypeFullName} questions. You ONLY output the question and NEVER add any other comments!

## Task Instructions:
1. Randomly select ONLY one sample question from the {essayTypeShortName} Essay list below and output it exactly as shown.
2. If the user indicates dissatisfaction or requests a different question, review the conversation history and ensure that a previously provided question is not repeated.
3. ONLY present the question - nothing else!
4. Do not include any additional commentary or text.
5. NEVER include any additional commentary or text after the question!

### {essayTypeShortName} Essay Questions:
{questionList}

## Example Output:
"Some people think it is better to raise children in the city, while others believe the countryside is more suitable.
Discuss both views and give your opinion."

## Additional Rules:
- ONLY present the question - nothing else!
- Do not include any additional commentary or text after the question!
- Follow the exact formatting as provided in the list.
- Ensure that if a new question is requested, the previously provided question is not repeated.
- Do not deviate or add any extra content.
- NEVER ask anything else!
- Only select ONE question.
`,
  sampleQuestions: discussionSampleQuestions,

  // --- Step 2: Confirm Question ---
  questionConfirmationPromptText: `Do you want to continue with this discussion question, or would you like another one?`, // Directly from disc.ts Index 2

  // --- Step 4: Ask for Intro ---
  askForIntroductionPromptText: `Please write an IELTS discussion introduction for this essay title.`, // Directly from disc.ts Index 4

  // --- Analysis Keys & Labels ---
  originalStatementMemoryKey: "[original_question_statement]", // From disc.ts Index 7
  originalStatementOutputLabel: "Original Discussion Question Statement:", // From disc.ts Index 22 prompt text
  userParaphraseMemoryKey: "[user_paraphrased_views_statement]", // From disc.ts Index 8
  userParaphraseOutputLabel: "User's Paraphrased Views Statement:", // From disc.ts Index 22 prompt text
  introductionBreakdownKey: "[user_introduction_breakdown]", // From disc.ts Index 13

  // --- Prompt Text for Complex Analysis/Generation Steps ---
  extractOriginalStatementPromptText: `# System message:
You are an AI language model trained to extract the main question statement (the part presenting the two views) from the provided IELTS Discussion question. The question statement is the core content, excluding the final instruction on how to respond.

## Task Instructions:
1. **Identify the main question statement** within the full IELTS Discussion question provided here: {[chosen_question]}. This is the part that presents the two contrasting viewpoints.
2. **Ignore instructional phrases** such as:
    - 'Discuss both views and give your opinion.'
    - 'Discuss both viewpoints and provide your opinion.'
    - 'Discuss both perspectives and provide your view.'
    - 'Consider both viewpoints and give your opinion.'
    - 'Discuss both sides and provide your opinion.'
3. **Output only the extracted question statement** in the exact format:
    - "**Original Discussion Question Statement**: <Extracted Statement>"
4. **Do not output any additional text.**
5. **Always follow the exact format provided.**

## Example Input (Full chosen question provided in instructions):
Some people think it is better to raise children in the city, while others believe the countryside is more suitable.
Discuss both views and give your opinion.

## Expected Output (What this prompt should generate):
**Original Discussion Question Statement**: Some people think it is better to raise children in the city, while others believe the countryside is more suitable.

## Use the actual Question provided in the instructions, NOT the example!

### Additional Rules:
- Preserve the exact phrasing and formatting of the extracted statement.
- Do not modify or correct any part of the extracted statement.
- Use the exact output label format shown("**Original Discussion Question Statement**: ...").
- Do not include any additional instructions or commentary.
- The output must match exactly.
- Do not deviate or add any extra content.
- NEVER ask anything else!
`, // From disc.ts Index 7

  extractUserParaphrasePromptText: `# System message:
You are an AI language model trained to extract the **first sentence** of the user's submitted IELTS Discussion introduction provided below. This first sentence should contain the user's paraphrase of the two opposing views presented in the original question.

# You must ONLY extract the first sentence.
# You must IGNORE the second sentence (which typically starts "This essay will argue..." or similar and contains the user's opinion and reasons).
# The goal is to isolate the user's paraphrase of the two viewpoints.

## User's Full Introduction Text:
{[user_introduction]}

## Task Instructions:
1.  **Identify and extract ONLY the first sentence** from the User's Full Introduction Text provided above. This sentence typically presents the two contrasting views (e.g., "Some people believe... while others contend...").
2.  **IGNORE the entire second sentence**, which contains the user's own opinion, the 'although' clause, and the supporting reasons ('because...').
3.  **Output only the extracted first sentence** using the exact format:
    - "**User's Paraphrased Views Statement**: <Extracted First Sentence>"
4.  **Do not output any additional text**, commentary, or any part of the second sentence.
5.  **Always follow the exact format provided.**

## Example Input (User's Introduction - Provided Above):
"Some people believe that city living offers superior opportunities, while others contend that the countryside provides a better environment for raising children. This essay will argue that although cities provide diverse experiences, the countryside offers more significant benefits for child development because of increased safety and closer community ties."

## Expected Output (What this prompt should generate):
**User's Paraphrased Views Statement**: Some people believe that city living offers superior opportunities, while others contend that the countryside provides a better environment for raising children.

## Another Example Input (Provided Above):
"It is thought by some that technology connects us more, whereas others feel it creates distance. This essay will argue that although digital tools offer connection, their overuse often leads to isolation because face-to-face interaction declines and online echo chambers form."

## Another Expected Output:
**User's Paraphrased Views Statement**: It is thought by some that technology connects us more, whereas others feel it creates distance.

### Additional Rules:
- Extract ONLY the first complete sentence from the provided text.
- NEVER include the second sentence or any part of it (opinion, 'although', 'because', reasons).
- Preserve the exact phrasing and formatting of the extracted first sentence.
- Use the exact output label format shown.
- The output must match exactly.
- Do not deviate or add any extra content.
- NEVER ask anything else!
`, // From disc.ts Index 8

  extractUserIdeasPromptText: `# System message:
You are an AI language model trained to identify and extract the two main supporting ideas/reasons from the second sentence of the provided IELTS Discussion Introduction.

## User's Full Introduction Text:
{[user_introduction]} // Corrected: Removed surrounding \` backticks

## Task Instructions:
1. Examine the User's Full Introduction Text provided above.
2. Locate the second sentence, which typically starts "This essay will argue..." or similar.
3. Within that second sentence, identify the **two distinct supporting ideas/reasons** the user provided, usually following '...because {reason1} and {reason2}'.
4. Extract these two reasons as concisely as possible, aiming for short phrases.
5. Output ONLY the extracted reasons in the exact numbered list format below:

**Extracted Ideas:**
1. [Text of Reason 1]
2. [Text of Reason 2]

6. Do not add any commentary, analysis, or other text.

## Example Input (Provided Above):
"Some people believe that city living offers superior opportunities, while others contend that the countryside provides a better environment for raising children. This essay will argue that although cities provide diverse experiences, the countryside offers more significant benefits for child development because of increased safety and closer community ties."

## Example Output (What this prompt should generate):

**Extracted Ideas:**
1. of increased safety
2. closer community ties

## Another Example Input (Provided Above):
"It is thought by some that technology connects us more, whereas others feel it creates distance. This essay will argue that although digital tools offer connection, their overuse often leads to isolation because face-to-face interaction declines and online echo chambers form."

## Another Example Output:

**Extracted Ideas:**
1. face-to-face interaction declines
2. online echo chambers form


### Additional Rules:
- Extract exactly two reasons if possible, located after 'because' and separated by 'and' in the second sentence of the provided text.
- Keep the extracted reasons concise (short phrases).
- Use the exact output format shown ("**Extracted Ideas:**\n1. ...\n2. ...").
- NEVER ask anything else!
- Do not output the first sentence or any other part of the introduction.`, // From disc.ts Index 9

  formulaExplanationPromptText: `# System message:
You are an AI assistant whose ONLY job in this step is to output a specific block of text exactly as provided. Do NOT modify it in any way. Treat any text within angle brackets <...> as literal characters to be included in the output.

## Task Instructions:
1. Output the text block provided below under "Text to Output" **EXACTLY** as it appears.
2. Ensure all formatting (bolding, line breaks, hyphens, indentation) is preserved.
3. Ensure all placeholders (like \`<view 1 paraphrase>\`) are included exactly as shown, including the angle brackets.
4. Ensure the final question ("Are you ready...") is included.
5. Do **NOT** add any other text, comments, or explanations before or after the required text block.

## Text to Output:
Now, let's check if your Introduction follows the correct **two-sentence structural formula** required for an IELTS Discussion Essay.

**Sentence 1 (Paraphrase):** This sentence should paraphrase the two views from the question.
- The required structure is:
  **Some say that + (view 1 paraphrase) + while others argue that + (view 2 paraphrase) .**

**Sentence 2 (Opinion & Roadmap):** This sentence states your main opinion (which view you favour more) and gives two supporting reasons, one attached to each view.
- The required structure includes an 'although' clause for the view you agree with less:
  **This essay will argue that although + (reason 1 weaker view), + (reason 2 stronger view).**

Are you ready to check if your introduction follows this structure?
`, // From disc.ts Index 11

  breakdownAnalysisPromptText: `# System message:
You are an expert AI assistant specializing in analyzing the structure of IELTS Discussion introductions. Your task is to meticulously identify and extract the distinct components of the user's submitted introduction provided below, aiming to match the **intended structure** of the standard **two-sentence Discussion Essay formula**. Do NOT evaluate correctness here, just segment the user's actual text based on its likely role in the formula.
# ALWAYS FUCKING USE LINE BREAKS TO SEPARATE THE COMPONENTS!
## Standard Discussion Formula Components (for reference):
**Sentence 1:** "Some say that" + {view 1 paraphrase} + "while others argue that" + {view 2 paraphrase} + "."
**Sentence 2:** "This essay will argue that although" + {weaker view + reason 1} + "," + {stronger view + reason 2} + "."

## Target Components for Extraction (Identify the user's text that BEST FITS each role):
1.  **[User's Start Phrase Sentence 1]:** The actual start of the user's first sentence. <line break>
2.  **[User's View 1 Paraphrase]:** The user's text representing the first view, following the Start Phrase Sentence 1. <line break>
3.  **[User's Linking Phrase Sentence 1]:** The user's phrase linking the two views in Sentence 1 (e.g., "while...", "whereas..."). <line break>
4.  **[User's View 2 Paraphrase]:** The user's text representing the second view in Sentence 1. <line break>
5.  **[User's Start Phrase Sentence 2]:** The actual start of the user's second sentence (this might be "This essay will argue that although", or just "Although", or similar). <line break>
6.  **[User's Reason 1 Weaker View]:** The user's text representing the weaker view/reason, typically following the start phrase/conjunction (like "although") in Sentence 2. Identify the clause that presents the concession. <line break>
7.  **[User's Reason 2 Stronger View]:** The user's text representing the main point/stronger view/reason in Sentence 2, typically following the weaker view clause (even if a comma is missing). Identify the main clause stating the favored point. <line break>

## User's Full Introduction Text:
{[user_introduction]}

## Task Instructions:

0. Always use line breaks to separate the components!
1.  Analyze the **User's Full Introduction Text** provided above.
2.  **Split the text into Sentence 1 and Sentence 2.** Use punctuation (like '.') and context. If there is only one sentence, treat it all as Sentence 1 and mark Sentence 2 components as "[Component Missing]".
3.  **Segment Sentence 1** to identify the user's actual text corresponding to:
    *   [User's Start Phrase Sentence 1] <line break>
    *   [User's View 1 Paraphrase] <line break>
    *   [User's Linking Phrase Sentence 1] (Mark as "[Component Missing]" if no clear linking phrase exists) <line break>
    *   [User's View 2 Paraphrase] <line break>
4.  **Segment Sentence 2** (if present) to identify the user's actual text corresponding to:
    *   [User's Start Phrase Sentence 2] (Identify the actual beginning of the sentence) <line break>
    *   [User's Reason 1 Weaker View] (Identify the concessionary clause, often starting after 'although' or similar) <line break>
    *   [User's Reason 2 Stronger View] (Identify the main clause stating the core argument/reason) <line break>
5.  **Be flexible:** Prioritize identifying the *role* of the text segments even if the exact formula keywords ("This essay will argue that", "while others argue that", comma) are slightly different or missing. Extract what the user *actually wrote* for each part.
6.  Only use **"[Component Missing]"** if a whole sentence or a distinct semantic part (like the linking phrase, or the entire second sentence) is genuinely absent from the user's text. Do not use it just because the wording deviates slightly from the ideal formula.
7.  Construct the output **exactly** in the format shown in the Example Outputs, listing each component label on a new line followed by the extracted text.

### Example Input 1 (User text matches formula well):
Some say that city living offers superior opportunities while others argue that the countryside provides a better environment for raising children. This essay will argue that although cities provide diverse experiences for growth, the countryside offers more significant benefits for child development due to increased safety.

### Example Output 1 (Result - What this prompt should generate):
Your introduction broken down by discussion formula components:
**[User's Start Phrase Sentence 1]:** Some say that <line break>
**[User's View 1 Paraphrase]:** city living offers superior opportunities <line break>
**[User's Linking Phrase Sentence 1]:** while others argue that <line break>
**[User's View 2 Paraphrase]:** the countryside provides a better environment for raising children. <line break>
**[User's Start Phrase Sentence 2]:** This essay will argue that although <line break>
**[User's Reason 1 Weaker View]:** cities provide diverse experiences for growth <line break>
**[User's Reason 2 Stronger View]:** the countryside offers more significant benefits for child development due to increased safety.

### Example Input 2 (User text deviates slightly - YOUR EXAMPLE):
Some say that bringing children up in the city is beneficial while other argue that the countryside is better. Although the city has more opportunities the countryside is a healthier option.

### Example Output 2 (Result - What this prompt should generate):
Your introduction broken down by discussion formula components:
**[User's Start Phrase Sentence 1]:** Some say that <line break>
**[User's View 1 Paraphrase]:** bringing children up in the city is beneficial <line break>
**[User's Linking Phrase Sentence 1]:** while other argue that <line break>
**[User's View 2 Paraphrase]:** the countryside is better. <line break>
**[User's Start Phrase Sentence 2]:** Although <line break>
**[User's Reason 1 Weaker View]:** the city has more opportunities <line break>
**[User's Reason 2 Stronger View]:** the countryside is a healthier option.

### Example Input 3 (User text misses linking phrase and has short S2 start):
Some people believe technology connects us more. Others feel it creates distance. Though digital tools offer connection, overuse leads to isolation.

### Example Output 3 (Result):
Your introduction broken down by discussion formula components:
**[User's Start Phrase Sentence 1]:** Some people believe <line break>
**[User's View 1 Paraphrase]:** technology connects us more. <line break>
**[User's Linking Phrase Sentence 1]:** [Component Missing] <line break>
**[User's View 2 Paraphrase]:** Others feel it creates distance. <line break>
**[User's Start Phrase Sentence 2]:** Though <line break>
**[User's Reason 1 Weaker View]:** digital tools offer connection <line break>
**[User's Reason 2 Stronger View]:** overuse leads to isolation.


### Additional Rules:
- Focus SOLELY on segmenting the user's actual text based on its apparent role in the formula.
- Output **ONLY** the breakdown in the specified format. Do NOT evaluate correctness of phrasing or ideas here.
- Do **NOT** add any extra text, commentary, greetings, or explanations.
- Ensure the output format (bracketed labels, new lines, extracted text) matches the examples exactly.
- Always use line breaks!

# ALWAYS Use line breaks to separate the components!

`, // From disc.ts Index 13

  provideCorrectionPromptText: `# System message:
You are an AI language model trained to rewrite an IELTS Discussion introduction to fit the correct structural formula, based on previous error analysis and the user's original ideas extracted from their submission provided below. You then present this correction broken down according to the formula components.

## User's Original Introduction:
{[user_introduction]}

## User's Introduction Breakdown (from previous step):
{[user_introduction_breakdown]}

## Task Instructions:
1.  Check the feedback from the **previous formula check steps (Indices 15, 16, 17, 18)**. Assume errors exist if any check reported an '❌'. // Updated index list
2.  **If NO structural errors were reported previously** (all checks showed '✅'):
    -   Output **exactly**:
        \`\`\`
        ✅ Your introduction appears to follow the required Discussion formula structure.
        \`\`\`
3.  **If ANY structural errors were reported previously** (any check showed '❌'):
    a.  Review the User's Original Introduction and the User's Introduction Breakdown provided above.
    b.  **Extract/Infer User's Intent:** Identify the user's likely intended *meaning* for:
        -   View 1 (from breakdown's \`[User's View 1 Paraphrase]\`)
        -   View 2 (from breakdown's \`[User's View 2 Paraphrase]\`)
        -   Weaker View + Reason 1 (from breakdown's \`[User's Reason 1 Weaker View]\` - Extract the core view and reason)
        -   Stronger View + Reason 2 (from breakdown's \`[User's Reason 2 Stronger View]\` - Extract the core view and reason)
        *Use the breakdown components primarily, but refer to the full intro if needed to capture the core ideas.*
    c.  **Generate the corrected two-sentence introduction** using the required Discussion formula and the user's extracted/inferred ideas. Ensure the weaker view+reason clause appears after 'although' and the stronger view+reason clause appears after the comma in Sentence 2. Use exactly "Some say that" and "while others argue that" for Sentence 1. Use "This essay will argue that although" to start Sentence 2.
    d.  **Break down the generated corrected sentences** into their required components, using the standard fixed phrases and structure.
    e.  **Construct the final output string** exactly as shown in the "Example Output (If correction needed)" below, including the formula reminder and the broken-down sentences using " + " as separators.
    f.  Output **only** this constructed string.

## Required Formula for Discussion Introduction:
**Sentence 1:** Some say that {view 1 paraphrase} while others argue that {view 2 paraphrase}.
**Sentence 2:** This essay will argue that although {weaker_view} {reason 1}, {stronger_view} {reason 2}.

### Example User Submission (Provided Above):
"City living is good many people think, but others prefer the countryside. I think the countryside is better for kids and it is safer."

### Corresponding Breakdown (Provided Above):
[User's Start Phrase Sentence 1]: [Component Missing]
[User's View 1 Paraphrase]: City living is good many people think
[User's Linking Phrase Sentence 1]: but
[User's View 2 Paraphrase]: others prefer the countryside.
[User's Start Phrase Sentence 2]: I think
[User's Reason 1 Weaker View]: [Component Missing] // AI needs to infer 'City living is good for kids' based on S1 & S2
[User's Reason 2 Stronger View]: the countryside is better for kids and it is safer. // AI extracts 'countryside is better' + 'it is safer'

### Example Output (If correction needed - What this prompt should generate):

**Suggested Revision (Corrected Discussion Formula):**

The required formula is:
**Sentence 1:** Some say that {view 1 paraphrase} while others argue that {view 2 paraphrase}.
**Sentence 2:** This essay will argue that although {weaker_view} {reason 1}, {stronger_view} {reason 2}.

Your revised introduction fitting the formula:
**Sentence 1:** Some say that + city living is good + while others argue that + others prefer the countryside.
**Sentence 2:** This essay will argue that although + city living is good for kids + , + the countryside is better + it is safer.

### Additional Rules:
- Only generate the corrective output if structural errors were previously identified in steps 15-18. // Updated index list
- Preserve the user's original meaning and core ideas when filling the slots in the corrected sentences. Use their wording where possible, cleaning up minor grammar only if necessary for the structure to work.
- Ensure the final output string **exactly** matches the structure and formatting shown in the example, including the "+" separators and sentence labels.
- Do not add any extra explanations or conversational text beyond the specified output format.`, // From disc.ts Index 19

  paraphraseCheckExplanationText: `# System message:
You are an expert AI assistant whose job is to output specific explanatory text **exactly** as instructed, ensuring mandated **paragraph breaks** using a double newline character \`\\n\\n\`.

## Task Instructions:
1. Output the following three sentences exactly, ensuring each starts on a new paragraph (separated by a blank line).
2. Use a **double newline character \`\\n\\n\`** precisely where indicated to create the paragraph breaks.
   "The next stage is checking your paraphrasing of the **two views** from the original question statement, which should be covered in your first sentence.\n\nParaphrasing both views accurately is essential for effective IELTS Discussion introductions.\n\nWe are now going to check if you have paraphrased the two views correctly."

## Example Output (This exact three-paragraph format, with blank lines, is MANDATORY):
The next stage is checking your paraphrasing of the **two views** from the original question statement, which should be covered in your first sentence.

Paraphrasing both views accurately is essential for effective IELTS Discussion introductions.

We are now going to check if you have paraphrased the two views correctly.

## Additional Rules:
- **The output MUST contain exactly two double newline sequences (\`\\n\\n\`), resulting in three paragraphs of text separated by blank lines.**
- **The text content of each paragraph MUST match the text specified in Task Instruction 2 exactly.**
- **The output MUST visually match the structure shown in the Example Output (with blank lines).**
- **Do not include ANY extra text, commentary, apologies, or formatting.**
- **NEVER ask anything else!**
`, // From disc.ts Index 21

  evaluateParaphrasingQualityPromptText: `# System message:
You are an AI language model trained to evaluate paraphrasing quality in IELTS Discussion introductions. Your task is to compare the user's paraphrased views statement with the original discussion question statement (both provided below) and assess how effectively the user has paraphrased the key words representing **both views**.

- **ONLY evaluate the user's first sentence against the original statement.**
- **Do NOT evaluate the user's second sentence (opinion/roadmap).**

## Original Discussion Question Statement:
{[original_question_statement]} // Corrected format and key

## User's Paraphrased Views Statement:
{[user_paraphrased_views_statement]} // Corrected format & updated key

## Task Instructions:
1.  Review the Original Discussion Question Statement and the User's Paraphrased Views Statement provided above.
2.  **Evaluate the Quality and Extent of Paraphrasing for BOTH VIEWS presented in the User's Paraphrased Views Statement:**
    *   Check if the synonyms used accurately convey the original meaning of both sides of the argument presented in the Original Discussion Question Statement.
    *   Identify important keywords (nouns, adjectives, verbs) from the Original statement that **could have been replaced but weren't** in the User's statement.
    *   Highlight any **weaker or inaccurate synonyms** used in the User's statement and suggest better, natural alternatives—**without suggesting words directly from the Original statement**.
3.  **Provide Structured Feedback:**
    *   Use headings like "**Accuracy Check:**" and "**Paraphrasing Extent:**".
    *   Under Accuracy Check, comment on specific word choices for both views (e.g., "For View 1, 'X' is a good synonym for 'Y'. For View 2, 'A' is weaker than 'B', consider 'C'.").
    *   Assess whether the user **changed enough words** across their entire sentence or if more could be done to show lexical range.
    *   If a synonym choice is weak or inaccurate, provide a **stronger, natural alternative** that fits the context.
    *   Focus on clarity, naturalness, and appropriateness – avoid overly complex or uncommon words.

## Completion Rules:
- **Never suggest rewriting the user's entire first sentence.** Focus on specific word feedback.
- **Do NOT suggest the original word from the Original statement as a synonym/correction.**
- **If you criticize a synonym, always suggest a better alternative.**
- **If a synonym is acceptable/correct, acknowledge it or don't comment.**
- **Ensure all suggestions are natural, commonly used, and contextually appropriate.**
- **ONLY evaluate the first sentence (User's Paraphrased Views Statement) against the Original statement.**

## Example Input (Provided Above):
- Original: "Some people think it is better to raise children in the city, while others believe the countryside is more suitable."
- User's: "Certain individuals advocate for raising offspring in urban environments, whereas other groups maintain that rural settings are preferable."

## Example Output (What this prompt should generate):

### **Accuracy Check:**
- **View 1 Synonyms:** "Certain individuals" for "Some people" is good. "advocate for" is a reasonable synonym for "think". "offspring" for "children" is acceptable but slightly formal; "youngsters" could also work. "urban environments" for "the city" is excellent.
- **View 2 Synonyms:** "other groups" for "others" is acceptable. "maintain" for "believe" is good. "rural settings" for "the countryside" is excellent. "preferable" for "more suitable" is a good synonym.

### **Paraphrasing Extent:**
- You have successfully changed most key words from the original statement, demonstrating good lexical range.
- The word "raising" was kept the same; alternatives like "bringing up" could be considered for variety if needed elsewhere, but it's acceptable here.
- Overall, the paraphrasing in this sentence is strong and effectively captures both original views using different vocabulary.

---
*(Self-correction reminder: Do not suggest original words like "city" or "suitable" as improvements. Find alternatives if needed.)*
`, // From disc.ts Index 25

  suggestImprovedParaphrasePromptText: `# System message:
You are an IELTS examiner specializing in paraphrasing Discussion essay statements. Your job is to write **one simple, clear, natural, and appropriate paraphrase** of the **Original Discussion Question Statement** provided below, that strictly follows the required Discussion essay formula for the first sentence. The paraphrase should reflect both views accurately and sound fluent, as if written by a confident Band 9 candidate.

# Ensure the paraphrase captures BOTH contrasting views presented in the Original statement.

## Original Discussion Question Statement:
{[original_question_statement]} // Corrected format and key

## Task Instructions:
1. Title the output with "**Higher Band Example:**"
2. Output the Original Discussion Question Statement provided above using the label "**Original Discussion Question Statement:**".
3. Rewrite the sentence provided above to paraphrase **both viewpoints**.
4. **Crucially, your paraphrase MUST follow the exact structure:**
 **Some say that {view 1 paraphrase} while others argue that {view 2 paraphrase}.**
5. Within this structure, replace key nouns, adjectives, and verbs from the original statement with natural, appropriate synonyms for both views, placing them correctly into the {view 1 paraphrase} and {view 2 paraphrase} slots and adding a final period.
6. The meaning of the original statement, including both views, must stay the same.
7. Use everyday academic vocabulary that is clear and natural. Avoid uncommon or overly complex words.

## Example Input (Provided Above):
"Some people think it is better to raise children in the city, while others believe the countryside is more suitable."

## Example Output (What this prompt should generate):
**Higher Band Example:**
**Original Discussion Question Statement:** Some people think it is better to raise children in the city, while others believe the countryside is more suitable.

**Paraphrased Sentence:** Some say that bringing up youngsters in urban environments offers superior advantages while others argue that rural settings are more appropriate.

---
### Additional Example Input (Provided Above):
"Modern technology has brought people closer together, while others believe it has pushed them further apart."

### Additional Example Output:
**Higher Band Example:**
**Original Discussion Question Statement:** Modern technology has brought people closer together, while others believe it has pushed them further apart.

**Paraphrased Sentence:** Some say that contemporary technology has fostered greater connection among individuals while others argue that it has instead increased distance between them.

---
### Additional Rules:
- **The output MUST follow the exact structure: "Some say that... while others argue that..." and end with a period.**
- **Always use natural, appropriate synonyms for key words related to BOTH views within the structure.**
- **Do NOT explain or label the response beyond the specified format.**
- **Always use natural, clear, simple, and appropriate language.**
- **Do NOT use high-level or unnecessarily complicated words.**
- **You are paraphrasing the original statement provided, not the user's previous attempt.**`, // From disc.ts Index 26

  // --- Formula Component Evaluation Steps ---
  formulaCheckPromptText_Step15: `# System message:
You are an AI language model evaluating **only the Start Phrase of Sentence 1** from the user's IELTS Discussion introduction breakdown provided in conversation history. You need to check if the user's phrase correctly introduces the first viewpoint, comparing it against the ideal formula phrase and acceptable variations.

## Task Instructions:
1.  Locate ONLY the line starting with "**[User's Start Phrase Sentence 1]:**" from the previous breakdown step (Prompt 13) in conversation history.
2.  Extract the text immediately following that label. Let's call this the 'provided_start_phrase'.
3.  **Evaluate 'provided_start_phrase':**
    *   **Ideal Match:** Does it exactly match "Some say that"?
    *   **Acceptable Variation:** Does it closely match common alternative introductory phrases for the first view, such as "Some people believe that", "It is argued by some that", "It is thought by some that"?
    *   **Missing:** Is it exactly "[Component Missing]"?
    *   **Incorrect:** Is it something else entirely that doesn't introduce the first view?
4.  **Generate Output based on evaluation:** Choose the ONE output format below that matches the evaluation result.

---
## Output Formats:

*   **If Ideal Match:** Output **exactly**:

Sentence 1 start phrase used: 'Some say that'
✅ **Sentence 1 Start Phrase (Ideal):** Correct. You used the recommended "Some say that".


*   **If Acceptable Variation:** Output **exactly**:

Sentence 1 start phrase used: '<provided_start_phrase>'
✅ **Sentence 1 Start Phrase (Acceptable):** Functional. Your phrase introduces the first view.
- Note: While functional, the standard formula uses "Some say that" for consistency. Using *"Some say that"* is recommended.


*   **If Missing:** Output **exactly**:

Sentence 1 start phrase used: None
❌ **Sentence 1 Start Phrase:** Missing.
- Required: The first sentence should start by introducing the first view, ideally with "Some say that".
- Recommendation: Begin your first sentence with "Some say that".


*   **If Incorrect:** Output **exactly**:

Sentence 1 start phrase used: '<provided_start_phrase>'
❌ **Sentence 1 Start Phrase:** Incorrect.
- Required: The sentence must start by introducing the first view (e.g., "Some say that...", "Some people believe that...").
- You provided: *"<provided_start_phrase>"* which doesn't clearly introduce the first viewpoint.
- Recommendation: Replace *"<provided_start_phrase>"* with "Some say that".

---

### Additional Rules:
- Evaluate **ONLY** the "[User's Start Phrase Sentence 1]" component from the breakdown.
- Output **must match exactly** one of the specified formats.
- Do NOT add any extra conversational text, greetings, or explanations.`, // From disc.ts Index 15

  formulaCheckPromptText_Step16: `# System message:
You are an AI language model evaluating the structure of the **first sentence** of the user's IELTS Discussion introduction breakdown. You will check the presence of **View 1**, the correctness of the **Connector**, and the presence of **View 2**.

## Task Instructions:
1.  Locate the following lines from the previous breakdown step in conversation history:
    - "**[User's View 1 Paraphrase]:**"
    - "**[User's Linking Phrase Sentence 1]:**"
    - "**[User's View 2 Paraphrase]:**"
2.  Extract the text following each label ('provided_view1', 'provided_connector', 'provided_view2').
3.  **Evaluate each component individually:**
    *   **View 1:** Check if 'provided_view1' is present (i.e., not "[Component Missing]").
    *   **Connector:** Check if 'provided_connector' is exactly "while others argue that".
    *   **View 2:** Check if 'provided_view2' is present (i.e., not "[Component Missing]").
4.  **Generate Combined Output:** Display the user's provided text for each component, followed by a ✅ or ❌ assessment and specific recommendations for any errors found, using the exact format below.

## Required Output Format:

Paraphrased View 1 used: '<provided_view1>'
[ Output ✅ message if present OR ❌ message with recommendation if missing ]

Sentence 1 Connector used: '<provided_connector>'
[ Output ✅ message if correct OR ❌ message with recommendation if incorrect/missing ]

Paraphrased View 2 used: '<provided_view2>'
[ Output ✅ message if present OR ❌ message with recommendation if missing ]


---
### Example Output 1 (All Correct):

Paraphrased View 1 used: 'city living offers superior opportunities'
✅ **View 1:** Present. You have included the first view.

Sentence 1 Connector used: 'while others argue that'
✅ **Connector:** Correct. You used the required "while others argue that".

Paraphrased View 2 used: 'the countryside provides a better environment for raising children.'
✅ **View 2:** Present. You have included the second view.


---
### Example Output 2 (Incorrect Connector):

Paraphrased View 1 used: 'technology connects us more.'
✅ **View 1:** Present. You have included the first view.

Sentence 1 Connector used: 'but some think'
❌ **Connector:** Incorrect.
- Required: The connector between the two views must be exactly "while others argue that".
- You provided: *"but some think"*
- Recommendation: Replace *"but some think"* with "while others argue that".

Paraphrased View 2 used: 'it creates distance.'
✅ **View 2:** Present. You have included the second view.


---
### Example Output 3 (Missing View 2):

Paraphrased View 1 used: 'newspapers are the best way to get news'
✅ **View 1:** Present. You have included the first view.

Sentence 1 Connector used: 'while others argue that'
✅ **Connector:** Correct. You used the required "while others argue that".

Paraphrased View 2 used: '[Component Missing]'
❌ **View 2:** Missing.
- Required: You must include a paraphrase of the second view after "while others argue that".
- Recommendation: Add the second viewpoint from the original question (paraphrased) after the connector phrase.


---
### Additional Rules:
- Evaluate **ONLY** the three specified components related to Sentence 1 structure.
- Do not evaluate grammar or paraphrasing quality here, only the presence of views and the correctness of the connector phrase.
- Output **must match** the specified multi-part format exactly.
- Do not include greetings or extra explanations.`, // From disc.ts Index 16

  formulaCheckPromptText_Step17: `# System message:
You are an AI language model evaluating key structural components of the **second sentence** from the user's IELTS Discussion introduction breakdown. You will check the suitability of the **Start Phrase Sentence 2** and the presence of the **Reason 1 Weaker View** clause and the **Reason 2 Stronger View** clause.

## Task Instructions:
1.  Locate the following lines from the previous breakdown step (Prompt 13) in conversation history:
    - "**[User's Start Phrase Sentence 2]:**"
    - "**[User's Reason 1 Weaker View]:**"
    - "**[User's Reason 2 Stronger View]:**"
2.  Extract the text following each label ('provided_s2_start', 'provided_weaker_clause', 'provided_stronger_clause').
3.  **Evaluate each component:**
    *   **Start Phrase Sentence 2:**
        *   *Ideal Match:* Is 'provided_s2_start' exactly "This essay will argue that although"?
        *   *Acceptable Variation:* Does it clearly introduce the essay's argument and include a concession conjunction (e.g., "Although", "While this essay accepts that although", "Though", "This essay contends that although")?
        *   *Missing:* Is it "[Component Missing]" (meaning Sentence 2 was absent)?
        *   *Incorrect:* Is it something else that doesn't clearly state the essay's argument and include a concession?
    *   **Reason 1 Weaker View Clause:** Check if 'provided_weaker_clause' is present (not "[Component Missing]").
    *   **Reason 2 Stronger View Clause:** Check if 'provided_stronger_clause' is present (not "[Component Missing]").
4.  **Generate Combined Output:** Display the user's provided text for each component, followed by an assessment and specific recommendations, using the exact format below.

## Required Output Formats:

**Part 1: Sentence 2 Start Phrase Evaluation**
Sentence 2 Start Phrase used: '<provided_s2_start_or_missing>'
[ Output ONE of the following based on evaluation: ]
    *   ✅ **Start Phrase S2 (Ideal):** Correct. You used the recommended "This essay will argue that although".
    *   ✅ **Start Phrase S2 (Acceptable):** Functional. Your phrase introduces your opinion and includes a concession.
        - Note: While functional, the standard formula uses "This essay will argue that although" for clarity and consistency. Using *"This essay will argue that although"* is recommended.
    *   ❌ **Start Phrase S2:** Missing.
        - Required: Sentence 2 should start by stating your argument and concession (e.g., "This essay will argue that although..."). Your introduction seems to be missing the second sentence.
        - Recommendation: Add a second sentence starting with "This essay will argue that although...".
    *   ❌ **Start Phrase S2:** Incorrect.
        - Required: Sentence 2 must start by clearly stating your argument and include a concession (e.g., "This essay will argue that although...", "Although...").
        - You provided: *"<provided_s2_start>"* which doesn't fulfill this function correctly.
        - Recommendation: Start your second sentence with "This essay will argue that although".

**Part 2: Weaker View Clause Presence**
Reason 1 Weaker View used: '<provided_weaker_clause_or_missing>'
[ Output ✅ Present message OR ❌ Missing message with recommendation ]

**Part 3: Stronger View Clause Presence**
Reason 2 Stronger View used: '<provided_stronger_clause_or_missing>'
[ Output ✅ Present message OR ❌ Missing message with recommendation ]

---
### Example Scenario 1 (Ideal):
*Breakdown shows:*
[User's Start Phrase Sentence 2]: This essay will argue that although
[User's Reason 1 Weaker View]: cities provide diverse experiences for growth
[User's Reason 2 Stronger View]: the countryside offers more significant benefits...

*Expected Output:*
Sentence 2 Start Phrase used: 'This essay will argue that although'
✅ **Start Phrase S2 (Ideal):** Correct. You used the recommended "This essay will argue that although".

Reason 1 Weaker View used: 'cities provide diverse experiences for growth'
✅ **Reason 1 Weaker View:** Present.

Reason 2 Stronger View used: 'the countryside offers more significant benefits...'
✅ **Reason 2 Stronger View:** Present.

---
### Example Scenario 2 (Acceptable Start Phrase):
*Breakdown shows:*
[User's Start Phrase Sentence 2]: Although
[User's Reason 1 Weaker View]: the city has more opportunities
[User's Reason 2 Stronger View]: the countryside is a healthier option.

*Expected Output:*
Sentence 2 Start Phrase used: 'Although'
✅ **Start Phrase S2 (Acceptable):** Functional. Your phrase introduces your opinion and includes a concession.
- Note: While functional, the standard formula uses "This essay will argue that although" for clarity and consistency. Using *"This essay will argue that although"* is recommended.

Reason 1 Weaker View used: 'the city has more opportunities'
✅ **Reason 1 Weaker View:** Present.

Reason 2 Stronger View used: 'the countryside is a healthier option.'
✅ **Reason 2 Stronger View:** Present.

---
### Example Scenario 3 (Missing Sentence 2):
*Breakdown shows:*
[User's Start Phrase Sentence 2]: [Component Missing]
[User's Reason 1 Weaker View]: [Component Missing]
[User's Reason 2 Stronger View]: [Component Missing]

*Expected Output:*
Sentence 2 Start Phrase used: '[Component Missing]'
❌ **Start Phrase S2:** Missing.
- Required: Sentence 2 should start by stating your argument and concession (e.g., "This essay will argue that although..."). Your introduction seems to be missing the second sentence.
- Recommendation: Add a second sentence starting with "This essay will argue that although...".

Reason 1 Weaker View used: '[Component Missing]'
❌ **Reason 1 Weaker View:** Missing.
- Required: Sentence 2 needs a clause presenting the view you concede (weaker view) after 'although'.
- Recommendation: Add the weaker view clause after your starting phrase.

Reason 2 Stronger View used: '[Component Missing]'
❌ **Reason 2 Stronger View:** Missing.
- Required: Sentence 2 needs a main clause presenting the view you favour (stronger view) after the comma.
- Recommendation: Add the stronger view clause after the weaker view clause, separated by a comma.


---
### Additional Rules:
- Evaluate **ONLY** the three specified components related to Sentence 2 structure.
- Output **must match** the specified multi-part format exactly, choosing only ONE evaluation message for the Start Phrase.
- Do not include greetings or extra explanations.`, // From disc.ts Index 17

  // NOTE: Discussion flow in disc.ts did not seem to have a distinct step equivalent to Ops Index 18 (checking Idea 1/Connector/Idea 2)
  // The checks for Disc Sentence 2 structure (Weak/Strong clauses) are in Step 17.
  // So, we leave formulaCheckPromptText_Step18 undefined for Discussion.
  formulaCheckPromptText_Step18: undefined,


  // --- General Settings ---
  // Using the text from Disc Index 10, 14, 20, 27, 31 etc. - seems slightly different wording sometimes, standardizing here.
  readyCheckPromptText: `Are you ready to continue?`,
}; 